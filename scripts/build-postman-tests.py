import json
from pathlib import Path

items = []


def req(name, method, path, status, body=None, extra=""):
    request = {
        "method": method,
        "header": [
            {"key": "Content-Type", "value": "application/json"},
            {"key": "X-CSRF-Token", "value": "{{csrfToken}}"},
        ],
        "url": "{{baseUrl}}" + path,
    }
    if body is not None:
        request["body"] = {"mode": "raw", "raw": json.dumps(body, ensure_ascii=False)}
    script = (
        f'pm.test("HTTP {status}",()=>pm.response.to.have.status({status}));\n' + extra
    )
    items.append(
        {
            "name": name,
            "request": request,
            "event": [
                {
                    "listen": "test",
                    "script": {"type": "text/javascript", "exec": script.splitlines()},
                }
            ],
        }
    )


session = 'const d=pm.response.json();pm.collectionVariables.set("csrfToken",d.csrfToken);pm.test("CSRF present",()=>pm.expect(d.csrfToken).to.be.a("string"));'
req("01 Health", "GET", "/api/health", 200)
req("02 Session", "GET", "/api/auth/session", 200, extra=session)
req(
    "03 Catalog",
    "GET",
    "/api/cars",
    200,
    extra='const c=pm.response.json().cars.find(c=>c.status==="available");pm.collectionVariables.set("carId",c._id);pm.collectionVariables.set("mileage",c.mileage);pm.test("12 cars",()=>pm.expect(pm.response.json().cars.length).to.eql(12));',
)
req(
    "04 Invalid dates",
    "POST",
    "/api/quote",
    400,
    {"carId": "{{carId}}", "from": "2026-02-30", "to": "2026-03-03"},
)
req(
    "05 Quote",
    "POST",
    "/api/quote",
    200,
    {"carId": "{{carId}}", "from": "{{from}}", "to": "{{to}}", "extras": {}},
    'pm.test("one day",()=>pm.expect(pm.response.json().quote.days).to.eql(1));',
)
body = {
    "name": "Postman Client",
    "email": "postman{{stamp}}@example.test",
    "phone": "+79002223344",
    "password": "Postman2026!",
    "ageConfirmed": True,
    "licenseConfirmed": True,
    "drivingExperience": 3,
    "termsAccepted": True,
    "personalDataConsent": True,
    "legalVersion": "2026-11-23.1",
}
req(
    "06 Missing consent",
    "POST",
    "/api/auth/register",
    400,
    {**body, "personalDataConsent": False},
)
req(
    "07 Registration",
    "POST",
    "/api/auth/register",
    201,
    body,
    session
    + 'pm.test("client role",()=>pm.expect(d.user.role).to.eql("client"));pm.test("password hidden",()=>pm.expect(d.user).not.to.have.property("passwordHash"));',
)
req("08 Client cannot manage users", "GET", "/api/admin/users", 403)
req(
    "09 Booking",
    "POST",
    "/api/rentals",
    201,
    {"carId": "{{carId}}", "from": "{{from}}", "to": "{{to}}", "extras": {}},
    'pm.collectionVariables.set("rentalId",pm.response.json().rental._id);',
)
req(
    "10 Client cannot confirm",
    "PATCH",
    "/api/rentals/{{rentalId}}/status",
    409,
    {"status": "confirmed"},
)
req(
    "11 Cancel",
    "PATCH",
    "/api/rentals/{{rentalId}}/status",
    200,
    {"status": "cancelled"},
)
req("12 Logout", "POST", "/api/auth/logout", 200, {})
req("13 New session", "GET", "/api/auth/session", 200, extra=session)
req(
    "14 Wrong password",
    "POST",
    "/api/auth/login",
    401,
    {"email": "admin@avtobaza.test", "password": "Wrongpass2026!"},
)
req(
    "15 Admin login",
    "POST",
    "/api/auth/login",
    200,
    {"email": "admin@avtobaza.test", "password": "Avtobaza2026!"},
    session + 'pm.test("admin role",()=>pm.expect(d.user.role).to.eql("admin"));',
)
d = {
    "info": {
        "name": "NORDE automated API acceptance tests",
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        "description": "Only isolated local test database. Compact collection: registration, access and rental cancellation.",
    },
    "variable": [{"key": "baseUrl", "value": "http://127.0.0.1:3001"}],
    "event": [
        {
            "listen": "prerequest",
            "script": {
                "exec": [
                    'if (pm.info.requestName === "01 Health" || !pm.collectionVariables.get("stamp")) { const now=new Date();const from=new Date(now.getTime()+3*3600000).toISOString().slice(0,10);const to=new Date(from+"T00:00:00Z");to.setUTCDate(to.getUTCDate()+1);pm.collectionVariables.set("stamp",String(Date.now()).slice(-7));pm.collectionVariables.set("from",from);pm.collectionVariables.set("to",to.toISOString().slice(0,10)); }'
                ]
            },
        }
    ],
    "item": items,
}
# Compact acceptance collection: 15 requests and one status assertion per request.
import re
for item in d["item"]:
    lines = item["event"][0]["script"]["exec"]
    extra = "\n".join(lines[1:])
    extra = re.sub(r"pm\.test\([^;]*;\s*", "", extra)
    item["event"][0]["script"]["exec"] = [lines[0], extra]
Path("docs/postman_collection.json").write_text(
    json.dumps(d, ensure_ascii=False, indent=2)
)
