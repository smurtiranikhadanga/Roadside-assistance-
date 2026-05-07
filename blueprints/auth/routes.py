"""
Auth Blueprint — Google OAuth 2.0 login/logout + demo login.
All extensions imported from extensions.py to avoid circular imports.
"""
from flask import Blueprint, redirect, url_for, session, flash, current_app, render_template
from flask_login import login_user, logout_user, login_required, current_user
from extensions import oauth, db

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login")
def login():
    if current_user.is_authenticated:
        return redirect(url_for("landing.home"))
    return render_template("login.html")


@auth_bp.route("/google")
def google_login():
    cid = current_app.config.get("GOOGLE_CLIENT_ID", "")
    if not cid or cid == "YOUR_GOOGLE_CLIENT_ID":
        flash("Google OAuth not configured yet. Use a demo account to explore.", "warning")
        return redirect(url_for("auth.login"))
    redirect_uri = url_for("auth.google_callback", _external=True)
    return oauth.google.authorize_redirect(redirect_uri)


@auth_bp.route("/google/callback")
def google_callback():
    from models.user import User
    token     = oauth.google.authorize_access_token()
    user_info = token.get("userinfo") or oauth.google.userinfo()
    google_id = user_info["sub"]
    email     = user_info["email"]
    name      = user_info.get("name", email.split("@")[0])
    avatar    = user_info.get("picture", "")

    user = User.query.filter_by(google_id=google_id).first()
    if not user:
        user = User.query.filter_by(email=email).first()
        if user:
            user.google_id = google_id
            user.avatar = avatar
        else:
            user = User(google_id=google_id, name=name, email=email,
                        avatar=avatar, role="user", is_verified=True)
            db.session.add(user)
    else:
        user.avatar = avatar
    db.session.commit()

    if not user.is_active:
        flash("Account suspended. Contact support.", "danger")
        return redirect(url_for("auth.login"))

    login_user(user, remember=True)
    if user.role == "admin":    return redirect(url_for("admin.dashboard"))
    if user.role == "mechanic": return redirect(url_for("mechanic.dashboard"))
    svc = session.pop("pending_service", None)
    dest = url_for("user.dashboard") + (f"?service={svc}" if svc else "")
    return redirect(dest)


@auth_bp.route("/demo-login/<role>")
def demo_login(role):
    """Dev-only demo login — no OAuth needed."""
    from models.user import User
    from models.mechanic import Mechanic

    if role not in ("user", "mechanic", "admin"):
        flash("Invalid role", "danger")
        return redirect(url_for("auth.login"))

    info = {
        "user":     ("Demo User",     "demo_user@dev",     "https://ui-avatars.com/api/?name=Demo+User&background=FF6B35&color=fff&size=100"),
        "mechanic": ("Demo Mechanic", "demo_mechanic@dev", "https://ui-avatars.com/api/?name=Demo+Mechanic&background=00B894&color=fff&size=100"),
        "admin":    ("Demo Admin",    "demo_admin@dev",    "https://ui-avatars.com/api/?name=Demo+Admin&background=6C5CE7&color=fff&size=100"),
    }
    name, email, avatar = info[role]

    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(name=name, email=email, role=role, avatar=avatar,
                    is_verified=True, is_active=True, phone="9999999999")
        db.session.add(user)
        if role == "mechanic":
            db.session.flush()
            m = Mechanic(
                user_id=user.id,
                specialization="flat_tire,battery,fuel,engine,towing",
                experience_years=3, vehicle_number="KA-01-DEMO-001",
                vehicle_type="Motorcycle", latitude=12.9716, longitude=77.5946,
                is_online=True, is_available=True, is_approved=True,
                rating=4.8, total_jobs=42,
            )
            db.session.add(m)
        db.session.commit()

    login_user(user, remember=True)
    flash(f"👋 Welcome, {name}!", "success")
    if role == "admin":    return redirect(url_for("admin.dashboard"))
    if role == "mechanic": return redirect(url_for("mechanic.dashboard"))
    svc = session.pop("pending_service", None)
    dest = url_for("user.dashboard") + (f"?service={svc}" if svc else "")
    return redirect(dest)


@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    session.clear()
    flash("See you soon! 👋", "info")
    return redirect(url_for("auth.login"))
