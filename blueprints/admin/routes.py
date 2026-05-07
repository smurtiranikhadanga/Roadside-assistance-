"""Admin blueprint — serves admin dashboard template."""
from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user

admin_bp = Blueprint("admin", __name__)


def admin_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != "admin":
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated


@admin_bp.route("/dashboard")
@login_required
@admin_required
def dashboard():
    from models.user import User
    from models.mechanic import Mechanic
    from models.request import Request, Payment
    from app import db
    from sqlalchemy import func

    stats = {
        "total_users": User.query.filter_by(role="user").count(),
        "total_mechanics": Mechanic.query.count(),
        "active_requests": Request.query.filter(
            Request.status.in_(["pending","accepted","traveling","reached","in_progress"])
        ).count(),
        "total_revenue": float(
            db.session.query(func.sum(Payment.amount)).filter_by(status="paid").scalar() or 0
        ),
        "online_mechanics": Mechanic.query.filter_by(is_online=True).count(),
        "pending_approvals": Mechanic.query.filter_by(is_approved=False).count(),
    }
    mechanics = Mechanic.query.all()
    users = User.query.order_by(User.created_at.desc()).limit(20).all()
    requests = Request.query.order_by(Request.requested_at.desc()).limit(20).all()
    return render_template("admin_dashboard.html",
                           stats=stats,
                           mechanics=mechanics,
                           users=users,
                           requests=requests)
