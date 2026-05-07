"""
RoadSide+ — Flask Application Factory
Initialises all extensions and registers blueprints.
"""
import eventlet
eventlet.monkey_patch()  # must be first for async SocketIO

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_socketio import SocketIO
from flask_cors import CORS
from authlib.integrations.flask_client import OAuth

from config import Config

# ── Extensions (initialised without app, bound in create_app) ─────────────
db = SQLAlchemy()
login_manager = LoginManager()
socketio = SocketIO()
oauth = OAuth()


def create_app(config_class=Config):
    """Application factory — create and configure the Flask app."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # ── Bind extensions ───────────────────────────────────────────────────
    db.init_app(app)
    CORS(app, supports_credentials=True)

    login_manager.init_app(app)
    login_manager.login_view = "auth.login"
    login_manager.login_message_category = "warning"

    socketio.init_app(
        app,
        async_mode=app.config["SOCKETIO_ASYNC_MODE"],
        cors_allowed_origins="*",
        logger=False,
        engineio_logger=False,
    )

    oauth.init_app(app)
    # Register Google as an OAuth provider
    oauth.register(
        name="google",
        client_id=app.config["GOOGLE_CLIENT_ID"],
        client_secret=app.config["GOOGLE_CLIENT_SECRET"],
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

    # ── Register Blueprints ───────────────────────────────────────────────
    from blueprints.auth.routes   import auth_bp
    from blueprints.user.routes   import user_bp
    from blueprints.mechanic.routes import mechanic_bp
    from blueprints.admin.routes  import admin_bp
    from blueprints.api.routes    import api_bp
    from blueprints.ai.routes     import ai_bp

    app.register_blueprint(auth_bp,     url_prefix="/auth")
    app.register_blueprint(user_bp,     url_prefix="/user")
    app.register_blueprint(mechanic_bp, url_prefix="/mechanic")
    app.register_blueprint(admin_bp,    url_prefix="/admin")
    app.register_blueprint(api_bp,      url_prefix="/api/v1")
    app.register_blueprint(ai_bp,       url_prefix="/ai")

    # ── Register SocketIO events ──────────────────────────────────────────
    from sockets.events import register_events
    register_events(socketio)

    # ── Root redirect ─────────────────────────────────────────────────────
    from flask import redirect, url_for
    from flask_login import current_user

    @app.route("/")
    def index():
        if current_user.is_authenticated:
            if current_user.role == "admin":
                return redirect(url_for("admin.dashboard"))
            elif current_user.role == "mechanic":
                return redirect(url_for("mechanic.dashboard"))
            return redirect(url_for("user.dashboard"))
        return redirect(url_for("auth.login"))

    # ── User loader for Flask-Login ───────────────────────────────────────
    from models.user import User

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # ── Create tables if they don't exist ─────────────────────────────────
    with app.app_context():
        db.create_all()

    return app


# ── Entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    app = create_app()
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
