"""Pure Python rental rules used by the server and pytest."""

from datetime import datetime, date
from zoneinfo import ZoneInfo
import re


class AppError(Exception):
    def __init__(self, status, message, fields=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.fields = fields


def today():
    return datetime.now(ZoneInfo("Europe/Moscow")).date().isoformat()


def parse_date(value):
    try:
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError()
        return date.fromisoformat(value)
    except ValueError:
        raise AppError(400, "Такой даты не существует") from None


def calculate_quote(car, start, end, extras=None, now=None):
    days = (parse_date(end) - parse_date(start)).days
    if start < (now or today()) or not 1 <= days <= 30:
        raise AppError(
            400, "Аренда возможна от 1 до 30 суток, начиная с сегодняшнего дня"
        )
    base = int(car["dailyRate"] * days * (9 if days >= 7 else 10) / 10 + 0.5)
    extras = extras or {}
    insurance = days * 600 if extras.get("insurance") else 0
    seat = days * 300 if extras.get("childSeat") else 0
    return dict(
        days=days,
        dailyRate=car["dailyRate"],
        base=base,
        insurance=insurance,
        childSeat=seat,
        total=base + insurance + seat,
        deposit=car.get("deposit", 0),
    )


def validate_transition(old, new, role):
    allowed = {
        "new": ["confirmed", "cancelled"],
        "confirmed": ["active", "cancelled"],
        "active": ["completed"],
        "completed": [],
        "cancelled": [],
    }
    if new not in allowed.get(old, []) or (role == "client" and new != "cancelled"):
        raise AppError(409, "Этот переход статуса недоступен")


def normalize_phone(value):
    if not isinstance(value, str) or re.search(r"[^\d+()\s-]", value):
        raise AppError(400, "Введите российский номер телефона")
    digits = re.sub(r"\D", "", value)
    if len(digits) == 11 and digits[0] in "78":
        digits = digits[1:]
    if not re.fullmatch(r"\d{10}", digits):
        raise AppError(400, "Введите 10 цифр номера после +7")
    return "+7" + digits


def can_rent(user):
    return (
        user.get("ageConfirmed") is True
        and user.get("licenseConfirmed") is True
        and type(user.get("drivingExperience")) is int
        and 1 <= user["drivingExperience"] <= 80
    )
