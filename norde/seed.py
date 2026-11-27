"""Add missing demo records without deleting users, cars or bookings."""

import argparse, json, os
from pathlib import Path
from datetime import datetime, timezone
import bcrypt
from dotenv import load_dotenv
from pymongo import MongoClient


def seed(uri):
    client = MongoClient(uri, tz_aware=True)
    db = client.get_default_database()
    now = datetime.now(timezone.utc)
    hashed = bcrypt.hashpw(b"Avtobaza2026!", bcrypt.gensalt(12)).decode()
    for name, email, role in [
        ("Администратор", "admin@avtobaza.test", "admin"),
        ("Дмитрий", "manager@avtobaza.test", "manager"),
        ("Александр Баев", "client@avtobaza.test", "client"),
    ]:
        db.users.update_one(
            {"email": email},
            {
                "$setOnInsert": dict(
                    name=name,
                    email=email,
                    role=role,
                    phone="+79001234567",
                    ageConfirmed=True,
                    licenseConfirmed=True,
                    drivingExperience=3,
                    passwordHash=hashed,
                    createdAt=now,
                    updatedAt=now,
                )
            },
            upsert=True,
        )
    db.users.update_one(
        {"email": "manager@avtobaza.test", "role": "manager", "name": "Анна Миронова"},
        {"$set": {"name": "Дмитрий"}},
    )
    root = Path(__file__).resolve().parents[1]
    fleet = json.loads((root / "data/fleet.json").read_text())
    for car in fleet:
        db.cars.update_one(
            {"plate": car["plate"]},
            {
                "$setOnInsert": {
                    **car,
                    "archived": False,
                    "lockVersion": 0,
                    "createdAt": now,
                    "updatedAt": now,
                }
            },
            upsert=True,
        )
    for old in json.loads((root / "data/legacy-fleet.json").read_text()):
        row = db.cars.find_one({k: old[k] for k in ["plate", "brand", "model"]})
        if row and str(row.get("image", "")).endswith(".svg"):
            fresh = next(c for c in fleet if c["plate"] == old["plate"])
            patch = {
                k: fresh[k]
                for k in [
                    "brand",
                    "model",
                    "year",
                    "category",
                    "image",
                    "description",
                    "seats",
                    "fuel",
                    "transmission",
                ]
            }
            db.cars.update_one(
                {"_id": row["_id"], "image": row["image"]}, {"$set": patch}
            )
    client.close()
    print("Учебные данные готовы; существующие записи сохранены.")


if __name__ == "__main__":
    load_dotenv()
    p = argparse.ArgumentParser()
    p.add_argument("--allow-demo", action="store_true")
    a = p.parse_args()
    if not a.allow_demo or os.getenv("APP_ENV") == "production":
        raise SystemExit("Seed разрешён только с --allow-demo вне production")
    seed(os.environ["MONGODB_URI"])
