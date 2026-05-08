"""
RoadSide+ Configuration
Loads all settings from environment variables via .env file.
"""
import os
from dotenv import load_dotenv

load_dotenv()
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"


class Config:
    # ── Core Flask ─────────────────────────────────────────────────────────
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"

    # ── Database ───────────────────────────────────────────────────────────
    # SQLite by default — runs with zero setup. Set USE_SQLITE=0 for MySQL.
    USE_SQLITE = os.getenv("USE_SQLITE", "1") == "1"

    if USE_SQLITE:
        SQLALCHEMY_DATABASE_URI = "sqlite:///roadside.db"
    else:
        _h = os.getenv("DB_HOST", "localhost")
        _p = os.getenv("DB_PORT", "3306")
        _n = os.getenv("DB_NAME", "roadside_db")
        _u = os.getenv("DB_USER", "root")
        _pw = os.getenv("DB_PASSWORD", "")
        SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{_u}:{_pw}@{_h}:{_p}/{_n}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 300}

    # ── Google OAuth ───────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

    # ── Google Maps ────────────────────────────────────────────────────────
    GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

    # ── OpenAI ─────────────────────────────────────────────────────────────
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

    # ── Razorpay ───────────────────────────────────────────────────────────
    RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

    # ── Platform Settings ──────────────────────────────────────────────────
    PLATFORM_FEE_PERCENT = float(os.getenv("PLATFORM_FEE_PERCENT", "15"))
    BASE_URL = os.getenv("BASE_URL", "http://localhost:5000")

    # ── SocketIO ───────────────────────────────────────────────────────────
    SOCKETIO_ASYNC_MODE = "threading"
