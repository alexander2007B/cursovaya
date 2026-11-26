"""Reproducible Selenium/pytest/Postman run. Resets only avtobaza_e2e."""

import json, os, platform, socket, subprocess, sys, time, shutil
from datetime import datetime, timezone
from pathlib import Path
import requests, pytest, selenium

os.chdir(Path(__file__).resolve().parents[1])
report = Path("docs/reports/selenium-pytest-postman")
report.mkdir(parents=True, exist_ok=True)
with socket.socket() as sock:
    if sock.connect_ex(("127.0.0.1", 3001)) == 0:
        raise SystemExit(
            "Port 3001 is in use. Stop the previous isolated test server first."
        )
subprocess.run(["npm", "run", "build"], check=True)
subprocess.run([sys.executable, "scripts/build-postman-tests.py"], check=True)
environment = dict(
    at=datetime.now(timezone.utc).isoformat(),
    sourceCommit=subprocess.check_output(
        ["git", "rev-parse", "HEAD"], text=True
    ).strip(),
    applicationSourceStatus=subprocess.check_output(
        ["git", "status", "--porcelain", "--", "client", "server", "shared"], text=True
    ).strip(),
    python=platform.python_version(),
    pytest=pytest.__version__,
    selenium=selenium.__version__,
    requests=requests.__version__,
    node=subprocess.check_output(["node", "--version"], text=True).strip(),
    newman=subprocess.check_output(
        ["npx", "--no-install", "newman", "--version"], text=True
    ).strip(),
    chromium=subprocess.check_output(
        [
            shutil.which("chromium")
            or os.environ.get("CHROMIUM_PATH", "google-chrome"),
            "--version",
        ],
        text=True,
    ).strip(),
    mongodb=subprocess.check_output(
        [
            "node",
            "--input-type=module",
            "-e",
            'import m from "mongoose";await m.connect("mongodb://127.0.0.1:27017/avtobaza_e2e?replicaSet=rs0&directConnection=true");console.log((await m.connection.db.admin().serverInfo()).version);await m.disconnect();',
        ],
        text=True,
    ).strip(),
    database="avtobaza_e2e",
    endpoint="http://127.0.0.1:3001",
    os=platform.platform(),
    cpus=os.cpu_count(),
)
(report / "environment.json").write_text(json.dumps(environment, indent=2))
with (report / "server.txt").open("w") as server_log:
    server = subprocess.Popen(
        ["node", "scripts/test-server.js"], stdout=server_log, stderr=subprocess.STDOUT
    )
    try:
        for _ in range(150):
            if server.poll() is not None:
                raise RuntimeError("Test server stopped; see server.txt")
            try:
                if (
                    requests.get(
                        "http://127.0.0.1:3001/api/health", timeout=1
                    ).status_code
                    == 200
                ):
                    break
            except requests.RequestException:
                pass
            time.sleep(0.2)
        else:
            raise RuntimeError("Test server was not ready")
        commands = [
            ("newman", ["npm", "run", "test:api"]),
            (
                "pytest",
                [
                    sys.executable,
                    "-m",
                    "pytest",
                    "-m",
                    "not load",
                    "--tb=short",
                    "--junitxml=" + str(report / "pytest.xml"),
                ],
            ),
            (
                "load",
                [
                    sys.executable,
                    "-m",
                    "pytest",
                    "-m",
                    "load",
                    "--tb=short",
                    "--junitxml=" + str(report / "load.xml"),
                ],
            ),
        ]
        codes = {}
        for name, cmd in commands:
            print("Running", name, flush=True)
            with (report / (name + ".txt")).open("w") as log:
                codes[name] = subprocess.run(
                    cmd, stdout=log, stderr=subprocess.STDOUT
                ).returncode
            print(name, "exit", codes[name], flush=True)
            if codes[name]:
                break
        if (report / "newman.json").exists():
            raw = json.loads((report / "newman.json").read_text())
            run = raw["run"]
            summary = {
                "started": run["timings"]["started"],
                "completed": run["timings"]["completed"],
                "stats": run["stats"],
                "requests": [
                    {
                        "name": e["item"]["name"],
                        "status": e.get("response", {}).get("code"),
                        "duration_ms": e.get("response", {}).get("responseTime"),
                        "assertions": [
                            {
                                "name": a["assertion"],
                                "error": a.get("error", {}).get("message"),
                            }
                            for a in e.get("assertions", [])
                        ],
                    }
                    for e in run["executions"]
                ],
                "failures": [
                    {
                        "name": f.get("source", {}).get("name"),
                        "message": f["error"]["message"],
                    }
                    for f in run["failures"]
                ],
            }
            (report / "newman-summary.json").write_text(
                json.dumps(summary, ensure_ascii=False, indent=2)
            )
        (report / "exit-codes.json").write_text(json.dumps(codes, indent=2))
        if any(codes.values()):
            raise SystemExit(1)
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()
