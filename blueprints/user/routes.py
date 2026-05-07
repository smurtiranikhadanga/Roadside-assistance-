"""User blueprint — serves user dashboard template."""
from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user
from flask import current_app

user_bp = Blueprint("user", __name__)


@user_bp.route("/dashboard")
@login_required
def dashboard():
    if current_user.role not in ("user", "admin"):
        return redirect(url_for("mechanic.dashboard"))
    maps_key = current_app.config["GOOGLE_MAPS_API_KEY"]
    razorpay_key = current_app.config["RAZORPAY_KEY_ID"]
    return render_template("user_dashboard.html",
                           maps_key=maps_key,
                           razorpay_key=razorpay_key)


@user_bp.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    from flask import request, flash
    from app import db
    if request.method == "POST":
        current_user.phone          = request.form.get("phone")
        current_user.vehicle_make   = request.form.get("vehicle_make")
        current_user.vehicle_model  = request.form.get("vehicle_model")
        current_user.vehicle_year   = request.form.get("vehicle_year") or None
        current_user.license_plate  = request.form.get("license_plate")
        current_user.saved_address  = request.form.get("saved_address")
        current_user.emergency_contact = request.form.get("emergency_contact")
        db.session.commit()
        flash("Profile updated successfully!", "success")
    return render_template("user_dashboard.html",
                           maps_key=current_app.config["GOOGLE_MAPS_API_KEY"],
                           razorpay_key=current_app.config["RAZORPAY_KEY_ID"],
                           section="profile")
