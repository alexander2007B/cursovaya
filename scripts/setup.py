"""Create local configuration without overwriting existing secrets or data."""

from pathlib import Path
import secrets

p = Path(__file__).resolve().parents[1] / ".env"
if not p.exists():
    p.write_text(
        "APP_MODE=full\nAPP_ENV=development\nPORT=3000\nMONGODB_URI=mongodb://127.0.0.1:27017/avtobaza?replicaSet=rs0&directConnection=true\nSESSION_SECRET="
        + secrets.token_hex(32)
        + "\n"
    )
print("Configuration ready:", p)
