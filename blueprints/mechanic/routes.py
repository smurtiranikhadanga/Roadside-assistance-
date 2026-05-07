"""Mechanic blueprint — serves mechanic dashboard template."""
from flask import Blueprint, render_template, redirect, url_for, current_app
from flask_login import login_required, current_user

mechanic_bp = Blueprint("mechanic", __name__)


@mechanic_bp.route("/dashboard")
@login_required
def dashboard():
    if current_user.role != "mechanic":
        return redirect(url_for("user.dashboard"))
    from models.request import Request
    active_req = Request.query.filter_by(mechanic_id=current_user.mechanic_profile.id
                                         if current_user.mechanic_profile else 0)\
                              .filter(Request.status.in_(
                                  ["accepted","traveling","reached","in_progress"]
                              )).first() if current_user.mechanic_profile else None
    return render_template("mechanic_dashboard.html",
                           maps_key=current_app.config["GOOGLE_MAPS_API_KEY"],
                           active_request=active_req)
