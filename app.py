"""
RoadSide+ — Flask Application Factory
"""

import sys
import os
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
os.environ["AUTHLIB_INSECURE_TRANSPORT"] = "1"

class MockPkgResources:
    class DistributionNotFound(Exception): pass
    def get_distribution(self, name):
        class Dist:
            version = "mock"
        return Dist()
sys.modules['pkg_resources'] = MockPkgResources()

from flask import Flask, redirect, url_for
from flask_login import current_user
from flask_cors import CORS

from config import Config
from extensions import db, login_manager, socketio, oauth


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    CORS(app, supports_credentials=True)

    login_manager.init_app(app)
    login_manager.login_view = "auth.login"
    login_manager.login_message = "Please sign in to access that page."
    login_manager.login_message_category = "warning"

    socketio.init_app(
        app,
        async_mode=app.config["SOCKETIO_ASYNC_MODE"],
        cors_allowed_origins="*",
        logger=False, engineio_logger=False,
    )

    oauth.init_app(app)
    _cid = app.config.get("GOOGLE_CLIENT_ID") or "placeholder"
    _cs  = app.config.get("GOOGLE_CLIENT_SECRET") or "placeholder"
    oauth.register(
        name="google",
        client_id=_cid, client_secret=_cs,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

    # ── Blueprints ─────────────────────────────────────────────────────────
    from blueprints.landing.routes import landing_bp
    from blueprints.auth.routes     import auth_bp
    from blueprints.user.routes     import user_bp
    from blueprints.mechanic.routes import mechanic_bp
    from blueprints.admin.routes    import admin_bp
    from blueprints.api.routes      import api_bp
    from blueprints.ai.routes       import ai_bp

    app.register_blueprint(landing_bp,  url_prefix="")      # / → landing page
    app.register_blueprint(auth_bp,     url_prefix="/auth")
    app.register_blueprint(user_bp,     url_prefix="/user")
    app.register_blueprint(mechanic_bp, url_prefix="/mechanic")
    app.register_blueprint(admin_bp,    url_prefix="/admin")
    app.register_blueprint(api_bp,      url_prefix="/api/v1")
    app.register_blueprint(ai_bp,       url_prefix="/ai")

    # ── SocketIO events ────────────────────────────────────────────────────
    from sockets.events import register_events
    register_events(socketio)

    # ── User loader ────────────────────────────────────────────────────────
    from models.user import User

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # ── Create DB tables ───────────────────────────────────────────────────
    with app.app_context():
        from models import user, mechanic, request  # noqa: F401
        db.create_all()

    return app


# Expose globally for Vercel WSGI
app = create_app()

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
