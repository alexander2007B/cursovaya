"""Build-free quality run: isolated Python server, 15 pytest + 15 Postman scenarios + load."""

from pathlib import Path
import os, socket, subprocess, sys, time, json, platform
from datetime import datetime, timezone
import requests

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
REPORT = ROOT / "docs/reports/python-final"
REPORT.mkdir(parents=True, exist_ok=True)
if __name__ == "__main__":
    with socket.socket() as s:
        if s.connect_ex(("127.0.0.1", 3101)) == 0:
            raise SystemExit(
                "Stop the previous isolated test server on port 3101 first"
            )
    environment = {
        "at": datetime.now(timezone.utc).isoformat(),
        "python": platform.python_version(),
        "sourceCommit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], text=True
        ).strip(),
        "database": "norde_python_test",
        "baseUrl": "http://127.0.0.1:3101",
        "node_required": False,
        "workingTree": subprocess.check_output(["git","status","--porcelain"],text=True),
    }
    from importlib.metadata import version

    for p in ["Flask", "pymongo", "bcrypt", "Pillow", "pytest", "selenium", "requests"]:
        environment[p] = version(p)
    (REPORT / "environment.json").write_text(json.dumps(environment, indent=2))
    with (REPORT / "server.txt").open("w") as log:
        server = subprocess.Popen(
            [sys.executable, "-m", "scripts.test_server"],
            stdout=log,
            stderr=subprocess.STDOUT,
        )
        try:
            for _ in range(200):
                if server.poll() is not None:
                    raise RuntimeError("Test server stopped; see server.txt")
                try:
                    r = requests.get("http://127.0.0.1:3101/api/health", timeout=1)
                    if r.ok and r.json().get("runtime") == "python":
                        break
                except requests.RequestException:
                    pass
                time.sleep(0.2)
            else:
                raise RuntimeError("Server readiness timeout")
            codes = {}
            for name, args in [
                ("pytest", ["-m", "not load"]),
                ("postman", ["tests/postman/test_collection.py"]),
                ("load", ["-m", "load"]),
            ]:
                print("Running", name, flush=True)
                with (REPORT / (name + ".txt")).open("w") as log:
                    codes[name] = subprocess.run(
                        [
                            sys.executable,
                            "-m",
                            "pytest",
                            *args,
                            "--tb=short",
                            "--junitxml=" + str(REPORT / (name + ".xml")),
                        ],
                        stdout=log,
                        stderr=subprocess.STDOUT,
                    ).returncode
                print(name, "exit", codes[name], flush=True)
                if codes[name]:
                    break
            (REPORT / "exit-codes.json").write_text(json.dumps(codes, indent=2))
            if any(codes.values()):
                raise SystemExit(1)
        finally:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
