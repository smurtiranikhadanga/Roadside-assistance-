"""
Auth Blueprint — Google OAuth 2.0 login/logout + session management.
"""
from flask import Blueprint, redirect, url_for, session, flash, current_app
from flask_login import login_user, logout_user, login_required, current_user
from app import db, oauth
from models.user import User

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login")
def login():
    """Render the login page (served via template)."""
    from flask import render_template
    if current_user.is_authenticated:
        return redirect(url_for("index"))
    return render_template("login.html")


@auth_bp.route("/google")
def google_login():
    """Initiate Google OAuth flow."""
    redirect_uri = url_for("auth.google_callback", _external=True)
    return oauth.google.authorize_redirect(redirect_uri)


@auth_bp.route("/google/callback")
def google_callback():
    """Handle Google OAuth callback, upsert user, start session."""
    token = oauth.google.authorize_access_token()
    user_info = token.get("userinfo") or oauth.google.userinfo()

    google_id = user_info["sub"]
    email     = user_info["email"]
    name      = user_info.get("name", email.split("@")[0])
    avatar    = user_info.get("picture", "")

    # Upsert user
    user = User.query.filter_by(google_id=google_id).first()
    if not user:
        # Check if email already exists (previously registered another way)
        user = User.query.filter_by(email=email).first()
        if user:
            user.google_id = google_id
            user.avatar = avatar
        else:
            user = User(
                google_id=google_id,
                name=name,
                email=email,
                avatar=avatar,
                role="user",
                is_verified=True,
            )
            db.session.add(user)
    else:
        user.avatar = avatar  # always refresh avatar

    db.session.commit()

    if not user.is_active:
        flash("Your account has been suspended. Contact support.", "danger")
        return redirect(url_for("auth.login"))

    login_user(user, remember=True)

    if user.role == "admin":
        return redirect(url_for("admin.dashboard"))
    elif user.role == "mechanic":
        return redirect(url_for("mechanic.dashboard"))
    return redirect(url_for("user.dashboard"))


@auth_bp.route("/logout")
@login_required
def logout():
    """Log out current user and clear session."""
    logout_user()
    session.clear()
    flash("You have been logged out successfully.", "info")
    return redirect(url_for("auth.login"))
