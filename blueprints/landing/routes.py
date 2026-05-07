from flask import Blueprint, render_template, redirect, url_for, session
from flask_login import current_user

landing_bp = Blueprint("landing", __name__)


@landing_bp.route("/")
def home():
    return render_template("landing.html")


@landing_bp.route("/service/<service>")
def service_redirect(service):
    """
    If user is logged in → go to dashboard with service pre-selected.
    If not → save service in session, redirect to login.
    """
    valid = {"battery","towing","fuel","other","tracking","service","flat_tire"}
    if service not in valid:
        return redirect(url_for("landing.home"))

    if current_user.is_authenticated:
        session["pending_service"] = service
        return redirect(url_for("user.dashboard"))

    session["pending_service"] = service
    return redirect(url_for("auth.login"))
