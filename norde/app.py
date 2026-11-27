"""Flask/Jinja application and compatible JSON API backed by real MongoDB."""

import base64, csv, gzip, hashlib, io, json, os, re, secrets, threading, time
from collections import defaultdict, deque
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
import bcrypt
from bson import ObjectId
from dotenv import load_dotenv
from flask import (
    Flask,
    request,
    jsonify,
    session,
    g,
    render_template,
    send_from_directory,
    Response,
)
from PIL import Image, ImageOps, UnidentifiedImageError
from pymongo import MongoClient, ReturnDocument
from pymongo.errors import DuplicateKeyError
from werkzeug.exceptions import HTTPException
from .domain import AppError, calculate_quote, validate_transition, today, can_rent
from . import validation as v
from .sessions import MongoSessions

ROOT = Path(__file__).resolve().parents[1]
BLOCKING = ["new", "confirmed", "active"]
CATEGORIES = {
    "economy": "Эконом",
    "comfort": "Комфорт",
    "business": "Бизнес",
    "premium": "Премиум",
    "suv": "Кроссоверы",
}
STATUSES = {
    "new": "Новая",
    "confirmed": "Подтверждена",
    "active": "В аренде",
    "completed": "Завершена",
    "cancelled": "Отменена",
    "available": "Доступен",
    "maintenance": "На обслуживании",
    "broken": "Неисправен",
    "rented": "В аренде",
}


def utcnow():
    return datetime.now(timezone.utc)


def oid(value):
    if not isinstance(value, str) or not re.fullmatch("[a-fA-F0-9]{24}", value):
        raise AppError(400, "Некорректный идентификатор")
    return ObjectId(value)


def safe(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat().replace("+00:00", "Z")
    if isinstance(value, dict):
        return {
            k: safe(x)
            for k, x in value.items()
            if k not in ["passwordHash", "__v", "lockVersion"]
        }
    if isinstance(value, (list, tuple)):
        return [safe(x) for x in value]
    return value


def public_user(user):
    if not user:
        return None
    return {
        **{
            k: user.get(k)
            for k in [
                "name",
                "email",
                "phone",
                "role",
                "ageConfirmed",
                "licenseConfirmed",
                "drivingExperience",
            ]
        },
        "id": str(user["_id"]),
    }


def create_app(config=None):
    load_dotenv(ROOT / ".env")
    app = Flask(
        __name__,
        template_folder=str(ROOT / "templates"),
        static_folder=str(ROOT / "static"),
    )
    app.config.update(
        APP_MODE=os.getenv("APP_MODE", "full" if os.getenv("MONGODB_URI") else "demo"),
        PRODUCTION=os.getenv("APP_ENV") == "production",
        MAX_CONTENT_LENGTH=6 * 1024 * 1024,
    )
    if config:
        app.config.update(config)
    mode = app.config["APP_MODE"]
    secret = app.config.get("SESSION_SECRET") or os.getenv("SESSION_SECRET", "")
    if mode == "full" and (len(secret) < 32 or secret.startswith("replace-")):
        raise RuntimeError("Задайте случайный SESSION_SECRET длиной от 32 символов")
    app.secret_key = secret or secrets.token_hex(32)
    app.json.ensure_ascii = False
    client = None
    db = None
    if mode == "full":
        uri = app.config.get("MONGODB_URI") or os.getenv("MONGODB_URI")
        client = MongoClient(uri, serverSelectionTimeoutMS=5000, tz_aware=True)
        db = client.get_default_database()
        db.command("ping")
        for collection, keys, unique in [
            ("users", [("email", 1)], True),
            ("cars", [("plate", 1)], True),
            ("rentals", [("number", 1)], True),
            ("cars", [("archived", 1), ("category", 1), ("dailyRate", 1)], False),
            ("rentals", [("car", 1), ("status", 1), ("from", 1), ("to", 1)], False),
            ("rentals", [("user", 1), ("createdAt", -1)], False),
            ("maintenances", [("car", 1), ("createdAt", -1)], False),
            ("events", [("createdAt", -1)], False),
        ]:
            db[collection].create_index(keys, unique=unique)
        db.python_sessions.create_index("expires", expireAfterSeconds=0)
        app.session_interface = MongoSessions(db)
    app.extensions["mongo_client"] = client
    app.extensions["mongo_db"] = db
    limiter = defaultdict(deque)
    limit_lock = threading.Lock()

    def auth_limit():
        now = time.monotonic()
        key = request.remote_addr
        with limit_lock:
            q = limiter[key]
            while q and q[0] < now - 900:
                q.popleft()
            if len(q) >= 40:
                raise AppError(429, "Слишком много попыток. Повторите через 15 минут")
            q.append(now)

    def need_user():
        if not g.user:
            raise AppError(401, "Войдите в аккаунт")

    def need_staff():
        need_user()
        if g.user["role"] not in ["manager", "admin"]:
            raise AppError(403, "Доступ только для сотрудников")

    def need_admin():
        need_user()
        if g.user["role"] != "admin":
            raise AppError(403, "Доступ только для администратора")

    def body():
        d = request.get_json(silent=True)
        if not isinstance(d, dict):
            raise AppError(400, "Некорректный JSON")
        return d

    def out(data, status=200):
        return jsonify(safe(data)), status

    def stamp(d):
        return {**d, "createdAt": utcnow(), "updatedAt": utcnow()}

    def log(action, entity, details, tx=None):
        db.events.insert_one(
            stamp(
                dict(
                    actor=g.user["_id"],
                    action=action,
                    entity=str(entity),
                    details=details,
                )
            ),
            session=tx,
        )

    def transaction(fn):
        with client.start_session() as tx:
            return tx.with_transaction(fn)

    def lock_car(car_id, tx):
        car = db.cars.find_one_and_update(
            {"_id": car_id, "archived": False},
            {"$inc": {"lockVersion": 1}},
            return_document=ReturnDocument.AFTER,
            session=tx,
        )
        if not car:
            raise AppError(404, "Автомобиль не найден")
        return car

    def overlapping(car_id, start, end):
        return {
            "car": car_id,
            "status": {"$in": BLOCKING},
            "from": {"$lt": end},
            "to": {"$gt": start},
        }

    def rental_view(r, staff=False):
        r = dict(r)
        r["car"] = db.cars.find_one(
            {"_id": r["car"]},
            {"brand": 1, "model": 1, "image": 1, "plate": 1, "mileage": 1},
        )
        if staff:
            r["user"] = public_user(db.users.find_one({"_id": r["user"]}))
        return r

    def sign_in(user):
        app.session_interface.rotate(session)
        session["userId"] = str(user["_id"])
        session["csrf"] = secrets.token_hex(32)
        return {"user": public_user(user), "csrfToken": session["csrf"]}

    @app.before_request
    def before():
        g.user = None
        if mode == "full" and session.get("userId"):
            try:
                g.user = db.users.find_one({"_id": ObjectId(session["userId"])})
            except Exception:
                g.user = None
        if request.path.startswith("/api/"):
            if mode != "full" and request.path != "/api/health":
                raise AppError(503, "Деморежим использует данные в браузере")
            if mode == "full" and request.method not in ["GET", "HEAD", "OPTIONS"]:
                token = request.headers.get("X-CSRF-Token", "")
                if (
                    not re.fullmatch("[a-f0-9]{64}", token)
                    or not session.get("csrf")
                    or not secrets.compare_digest(token, session["csrf"])
                ):
                    raise AppError(
                        403, "Сессия устарела. Обновите страницу и повторите действие"
                    )
            if request.path.startswith("/api/admin/"):
                need_staff()

    @app.after_request
    def headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
        )
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        if (
            (
                request.path.startswith("/api/cars")
                or not request.path.startswith("/api/")
            )
            and "gzip" in request.headers.get("Accept-Encoding", "")
            and response.status_code == 200
            and not response.direct_passthrough
            and not response.headers.get("Content-Encoding")
        ):
            raw = response.get_data()
            if len(raw) > 1024:
                response.set_data(gzip.compress(raw))
                response.headers["Content-Encoding"] = "gzip"
                response.vary.add("Accept-Encoding")
        return response

    @app.errorhandler(AppError)
    def app_error(e):
        return out(
            {"message": e.message, **({"fields": e.fields} if e.fields else {})},
            e.status,
        )

    @app.errorhandler(DuplicateKeyError)
    def duplicate(e):
        return out(
            {"message": "Такой email, госномер или номер записи уже используется"}, 409
        )

    @app.errorhandler(Exception)
    def unknown(e):
        if isinstance(e, HTTPException):
            return out({"message": e.description}, e.code)
        app.logger.exception("Request failed")
        return out({"message": "Не удалось выполнить запрос. Попробуйте позже"}, 500)

    @app.get("/api/health")
    def health():
        if mode == "full":
            db.command("ping")
        return out(
            {
                "status": "ok",
                "database": "connected" if mode == "full" else "browser-demo",
                "runtime": "python",
            }
        )

    @app.get("/api/auth/session")
    def auth_session():
        if not session.get("csrf"):
            session["csrf"] = secrets.token_hex(32)
        return out({"user": public_user(g.user), "csrfToken": session["csrf"]})

    @app.post("/api/auth/register")
    def register():
        auth_limit()
        d = v.credentials(body(), True)
        at = utcnow()
        user = stamp(
            {
                k: d[k]
                for k in [
                    "name",
                    "email",
                    "phone",
                    "ageConfirmed",
                    "licenseConfirmed",
                    "drivingExperience",
                ]
            }
        )
        user.update(
            role="client",
            passwordHash=bcrypt.hashpw(
                d["password"].encode(), bcrypt.gensalt(12)
            ).decode(),
            legal=dict(
                termsVersion=v.LEGAL_VERSION,
                privacyVersion=v.LEGAL_VERSION,
                consentVersion=v.LEGAL_VERSION,
                termsAcceptedAt=at,
                consentAcceptedAt=at,
            ),
        )
        user["_id"] = db.users.insert_one(user).inserted_id
        return out(sign_in(user), 201)

    @app.post("/api/auth/login")
    def login():
        auth_limit()
        d = v.credentials(body())
        user = db.users.find_one({"email": d["email"]})
        hashed = (
            user["passwordHash"]
            if user
            else "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxA2dH2CAyXJv8cQ.j9NSmQpu3W"
        )
        try:
            valid = bcrypt.checkpw(d["password"].encode(), hashed.encode())
        except ValueError:
            valid = False
        if not valid or not user:
            raise AppError(401, "Неверный email или пароль")
        return out(sign_in(user))

    @app.post("/api/auth/logout")
    def logout():
        session.clear()
        return out({"ok": True})

    @app.patch("/api/profile")
    def update_profile():
        need_user()
        d = v.profile(body())
        db.users.update_one(
            {"_id": g.user["_id"]}, {"$set": {**d, "updatedAt": utcnow()}}
        )
        g.user.update(d)
        return out({"user": public_user(g.user)})

    @app.get("/api/cars")
    def cars():
        q = request.args
        category = q.get("category", "all")
        search = q.get("search", "")
        sort = q.get("sort", "price")
        v.check(category in ["all", *CATEGORIES], "category")
        v.check(sort in ["price", "price-desc", "year"], "sort")
        v.check(len(search) <= 80, "search")
        query = {"archived": False}
        if category != "all":
            query["category"] = category
        if search:
            query["$or"] = [
                {k: {"$regex": re.escape(search), "$options": "i"}}
                for k in ["brand", "model"]
            ]
        if q.get("from") or q.get("to"):
            calculate_quote({"dailyRate": 1}, q.get("from", ""), q.get("to", ""))
            query.update(
                _id={
                    "$nin": db.rentals.distinct(
                        "car",
                        {
                            "status": {"$in": BLOCKING},
                            "from": {"$lt": q["to"]},
                            "to": {"$gt": q["from"]},
                        },
                    )
                },
                status="available",
            )
        data = list(
            db.cars.find(query).sort(
                "year" if sort == "year" else "dailyRate",
                -1 if sort in ["year", "price-desc"] else 1,
            )
        )
        rented = set(db.rentals.distinct("car", {"status": "active"}))
        return out(
            {
                "cars": [
                    {
                        **c,
                        "displayStatus": (
                            "rented" if c["_id"] in rented else c["status"]
                        ),
                    }
                    for c in data
                ]
            }
        )

    @app.get("/api/cars/<car_id>")
    def one_car(car_id):
        car = db.cars.find_one({"_id": oid(car_id), "archived": False})
        if not car:
            raise AppError(404, "Автомобиль не найден")
        reservations = list(
            db.rentals.find(
                {
                    "car": car["_id"],
                    "status": {"$in": BLOCKING},
                    "to": {"$gte": today()},
                },
                {"_id": 0, "from": 1, "to": 1},
            )
        )
        return out({"car": car, "reservations": reservations})

    @app.post("/api/quote")
    def quote():
        d = v.booking(body())
        car = db.cars.find_one({"_id": oid(d["carId"]), "archived": False})
        if not car:
            raise AppError(404, "Автомобиль не найден")
        return out(
            {
                "quote": calculate_quote(car, d["from"], d["to"], d["extras"]),
                "available": car["status"] == "available"
                and not db.rentals.find_one(
                    overlapping(car["_id"], d["from"], d["to"])
                ),
            }
        )

    @app.post("/api/rentals")
    def book():
        need_user()
        if not can_rent(g.user):
            raise AppError(403, "Подтвердите возраст, права и стаж от 1 года в профиле")
        d = v.booking(body())

        def run(tx):
            car = lock_car(oid(d["carId"]), tx)
            q = calculate_quote(car, d["from"], d["to"], d["extras"])
            if car["status"] != "available" or db.rentals.find_one(
                overlapping(car["_id"], d["from"], d["to"]), session=tx
            ):
                raise AppError(
                    409, "Автомобиль недоступен на эти даты. Выберите другой период"
                )
            r = stamp(
                dict(
                    number="AB-" + secrets.token_hex(4).upper(),
                    user=g.user["_id"],
                    car=car["_id"],
                    carName=car["brand"] + " " + car["model"],
                    status="new",
                    quote=q,
                    history=[dict(status="new", at=utcnow(), by=g.user["_id"])],
                    **{k: d[k] for k in ["from", "to", "extras", "comment"]}
                )
            )
            r["_id"] = db.rentals.insert_one(r, session=tx).inserted_id
            log("Новая заявка", r["_id"], r["number"], tx)
            return r

        return out({"rental": transaction(run)}, 201)

    @app.get("/api/rentals")
    def rentals():
        need_user()
        return out(
            {
                "rentals": [
                    rental_view(r)
                    for r in db.rentals.find({"user": g.user["_id"]}).sort(
                        "createdAt", -1
                    )
                ]
            }
        )

    @app.patch("/api/rentals/<rental_id>/status")
    def change_rental(rental_id):
        need_user()
        d = v.strict(body(), {"status", "returnMileage"}, {"status"})
        v.check(
            d["status"] in ["confirmed", "active", "completed", "cancelled"], "status"
        )
        if "returnMileage" in d:
            v.integer(d, "returnMileage", 0, 2000000)

        def run(tx):
            r = db.rentals.find_one({"_id": oid(rental_id)}, session=tx)
            if not r or (g.user["role"] == "client" and r["user"] != g.user["_id"]):
                raise AppError(404, "Аренда не найдена")
            car = lock_car(r["car"], tx)
            r = db.rentals.find_one({"_id": r["_id"]}, session=tx)
            validate_transition(r["status"], d["status"], g.user["role"])
            if d["status"] == "confirmed" and car["status"] != "available":
                raise AppError(409, "Автомобиль недоступен")
            if d["status"] == "active":
                if (
                    car["status"] != "available"
                    or r["from"] > today()
                    or r["to"] <= today()
                ):
                    raise AppError(
                        409,
                        "Выдача возможна только в период аренды для исправного автомобиля",
                    )
                if db.rentals.find_one(
                    {"car": car["_id"], "status": "active", "_id": {"$ne": r["_id"]}},
                    session=tx,
                ):
                    raise AppError(409, "Автомобиль ещё не возвращён")
            if d["status"] == "completed":
                if "returnMileage" not in d or d["returnMileage"] < car["mileage"]:
                    raise AppError(
                        400, "Укажите пробег при возврате, не меньше текущего"
                    )
                db.cars.update_one(
                    {"_id": car["_id"]},
                    {"$set": {"mileage": d["returnMileage"], "updatedAt": utcnow()}},
                    session=tx,
                )
                r["returnMileage"] = d["returnMileage"]
            r["status"] = d["status"]
            r["updatedAt"] = utcnow()
            r["history"].append(dict(status=d["status"], at=utcnow(), by=g.user["_id"]))
            db.rentals.replace_one({"_id": r["_id"]}, r, session=tx)
            log("Статус аренды", r["_id"], r["number"] + " -> " + d["status"], tx)
            return r

        return out({"rental": transaction(run)})

    @app.post("/api/admin/photos")
    def upload():
        need_admin()
        d = v.strict(body(), {"data"}, {"data"})
        value = d["data"]
        v.check(
            isinstance(value, str)
            and len(value) <= 5600000
            and re.fullmatch(
                r"data:image/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+", value
            ),
            "data",
        )
        try:
            raw = base64.b64decode(value.split(",", 1)[1], validate=True)
            if len(raw) > 4 * 1024 * 1024:
                raise ValueError()
            with Image.open(io.BytesIO(raw)) as im:
                if im.width * im.height > 20000000 or im.format not in [
                    "JPEG",
                    "PNG",
                    "WEBP",
                ]:
                    raise ValueError()
                im = ImageOps.exif_transpose(im).convert("RGB")
                im.thumbnail((1400, 1000))
                result = io.BytesIO()
                im.save(result, format="WEBP", quality=82)
        except (
            ValueError,
            UnidentifiedImageError,
            OSError,
            Image.DecompressionBombError,
        ):
            raise AppError(400, "Не удалось прочитать изображение") from None
        folder = ROOT / "uploads"
        folder.mkdir(exist_ok=True)
        name = secrets.token_hex(16) + ".webp"
        with (folder / name).open("xb") as f:
            f.write(result.getvalue())
        return out({"image": "/uploads/" + name}, 201)

    @app.get("/api/admin/overview")
    def overview():
        cs = list(db.cars.find({"archived": False}))
        rs = [rental_view(r, True) for r in db.rentals.find().sort("createdAt", -1)]
        events = list(db.events.find().sort("createdAt", -1).limit(50))
        for e in events:
            e["actor"] = (
                public_user(db.users.find_one({"_id": e.get("actor")}))
                if e.get("actor")
                else None
            )
        stats = dict(
            cars=len(cs),
            active=sum(r["status"] == "active" for r in rs),
            pending=sum(r["status"] == "new" for r in rs),
            revenue=sum(r["quote"]["total"] for r in rs if r["status"] == "completed"),
            clients=db.users.count_documents({"role": "client"}),
        )
        return out(dict(cars=cs, rentals=rs, events=events, stats=stats))

    @app.post("/api/admin/cars")
    def add_car():
        need_admin()
        car = stamp({**v.car(body()), "archived": False, "lockVersion": 0})
        car["_id"] = db.cars.insert_one(car).inserted_id
        log("Добавлен автомобиль", car["_id"], car["brand"] + " " + car["model"])
        return out({"car": car}, 201)

    @app.patch("/api/admin/cars/<car_id>")
    def update_car(car_id):
        d = v.car(body(), True, manager=g.user["role"] != "admin")

        def run(tx):
            car = lock_car(oid(car_id), tx)
            if d.get("mileage", car["mileage"]) < car["mileage"]:
                raise AppError(400, "Пробег нельзя уменьшать")
            if (
                d.get("status")
                and d["status"] != "available"
                and db.rentals.find_one(
                    {"car": car["_id"], "status": {"$in": BLOCKING}}, session=tx
                )
            ):
                raise AppError(
                    409, "Сначала отмените ожидающие заявки и завершите активную аренду"
                )
            car.update(d)
            car["updatedAt"] = utcnow()
            db.cars.replace_one({"_id": car["_id"]}, car, session=tx)
            log("Изменён автомобиль", car["_id"], car["brand"] + " " + car["model"], tx)
            return car

        return out({"car": transaction(run)})

    @app.delete("/api/admin/cars/<car_id>")
    def archive_car(car_id):
        need_admin()

        def run(tx):
            car = lock_car(oid(car_id), tx)
            if db.rentals.find_one(
                {"car": car["_id"], "status": {"$in": BLOCKING}}, session=tx
            ):
                raise AppError(
                    409, "Нельзя убрать автомобиль с незавершёнными арендами"
                )
            db.cars.update_one(
                {"_id": car["_id"]},
                {"$set": {"archived": True, "updatedAt": utcnow()}},
                session=tx,
            )
            log(
                "Автомобиль в архиве", car["_id"], car["brand"] + " " + car["model"], tx
            )

        transaction(run)
        return out({"ok": True})

    @app.get("/api/admin/maintenance")
    def maintenance():
        rows = list(db.maintenances.find().sort("createdAt", -1).limit(200))
        for r in rows:
            r["car"] = db.cars.find_one(
                {"_id": r["car"]}, {"brand": 1, "model": 1, "plate": 1}
            )
            r["author"] = public_user(db.users.find_one({"_id": r.get("author")}))
        return out({"records": rows})

    @app.post("/api/admin/maintenance")
    def add_maintenance():
        d = v.strict(
            body(),
            {"carId", "node", "wear", "mileage", "note"},
            {"carId", "node", "wear", "mileage", "note"},
        )
        v.check(
            d["node"]
            in ["Двигатель", "Тормоза", "Подвеска", "Шины", "Кузов", "Плановое ТО"],
            "node",
        )
        v.integer(d, "wear", 0, 100)
        v.integer(d, "mileage", 0, 2000000)
        v.text(d, "note", 3, 1000)

        def run(tx):
            car = lock_car(oid(d["carId"]), tx)
            if d["mileage"] < car["mileage"]:
                raise AppError(400, "Пробег осмотра не может быть меньше текущего")
            db.cars.update_one(
                {"_id": car["_id"]},
                {"$set": {"mileage": d["mileage"], "updatedAt": utcnow()}},
                session=tx,
            )
            r = stamp({**d, "car": car["_id"], "author": g.user["_id"]})
            r.pop("carId")
            r["_id"] = db.maintenances.insert_one(r, session=tx).inserted_id
            log("Технический осмотр", car["_id"], d["node"], tx)
            return r

        return out({"record": transaction(run)}, 201)

    @app.get("/api/admin/users")
    def users():
        need_admin()
        return out(
            {"users": [public_user(u) for u in db.users.find().sort("createdAt", -1)]}
        )

    @app.patch("/api/admin/users/<user_id>")
    def change_role(user_id):
        need_admin()
        d = v.strict(body(), {"role"}, {"role"})
        v.check(d["role"] in ["client", "manager", "admin"], "role")
        uid = oid(user_id)
        if uid == g.user["_id"]:
            raise AppError(400, "Нельзя изменить собственную роль")
        u = db.users.find_one_and_update(
            {"_id": uid},
            {"$set": {"role": d["role"], "updatedAt": utcnow()}},
            return_document=ReturnDocument.AFTER,
        )
        if not u:
            raise AppError(404, "Пользователь не найден")
        log("Изменена роль", uid, u["email"])
        return out({"user": public_user(u)})

    @app.get("/api/admin/export")
    def export():
        rows = [
            [
                "Номер",
                "Клиент",
                "Email",
                "Автомобиль",
                "С",
                "По",
                "Статус",
                "Стоимость, руб.",
            ]
        ]
        for r in db.rentals.find().sort("createdAt", -1):
            u = db.users.find_one({"_id": r["user"]}) or {}
            rows.append(
                [
                    r["number"],
                    u.get("name", ""),
                    u.get("email", ""),
                    r["carName"],
                    r["from"],
                    r["to"],
                    r["status"],
                    r["quote"]["total"],
                ]
            )
        stream = io.StringIO()
        writer = csv.writer(
            stream, delimiter=";", quoting=csv.QUOTE_ALL, lineterminator="\r\n"
        )
        for row in rows:
            writer.writerow(
                [
                    "'" + str(x) if str(x).startswith(("=", "+", "@", "-")) else x
                    for x in row
                ]
            )
        return Response(
            "\ufeff" + stream.getvalue(),
            content_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=rentals.csv"},
        )

    @app.get("/images/<path:name>")
    def images(name):
        return send_from_directory(ROOT / "static/images", name)

    @app.get("/fonts/<path:name>")
    def fonts(name):
        return send_from_directory(ROOT / "static/fonts", name)

    @app.get("/uploads/<path:name>")
    def uploads(name):
        return send_from_directory(ROOT / "uploads", name)

    @app.get("/legal.css")
    def legal_css():
        return send_from_directory(ROOT / "static", "legal.css")

    @app.get("/<name>.html")
    def legal(name):
        if name not in ["privacy", "terms", "consent"]:
            raise AppError(404, "Страница не найдена")
        return send_from_directory(ROOT / "static", name + ".html")

    @app.get("/")
    @app.get("/catalog")
    @app.get("/conditions")
    @app.get("/account")
    @app.get("/admin")
    @app.get("/cars/<car_id>")
    def page(car_id=None):
        page = "car" if car_id else (request.path.strip("/") or "home")
        return render_template(
            "page.html",
            page=page,
            mode=mode,
            user=public_user(g.user),
            categories=CATEGORIES,
            statuses=STATUSES,
            year=datetime.now().year,
            car_id=car_id or "",
        )

    return app
