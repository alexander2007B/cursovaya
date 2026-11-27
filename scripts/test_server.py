"""Start only the isolated Python test database; never accepts a working DB URI."""

from pymongo import MongoClient
from norde.seed import seed
from norde.app import create_app

URI = "mongodb://127.0.0.1:27017/norde_python_test?replicaSet=rs0&directConnection=true"
if __name__ == "__main__":
    c = MongoClient(URI)
    assert c.get_default_database().name == "norde_python_test"
    c.drop_database("norde_python_test")
    c.close()
    seed(URI)
    app = create_app(
        {
            "APP_MODE": "full",
            "MONGODB_URI": URI,
            "SESSION_SECRET": "isolated-python-test-secret-32-characters",
            "PRODUCTION": False,
        }
    )
    app.run(host="127.0.0.1", port=3101, threaded=True, debug=False)
