"""HTTP integration against the isolated server and real MongoDB replica set."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json, time
import pytest, requests
from conftest import BASE


def session(role=None):
    s = requests.Session()
    s.headers["X-CSRF-Token"] = s.get(BASE + "/api/auth/session").json()["csrfToken"]
    if role:
        r = s.post(
            BASE + "/api/auth/login",
            json={"email": role + "@avtobaza.test", "password": "Avtobaza2026!"},
        )
        assert r.status_code == 200, r.text
        s.headers["X-CSRF-Token"] = r.json()["csrfToken"]
    return s


def call(s, method, path, body=None, status=200):
    r = s.request(method, BASE + path, json=body)
    assert r.status_code == status, r.text
    return r.json()


from pymongo import MongoClient
from bson import ObjectId

DATABASE = MongoClient(
    "mongodb://127.0.0.1:27017/norde_python_test?replicaSet=rs0&directConnection=true"
).get_default_database()


@pytest.fixture
def actors():
    a = [session(r) for r in ["admin", "manager", "client"]]
    yield a
    for s in a:
        s.close()


def dates(offset=0):
    start = datetime.now(timezone(timedelta(hours=3))).date() + timedelta(days=offset)
    return {"from": str(start), "to": str(start + timedelta(days=1))}


def test_registration_records_and_password():
    with session() as s:
        email = f"pytest{time.time_ns()}@example.test"
        body = dict(
            name="Pytest Клиент",
            email=email,
            phone="+79002223344",
            password="Pytest2026!",
            ageConfirmed=True,
            licenseConfirmed=True,
            drivingExperience=3,
            termsAccepted=True,
            personalDataConsent=True,
            legalVersion="2026-11-23.1",
        )
        for key in ["termsAccepted", "personalDataConsent"]:
            call(s, "POST", "/api/auth/register", {**body, key: False}, 400)
        result = call(s, "POST", "/api/auth/register", body, 201)
        assert (
            result["user"]["role"] == "client" and "passwordHash" not in result["user"]
        )
        saved = DATABASE.users.find_one({"email": email})
        assert saved["passwordHash"] != body["password"] and saved[
            "passwordHash"
        ].startswith("$2")
        assert (
            saved["legal"]["consentVersion"] == body["legalVersion"]
            and saved["legal"]["consentAcceptedAt"]
        )


def test_rental_lifecycle_and_history(actors):
    admin, manager, client = actors
    car = next(
        c for c in call(client, "GET", "/api/cars")["cars"] if c["brand"] == "Audi"
    )
    r = call(client, "POST", "/api/rentals", dict(carId=car["_id"], **dates()), 201)[
        "rental"
    ]
    path = "/api/rentals/" + r["_id"] + "/status"
    call(client, "PATCH", path, {"status": "confirmed"}, 409)
    call(
        manager,
        "PATCH",
        path,
        {"status": "completed", "returnMileage": car["mileage"] + 10},
        409,
    )
    for status in ["confirmed", "active"]:
        call(manager, "PATCH", path, {"status": status})
    call(
        manager,
        "PATCH",
        path,
        {"status": "completed", "returnMileage": car["mileage"] - 1},
        400,
    )
    result = call(
        manager,
        "PATCH",
        path,
        {"status": "completed", "returnMileage": car["mileage"] + 10},
    )["rental"]
    assert result["status"] == "completed" and len(result["history"]) == 4
    saved = DATABASE.rentals.find_one({"_id": ObjectId(r["_id"])})
    assert saved["returnMileage"] == car["mileage"] + 10 and len(saved["history"]) == 4


def test_parallel_booking_conflict(actors):
    _, _, client = actors
    car = next(
        c for c in call(client, "GET", "/api/cars")["cars"] if c["brand"] == "BMW"
    )
    # Distinct sessions, same car and interval. Both transactions must contend.
    other = session("client")
    body = dict(carId=car["_id"], **dates(3))
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(
            pool.map(
                lambda s: s.post(BASE + "/api/rentals", json=body), [client, other]
            )
        )
    other.close()
    assert sorted(r.status_code for r in responses) == [201, 409]
    rental = next(r.json()["rental"] for r in responses if r.status_code == 201)
    assert (
        DATABASE.rentals.count_documents(
            {"car": ObjectId(car["_id"]), "from": body["from"], "status": "new"}
        )
        == 1
    )
    call(
        client,
        "PATCH",
        "/api/rentals/" + rental["_id"] + "/status",
        {"status": "cancelled"},
    )


def test_four_photos_and_archiving(actors):
    admin, manager, _ = actors
    source = call(admin, "GET", "/api/cars")["cars"][:4]
    gallery = [c["image"] for c in source]
    body = dict(
        brand="Pytest",
        model="Gallery",
        year=2024,
        plate="ПТ" + str(time.time_ns())[-7:],
        category="comfort",
        dailyRate=4000,
        deposit=20000,
        mileage=1000,
        seats=5,
        transmission="Автомат",
        fuel="Бензин",
        image=gallery[0],
        gallery=gallery[1:],
        description="Четыре фотографии",
        status="available",
    )
    call(manager, "POST", "/api/admin/cars", body, 403)
    car = call(admin, "POST", "/api/admin/cars", body, 201)["car"]
    assert [car["image"], *car["gallery"]] == gallery
    call(admin, "PATCH", "/api/admin/cars/" + car["_id"], {"dailyRate": 4500})
    record = call(
        manager,
        "POST",
        "/api/admin/maintenance",
        {
            "carId": car["_id"],
            "node": "Кузов",
            "wear": 10,
            "mileage": 1100,
            "note": "Pytest",
        },
        201,
    )
    call(admin, "DELETE", "/api/admin/cars/" + car["_id"])
    assert all(c["_id"] != car["_id"] for c in call(admin, "GET", "/api/cars")["cars"])
    # Archiving does not delete the service history.
    rows = call(manager, "GET", "/api/admin/maintenance")
    assert car["_id"] in json.dumps(rows)


def test_csrf_and_role_boundaries():
    with session() as guest:
        call(guest, "GET", "/api/admin/users", status=401)
        guest.headers.pop("X-CSRF-Token")
        call(
            guest,
            "POST",
            "/api/auth/login",
            {"email": "admin@avtobaza.test", "password": "Avtobaza2026!"},
            403,
        )
