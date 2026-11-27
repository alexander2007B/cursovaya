"""Opaque, signed cookie ID; session data lives only in MongoDB."""

import hashlib, secrets
from datetime import datetime, timedelta, timezone
from flask.sessions import SessionInterface, SessionMixin
from werkzeug.datastructures import CallbackDict
from itsdangerous import TimestampSigner, BadSignature, SignatureExpired


class MongoSession(CallbackDict, SessionMixin):
    def __init__(self, data=None, sid=None):
        super().__init__(data, lambda self: setattr(self, "modified", True))
        self.sid = sid or secrets.token_urlsafe(32)
        self.modified = False


class MongoSessions(SessionInterface):
    session_class = MongoSession

    def __init__(self, db):
        self.store = db.python_sessions

    @staticmethod
    def key(sid):
        return hashlib.sha256(sid.encode()).hexdigest()

    def signer(self, app):
        return TimestampSigner(app.secret_key, salt="norde-python-session")

    def open_session(self, app, request):
        cookie = request.cookies.get("avtobaza.sid")
        if cookie:
            try:
                sid = self.signer(app).unsign(cookie, max_age=604800).decode()
                row = self.store.find_one(
                    {
                        "_id": self.key(sid),
                        "expires": {"$gt": datetime.now(timezone.utc)},
                    }
                )
                if row:
                    return MongoSession(row["data"], sid)
            except (BadSignature, SignatureExpired, UnicodeError):
                pass
        return MongoSession()

    def save_session(self, app, session, response):
        if not session.modified:
            return
        response.vary.add("Cookie")
        if not session:
            self.store.delete_one({"_id": self.key(session.sid)})
            response.delete_cookie(
                "avtobaza.sid",
                path="/",
                httponly=True,
                samesite="Lax",
                secure=app.config["PRODUCTION"],
            )
            return
        self.store.replace_one(
            {"_id": self.key(session.sid)},
            {
                "_id": self.key(session.sid),
                "data": dict(session),
                "expires": datetime.now(timezone.utc) + timedelta(days=7),
            },
            upsert=True,
        )
        response.set_cookie(
            "avtobaza.sid",
            self.signer(app).sign(session.sid).decode(),
            max_age=604800,
            httponly=True,
            secure=app.config["PRODUCTION"],
            samesite="Lax",
            path="/",
        )

    def rotate(self, session):
        self.store.delete_one({"_id": self.key(session.sid)})
        session.clear()
        session.sid = secrets.token_urlsafe(32)
