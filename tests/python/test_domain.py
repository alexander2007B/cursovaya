import json, subprocess
import pytest


def node(expression):
    code = (
        'import {calculateQuote,validateTransition} from "./server/domain.js";import {normalizeRussianPhone} from "./shared/phone.js";try{console.log(JSON.stringify('
        + expression
        + "))}catch(e){console.log(JSON.stringify({error:e.message}))}"
    )
    return json.loads(
        subprocess.check_output(["node", "--input-type=module", "-e", code], text=True)
    )


@pytest.mark.parametrize(
    "days,total", [(3, 14700), (7, 31500)]
)
def test_price(days, total):
    end = f"2026-12-{days+1:02}" if days < 30 else "2026-12-31"
    q = node(
        f'calculateQuote({{dailyRate:4000,deposit:20000}},"2026-12-01","{end}",{{insurance:true,childSeat:true}},"2026-12-01")'
    )
    assert q["total"] == total and q["deposit"] == 20000


@pytest.mark.parametrize(
    "start,end",
    [
        ("2026-02-30", "2026-03-02"),
    ],
)
def test_invalid_dates(start, end):
    assert "error" in node(
        f'calculateQuote({{dailyRate:4000,deposit:0}},"{start}","{end}",{{}},"2026-12-01")'
    )


@pytest.mark.parametrize(
    "old,new,role,allowed",
    [
        ("confirmed", "active", "client", False),
    ],
)
def test_transitions(old, new, role, allowed):
    result = node(f'(validateTransition("{old}","{new}","{role}"),true)')
    assert (result is True) == allowed


@pytest.mark.parametrize(
    "value,expected",
    [
        ("8 (900) 123-45-67", "+79001234567"),
        ("()()()()()", None),
    ],
)
def test_phone(value, expected):
    r = node("normalizeRussianPhone(" + json.dumps(value) + ")")
    assert (r == expected) if expected else ("error" in r)
