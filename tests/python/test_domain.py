import pytest
from norde.domain import calculate_quote, validate_transition, normalize_phone, AppError


@pytest.mark.parametrize("days,total", [(3, 14700), (7, 31500)])
def test_price(days, total):
    end = f"2026-12-{days+1:02}" if days < 30 else "2026-12-31"
    q = calculate_quote(
        {"dailyRate": 4000, "deposit": 20000},
        "2026-12-01",
        end,
        {"insurance": True, "childSeat": True},
        "2026-12-01",
    )
    assert q["total"] == total and q["deposit"] == 20000


@pytest.mark.parametrize(
    "start,end",
    [
        ("2026-02-30", "2026-03-02"),
    ],
)
def test_invalid_dates(start, end):
    with pytest.raises(AppError):
        calculate_quote({"dailyRate": 4000, "deposit": 0}, start, end, {}, "2026-12-01")


@pytest.mark.parametrize(
    "old,new,role,allowed",
    [
        ("confirmed", "active", "client", False),
    ],
)
def test_transitions(old, new, role, allowed):
    if allowed:
        validate_transition(old, new, role)
    else:
        with pytest.raises(AppError):
            validate_transition(old, new, role)


@pytest.mark.parametrize(
    "value,expected",
    [
        ("8 (900) 123-45-67", "+79001234567"),
        ("()()()()()", None),
    ],
)
def test_phone(value, expected):
    if expected:
        assert normalize_phone(value) == expected
    else:
        with pytest.raises(AppError):
            normalize_phone(value)
