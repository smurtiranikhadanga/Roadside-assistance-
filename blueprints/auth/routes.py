"""
Auth Blueprint — Email/Password + Google OAuth 2.0
"""
from flask import Blueprint, render_template, redirect, url_for, request, flash, session
from flask_login import login_user, logout_user, login_required, current_user

auth_bp = Blueprint("auth", __name__)


# ── Login (GET) ──────────────────────────────────────────────
@auth_bp.route("/login", methods=["GET"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("landing.home"))
    return render_template("login.html")


# ── Email/Password Login (POST) ──────────────────────────────
@auth_bp.route("/login", methods=["POST"])
def login_post():
    from models.user import User
    from extensions import db

    email    = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "")
    remember = bool(request.form.get("remember"))

    if not email or not password:
        flash("Please enter your email and password.", "warning")
        return redirect(url_for("auth.login"))

    user = User.query.filter_by(email=email).first()

    if not user:
        flash("No account found with that email. Please register first.", "danger")
        return redirect(url_for("auth.login"))

    if not user.check_password(password):
        flash("Incorrect password. Please try again.", "danger")
        return redirect(url_for("auth.login"))

    if not user.is_active:
        flash("Your account has been suspended. Contact support.", "danger")
        return redirect(url_for("auth.login"))

    login_user(user, remember=remember)

    # Redirect based on role
    svc = session.pop("pending_service", None)
    if user.role == "admin":
        return redirect(url_for("admin.dashboard"))
    if user.role == "mechanic":
        return redirect(url_for("mechanic.dashboard"))
    dest = url_for("user.dashboard") + (f"?service={svc}" if svc else "")
    return redirect(dest)


# ── Register (GET) ───────────────────────────────────────────
@auth_bp.route("/register", methods=["GET"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("landing.home"))
    return render_template("register.html")


# ── Register (POST) ──────────────────────────────────────────
@auth_bp.route("/register", methods=["POST"])
def register_post():
    from models.user import User
    from extensions import db

    name     = request.form.get("name", "").strip()
    email    = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "")
    confirm  = request.form.get("confirm_password", "")
    role     = request.form.get("role", "user")
    phone    = request.form.get("phone", "").strip()

    # Validation
    if not name or not email or not password:
        flash("All required fields must be filled.", "warning")
        return redirect(url_for("auth.register"))

    if len(password) < 8:
        flash("Password must be at least 8 characters.", "warning")
        return redirect(url_for("auth.register"))

    if password != confirm:
        flash("Passwords do not match.", "warning")
        return redirect(url_for("auth.register"))

    if role not in ("user", "mechanic"):
        role = "user"

    if User.query.filter_by(email=email).first():
        flash("An account with that email already exists. Please sign in.", "warning")
        return redirect(url_for("auth.login"))

    user = User(
        name=name,
        email=email,
        phone=phone or None,
        role=role,
        is_verified=False,
        avatar=f"https://ui-avatars.com/api/?name={name.replace(' ', '+')}&background=FF6B35&color=fff&size=128",
    )
    user.set_password(password)
    db.session.add(user)

    # If mechanic, create mechanic profile
    if role == "mechanic":
        from models.mechanic import Mechanic
        mechanic = Mechanic(
            user=user,
            specialization="",
            experience_years=0,
            is_online=False,
            is_available=False,
            is_approved=False,   # needs admin approval
        )
        db.session.add(mechanic)

    db.session.commit()

    flash(f"🎉 Account created! Welcome, {name}. Please sign in.", "success")
    return redirect(url_for("auth.login"))


# ── Google OAuth ─────────────────────────────────────────────
@auth_bp.route("/google")
def google_login():
    from extensions import oauth
    redirect_uri = url_for("auth.google_callback", _external=True)
    return oauth.google.authorize_redirect(redirect_uri)


@auth_bp.route("/google/callback")
def google_callback():
    from extensions import oauth, db
    from models.user import User

    try:
        token = oauth.google.authorize_access_token()
        userinfo = token.get("userinfo") or oauth.google.parse_id_token(token, nonce=None)
        if not userinfo:
            userinfo = oauth.google.userinfo()
    except Exception as e:
        flash("Google login failed. Please try again.", "danger")
        return redirect(url_for("auth.login"))

    google_id = userinfo.get("sub") or userinfo.get("id")
    email     = userinfo.get("email", "")
    name      = userinfo.get("name", email.split("@")[0])
    avatar    = userinfo.get("picture", "")

    # Find or create user
    user = User.query.filter_by(google_id=google_id).first()
    if not user:
        user = User.query.filter_by(email=email).first()
        if user:
            user.google_id = google_id
            user.avatar    = avatar or user.avatar
        else:
            user = User(
                google_id=google_id, name=name, email=email,
                avatar=avatar, role="user", is_verified=True,
            )
            db.session.add(user)
    db.session.commit()

    if not user.is_active:
        flash("Your account has been suspended. Contact support.", "danger")
        return redirect(url_for("auth.login"))

    login_user(user, remember=True)
    flash(f"👋 Welcome back, {name}!", "success")

    svc = session.pop("pending_service", None)
    if user.role == "admin":    return redirect(url_for("admin.dashboard"))
    if user.role == "mechanic": return redirect(url_for("mechanic.dashboard"))
    dest = url_for("user.dashboard") + (f"?service={svc}" if svc else "")
    return redirect(dest)


# ── Logout ───────────────────────────────────────────────────
@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    flash("You've been signed out. Stay safe! 🚗", "info")
    return redirect(url_for("landing.home"))
