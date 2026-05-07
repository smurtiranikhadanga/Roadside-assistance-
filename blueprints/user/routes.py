"""User blueprint — serves user dashboard."""
from flask import Blueprint, render_template, redirect, url_for, request, flash, current_app
from flask_login import login_required, current_user
from extensions import db

user_bp = Blueprint("user", __name__)


@user_bp.route("/dashboard")
@login_required
def dashboard():
    if current_user.role == "mechanic":
        return redirect(url_for("mechanic.dashboard"))
    if current_user.role == "admin":
        return redirect(url_for("admin.dashboard"))
    return render_template("user_dashboard.html",
                           config=current_app.config,
                           maps_key=current_app.config["GOOGLE_MAPS_API_KEY"])


@user_bp.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    if request.method == "POST":
        current_user.phone             = request.form.get("phone")
        current_user.vehicle_make      = request.form.get("vehicle_make")
        current_user.vehicle_model     = request.form.get("vehicle_model")
        current_user.vehicle_year      = request.form.get("vehicle_year") or None
        current_user.license_plate     = request.form.get("license_plate")
        current_user.saved_address     = request.form.get("saved_address")
        current_user.emergency_contact = request.form.get("emergency_contact")
        db.session.commit()
        flash("Profile updated successfully! ✅", "success")
    return render_template("user_dashboard.html", config=current_app.config, section="profile")
