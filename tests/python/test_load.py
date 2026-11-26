import concurrent.futures, threading, time, json, gzip, statistics
from datetime import datetime, timezone
import pytest, requests
from conftest import BASE, REPORT


@pytest.mark.load
@pytest.mark.parametrize("encoding", ["identity", "gzip"])
@pytest.mark.parametrize("connections", [10, 50])
def test_catalog_load(encoding, connections):
    rounds = []
    for repeat in range(3):
        shared = {}
        barrier = threading.Barrier(
            connections + 1,
            action=lambda: shared.update(
                start=time.perf_counter(), stop=time.perf_counter() + 5
            ),
        )

        def worker():
            session = requests.Session()
            barrier.wait()
            values = []
            errors = 0
            size = 0
            while time.perf_counter() < shared["stop"]:
                start = time.perf_counter()
                try:
                    r = session.get(
                        BASE + "/api/cars",
                        headers={"Accept-Encoding": encoding},
                        stream=True,
                        timeout=5,
                    )
                    data = r.raw.read(decode_content=False)
                    size += len(data)
                    decoded = (
                        gzip.decompress(data)
                        if r.headers.get("Content-Encoding") == "gzip"
                        else data
                    )
                    assert (
                        r.status_code == 200 and len(json.loads(decoded)["cars"]) >= 12
                    )
                    values.append((time.perf_counter() - start) * 1000)
                except Exception:
                    errors += 1
            session.close()
            return values, errors, size

        with concurrent.futures.ThreadPoolExecutor(max_workers=connections) as pool:
            jobs = [pool.submit(worker) for _ in range(connections)]
            barrier.wait()
            results = [j.result() for j in jobs]
        duration = time.perf_counter() - shared["start"]
        lat = sorted(v for vals, _, _ in results for v in vals)
        errors = sum(e for _, e, _ in results)
        size = sum(s for _, _, s in results)
        rounds.append(
            dict(
                repeat=repeat + 1,
                duration_s=round(duration, 3),
                requests=len(lat),
                rps=round(len(lat) / duration, 2),
                mean_ms=round(statistics.mean(lat), 2),
                p99_ms=round(lat[min(len(lat) - 1, int(0.99 * len(lat)))], 2),
                errors=errors,
                wire_body_bytes=size,
                bytes_per_response=round(size / max(1, len(lat)), 2),
            )
        )
    report = dict(
        at=datetime.now(timezone.utc).isoformat(),
        endpoint=BASE + "/api/cars",
        connections=connections,
        encoding=encoding,
        planned_duration_s=5,
        rounds=rounds,
        notes="Python threads and server share host; wire body bytes exclude HTTP headers; not public-site load or booking stress",
    )
    (REPORT / f"load-{encoding}-{connections}.json").write_text(
        json.dumps(report, indent=2)
    )
    assert all(r["errors"] == 0 and r["p99_ms"] < 2000 for r in rounds), report
