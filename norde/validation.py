"""Strict request validation. JSON booleans/numbers are not coerced from strings."""

import re
from datetime import datetime
from .domain import AppError, normalize_phone, can_rent

LEGAL_VERSION = "2026-11-23.1"


def check(condition, field, message="Проверьте заполнение полей"):
    if not condition:
        raise AppError(400, message, {field: [message]})


def strict(data, allowed, required=()):
    check(isinstance(data, dict), "body")
    for k in data:
        check(k in allowed, k, "Неизвестное поле")
    for k in required:
        check(k in data, k, "Обязательное поле")
    return data.copy()


def text(data, k, lo, hi):
    v = data.get(k)
    check(isinstance(v, str), k)
    v = v.strip()
    check(lo <= len(v) <= hi, k)
    data[k] = v


def integer(data, k, lo, hi):
    check(type(data.get(k)) is int and lo <= data[k] <= hi, k)


def credentials(data, register=False):
    extra = (
        {
            "name",
            "phone",
            "ageConfirmed",
            "licenseConfirmed",
            "drivingExperience",
            "termsAccepted",
            "personalDataConsent",
            "legalVersion",
        }
        if register
        else set()
    )
    d = strict(data, {"email", "password"} | extra, {"email", "password"} | extra)
    text(d, "email", 3, 120)
    d["email"] = d["email"].lower()
    check(
        re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", d["email"]),
        "email",
        "Некорректный email",
    )
    p = d["password"]
    check(
        isinstance(p, str) and len(p) >= 8 and len(p.encode("utf-8")) <= 72,
        "password",
        "Пароль: минимум 8 символов и максимум 72 байта UTF-8",
    )
    if register:
        text(d, "name", 2, 80)
        d["phone"] = normalize_phone(d["phone"])
        check(
            can_rent(d),
            "drivingExperience",
            "Подтвердите возраст, права и стаж от 1 года",
        )
        check(
            d["termsAccepted"] is True,
            "termsAccepted",
            "Примите пользовательское соглашение",
        )
        check(
            d["personalDataConsent"] is True,
            "personalDataConsent",
            "Дайте согласие на обработку персональных данных",
        )
        check(
            d["legalVersion"] == LEGAL_VERSION,
            "legalVersion",
            "Документы обновились. Обновите страницу",
        )
    return d


def profile(data):
    d = strict(
        data,
        {"name", "phone", "ageConfirmed", "licenseConfirmed", "drivingExperience"},
        {"name", "phone"},
    )
    text(d, "name", 2, 80)
    d["phone"] = normalize_phone(d["phone"])
    if any(k in d for k in ["ageConfirmed", "licenseConfirmed", "drivingExperience"]):
        check(can_rent(d), "drivingExperience", "Подтвердите возраст, права и стаж")
    return d


PHOTO = r"^/(?:images/[a-zA-Z0-9_/-]+\.(?:svg|jpg|jpeg|png|webp)|uploads/[a-f0-9]{32}\.webp)$"
CAR_FIELDS = {
    "brand",
    "model",
    "year",
    "plate",
    "category",
    "dailyRate",
    "deposit",
    "mileage",
    "seats",
    "transmission",
    "fuel",
    "image",
    "gallery",
    "description",
    "status",
}


def car(data, partial=False, manager=False):
    d = strict(
        data,
        {"status"} if manager else CAR_FIELDS,
        () if partial else CAR_FIELDS - {"gallery"},
    )
    limits = {
        "brand": (1, 40),
        "model": (1, 60),
        "plate": (5, 15),
        "fuel": (1, 30),
        "description": (10, 1500),
    }
    for k, (lo, hi) in limits.items():
        if k in d:
            text(d, k, lo, hi)
    if "plate" in d:
        d["plate"] = d["plate"].upper()
    for k, lo, hi in [
        ("year", 2000, datetime.now().year + 1),
        ("dailyRate", 500, 100000),
        ("deposit", 0, 500000),
        ("mileage", 0, 2000000),
        ("seats", 2, 9),
    ]:
        if k in d:
            integer(d, k, lo, hi)
    for k, values in [
        ("category", ["economy", "comfort", "business", "premium", "suv"]),
        ("transmission", ["Автомат", "Механика"]),
        ("status", ["available", "maintenance", "broken"]),
    ]:
        if k in d:
            check(d[k] in values, k)
    if "image" in d:
        check(isinstance(d["image"], str) and re.fullmatch(PHOTO, d["image"]), "image")
    if "gallery" in d:
        check(
            isinstance(d["gallery"], list)
            and len(d["gallery"]) <= 3
            and all(
                isinstance(x, str) and re.fullmatch(PHOTO, x) for x in d["gallery"]
            ),
            "gallery",
        )
    return d


def booking(data):
    d = strict(
        data, {"carId", "from", "to", "extras", "comment"}, {"carId", "from", "to"}
    )
    check(
        isinstance(d["carId"], str) and re.fullmatch(r"[a-fA-F0-9]{24}", d["carId"]),
        "carId",
    )
    d.setdefault("extras", {})
    d.setdefault("comment", "")
    text(d, "comment", 0, 500)
    d["extras"] = strict(d["extras"], {"insurance", "childSeat"})
    for k in ["insurance", "childSeat"]:
        d["extras"].setdefault(k, False)
        check(type(d["extras"][k]) is bool, "extras")
    return d
