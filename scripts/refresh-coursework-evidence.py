"""Render evidence from real MongoDB stdout and the new pytest load JSON."""

from pathlib import Path
from datetime import datetime, timezone
import json, subprocess, statistics, hashlib, os, textwrap
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parents[1]
report = root / "docs/reports/selenium-pytest-postman"
shots = root / "docs/screenshots/coursework"
query = """const d=db.getSiblingDB("avtobaza_e2e");
print("DATABASE: "+d.getName()+" | MongoDB "+db.version());
print("Active cars: "+d.cars.countDocuments({archived:false}));
print("Cars (first 4):");
for(const c of d.cars.find({archived:false},{_id:0,brand:1,model:1,dailyRate:1}).sort({brand:1}).limit(4)) print(JSON.stringify(c));
print("Last completed rental:");
print(JSON.stringify(d.rentals.findOne({status:"completed"},{_id:0,carName:1,from:1,to:1,status:1,returnMileage:1,"history.status":1})));
print("Latest registration consent (no personal fields):");
print(JSON.stringify(d.users.find({"legal.consentVersion":{$exists:true}},{_id:0,role:1,legal:1}).sort({createdAt:-1}).limit(1).toArray()[0]));"""
(report / "mongosh-query.js").write_text(query)
container = os.environ.get("MONGO_CONTAINER")
if not container:
    names = subprocess.check_output(
        ["docker", "ps", "--filter", "publish=27017", "--format", "{{.Names}}"],
        text=True,
    ).splitlines()
    if len(names) != 1:
        raise RuntimeError("Set MONGO_CONTAINER to the local MongoDB container name")
    container = names[0]
stdout = subprocess.check_output(
    ["docker", "exec", container, "mongosh", "--quiet", "--eval", query], text=True
)
(report / "mongosh.txt").write_text(stdout)
# database.png is a real terminal-window capture. Never redraw it from text.
# To refresh it, run capture-mongo-console.sh in a terminal and capture that window.
plt.rcParams["font.family"] = "DejaVu Sans"
fig, axes = plt.subplots(1, 2, figsize=(12, 4.8))
summary = {}
for e in ["identity", "gzip"]:
    values = []
    for c in [10, 50]:
        j = json.loads((report / f"load-{e}-{c}.json").read_text())
        summary[f"{e}-{c}"] = {
            k: statistics.median(r[k] for r in j["rounds"])
            for k in ["rps", "mean_ms", "p99_ms", "bytes_per_response"]
        }
    x = [0, 1] if e == "identity" else [0.35, 1.35]
    for ax, k, label in [
        (axes[0], "rps", "Запросов / с"),
        (axes[1], "p99_ms", "p99, мс"),
    ]:
        bars = ax.bar(
            x,
            [summary[f"{e}-{c}"][k] for c in [10, 50]],
            width=0.32,
            label=e,
            color="#425a70" if e == "identity" else "#9ebacf",
        )
        ax.bar_label(bars, fmt="%.1f", padding=3)
        ax.set_ylabel(label)
        ax.set_xticks([0.175, 1.175], ["10 соединений", "50 соединений"])
        ax.set_ylim(0, max(b.get_height() for b in ax.patches) * 1.25)
        ax.legend()
fig.suptitle("GET /api/cars: медианы трёх повторов по 5 с, локальная среда")
fig.tight_layout()
fig.savefig(shots / "load-comparison.png", dpi=170)
plt.close(fig)
(report / "load-summary.json").write_text(json.dumps(summary, indent=2))
print("Updated MongoDB screenshot and load figure")
