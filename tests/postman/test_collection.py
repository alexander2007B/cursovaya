"""Execute the 15 HTTP scenarios described in the Postman collection, in Python.
This runner does not pretend to execute Postman's JavaScript sandbox. The same
collection can be imported into the standalone Postman app for that purpose.
"""

import json, re, uuid
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import pytest, requests

BASE = "http://127.0.0.1:3101"
COLLECTION = json.loads(Path("docs/postman_collection.json").read_text())


@pytest.fixture(scope="module")
def state():
    date = datetime.now(ZoneInfo("Europe/Moscow")).date()
    s = requests.Session()
    values = {
        "baseUrl": BASE,
        "stamp": uuid.uuid4().hex,
        "from": str(date),
        "to": str(date + timedelta(days=1)),
        "csrfToken": "",
    }
    yield s, values
    s.close()


@pytest.mark.parametrize("item", COLLECTION["item"], ids=lambda item: item["name"])
def test_postman_http_scenario(item, state):
    s, values = state

    def expand(value):
        return re.sub(r"\{\{(\w+)\}\}", lambda m: str(values.get(m[1], m[0])), value)

    request = item["request"]
    method = request["method"]
    url = request["url"]
    url = url["raw"] if isinstance(url, dict) else url
    payload = json.loads(expand(request["body"]["raw"])) if "body" in request else None
    response = s.request(
        method,
        expand(url),
        json=payload,
        headers={"X-CSRF-Token": values["csrfToken"]},
        timeout=10,
    )
    expected = int(re.search(r"HTTP (\d+)", item["event"][0]["script"]["exec"][0])[1])
    assert response.status_code == expected, (
        item["name"],
        response.status_code,
        response.text,
    )
    data = response.json()
    if "csrfToken" in data:
        values["csrfToken"] = data["csrfToken"]
    if item["name"].startswith("03 "):
        values["carId"] = next(
            c["_id"] for c in data["cars"] if c["status"] == "available"
        )
    if "rental" in data:
        values["rentalId"] = data["rental"]["_id"]
