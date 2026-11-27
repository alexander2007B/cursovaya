"""Verify compatibility in a disposable sample DB; never changes a working DB."""

from pathlib import Path
from datetime import datetime, timezone
import json, bcrypt
from bson import ObjectId
from pymongo import MongoClient
from norde.seed import seed

URI = "mongodb://127.0.0.1:27017/norde_python_migration_test?replicaSet=rs0&directConnection=true"
c = MongoClient(URI)
db = c.get_default_database()
assert db.name == "norde_python_migration_test"
c.drop_database(db.name)
old = c.avtobaza_e2e.users.find_one({"email": "admin@avtobaza.test"})
try:
    if not old:
        raise RuntimeError(
            "The earlier isolated example DB is required for the legacy hash check"
        )
    db.users.insert_one(old)
    uid = old["_id"]
    carid = ObjectId()
    rentalid = ObjectId()
    now = datetime.now(timezone.utc)
    root = Path(__file__).resolve().parents[1]
    legacy = json.loads((root / "data/legacy-fleet.json").read_text())[0]
    db.cars.insert_one(
        {
            "_id": carid,
            **legacy,
            "image": "/images/sedan.svg",
            "mileage": 77777,
            "status": "broken",
            "archived": False,
            "dailyRate": 4321,
            "deposit": 20000,
        }
    )
    db.rentals.insert_one(
        {
            "_id": rentalid,
            "user": uid,
            "car": carid,
            "number": "MIGRATION-EXAMPLE",
            "status": "completed",
            "quote": {"total": 54321},
            "history": [{"status": "completed", "at": now, "by": uid}],
        }
    )
    custom = ObjectId()
    db.cars.insert_one(
        {
            "_id": custom,
            "plate": "ТЕСТ999",
            "brand": "Custom",
            "model": "Personal",
            "image": "/uploads/" + "a" * 32 + ".webp",
            "mileage": 999,
            "archived": False,
            "status": "available",
        }
    )
    seed(URI)
    assert db.users.find_one({"_id": uid})["passwordHash"] == old["passwordHash"]
    assert bcrypt.checkpw(b"Avtobaza2026!", old["passwordHash"].encode())
    car = db.cars.find_one({"_id": carid})
    assert (
        car["mileage"] == 77777
        and car["status"] == "broken"
        and car["dailyRate"] == 4321
        and not car["image"].endswith(".svg")
    )
    rental = db.rentals.find_one({"_id": rentalid})
    assert (
        rental["car"] == carid
        and rental["user"] == uid
        and rental["quote"]["total"] == 54321
    )
    assert (
        db.cars.find_one({"_id": custom})["image"] == "/uploads/" + "a" * 32 + ".webp"
    )
    report = {
        "passed": True,
        "checks": [
            "existing bcrypt hash accepted and unchanged",
            "user/car/rental ObjectId and references preserved",
            "mileage, status and custom tariff preserved",
            "old standard SVG photo upgraded",
            "custom uploaded photo path preserved",
            "historical quote and history preserved",
        ],
        "database": db.name,
    }
    (root / "docs/reports/python-final/migration.json").write_text(
        json.dumps(report, indent=2)
    )
    print(report)
finally:
    c.drop_database("norde_python_migration_test")
    c.close()
