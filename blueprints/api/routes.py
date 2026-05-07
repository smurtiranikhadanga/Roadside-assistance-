"""
REST API Blueprint — JSON endpoints consumed by frontend JS (AJAX / fetch).
"""
from flask import Blueprint, jsonify, request as req
from flask_login import login_required, current_user
from app import db
from models.user import User
from models.mechanic import Mechanic
from models.request import Request, Payment, Review, Notification, EmergencyLog
from datetime import datetime
import razorpay, hmac, hashlib, os

api_bp = Blueprint("api", __name__)


# ────────────────────────────────────────────────────────────────────────────
# HELPERS
# ────────────────────────────────────────────────────────────────────────────
def success(data=None, message="OK", code=200):
    return jsonify({"success": True, "message": message, "data": data}), code

def error(message="Error", code=400):
    return jsonify({"success": False, "message": message}), code


# ────────────────────────────────────────────────────────────────────────────
# NEARBY MECHANICS
# ────────────────────────────────────────────────────────────────────────────
@api_bp.route("/mechanics/nearby")
@login_required
def nearby_mechanics():
    lat  = req.args.get("lat",  type=float)
    lng  = req.args.get("lng",  type=float)
    stype = req.args.get("type", "")
    radius = req.args.get("radius", 15, type=float)

    if lat is None or lng is None:
        return error("lat and lng are required")

    mechanics = Mechanic.query.filter_by(is_online=True, is_available=True,
                                         is_approved=True, is_suspended=False).all()
    result = []
    for m in mechanics:
        dist = m.distance_to(lat, lng)
        if dist <= radius:
            if stype and m.specialization and stype not in m.specialization:
                continue
            d = m.to_dict(lat, lng)
            result.append(d)

    result.sort(key=lambda x: x["distance_km"] or 999)
    return success(result)


# ────────────────────────────────────────────────────────────────────────────
# SERVICE REQUESTS
# ────────────────────────────────────────────────────────────────────────────
@api_bp.route("/requests", methods=["POST"])
@login_required
def create_request():
    data = req.get_json()
    service_type = data.get("service_type")
    user_lat     = data.get("lat")
    user_lng     = data.get("lng")
    address      = data.get("address", "")
    description  = data.get("description", "")

    if not all([service_type, user_lat, user_lng]):
        return error("service_type, lat, lng required")

    # Find best available mechanic using AI scoring
    mechanics = Mechanic.query.filter_by(is_online=True, is_available=True,
                                          is_approved=True, is_suspended=False).all()
    best = max(mechanics, key=lambda m: m.score(user_lat, user_lng), default=None)
    if not best or best.score(user_lat, user_lng) < 0:
        return error("No mechanics available nearby. Please try again in a moment.", 503)

    dist_km = best.distance_to(user_lat, user_lng)

    # Create request with dynamic pricing
    from flask import current_app
    new_req = Request(
        user_id=current_user.id,
        mechanic_id=best.id,
        service_type=service_type,
        description=description,
        user_lat=user_lat,
        user_lng=user_lng,
        user_address=address,
        status="accepted",
        accepted_at=datetime.utcnow(),
    )
    new_req.calculate_pricing(dist_km, current_app.config["PLATFORM_FEE_PERCENT"])

    # Simple AI ETA: 2 min per km + base 5 min
    new_req.ai_eta_minutes = max(5, int(dist_km * 2 + 5))

    db.session.add(new_req)

    # Mark mechanic as busy
    best.is_available = False

    # Notification to user
    notif = Notification(
        user_id=current_user.id,
        title="Request Accepted!",
        message=f"Mechanic {best.user.name} has accepted your request. ETA: {new_req.ai_eta_minutes} mins.",
        type="success",
    )
    db.session.add(notif)
    db.session.commit()

    # Notify via SocketIO
    from app import socketio
    socketio.emit("request_accepted", new_req.to_dict(), room=f"user_{current_user.id}")
    socketio.emit("new_job", new_req.to_dict(), room=f"mechanic_{best.id}")

    return success(new_req.to_dict(), "Request created and mechanic assigned!", 201)


@api_bp.route("/requests/<int:request_id>")
@login_required
def get_request(request_id):
    r = Request.query.get_or_404(request_id)
    if r.user_id != current_user.id and \
       (r.mechanic and r.mechanic.user_id != current_user.id) and \
       current_user.role != "admin":
        return error("Access denied", 403)
    return success(r.to_dict())


@api_bp.route("/requests/<int:request_id>/status", methods=["PATCH"])
@login_required
def update_request_status(request_id):
    r = Request.query.get_or_404(request_id)
    data   = req.get_json()
    status = data.get("status")
    valid  = ["traveling","reached","in_progress","completed","cancelled"]
    if status not in valid:
        return error(f"Invalid status. Must be one of {valid}")

    r.status = status
    if status == "completed":
        r.completed_at = datetime.utcnow()
        if r.mechanic:
            r.mechanic.is_available = True
            r.mechanic.total_jobs += 1
            r.mechanic.total_earnings += float(r.total_amount) * (1 - 0.15)

    db.session.commit()

    from app import socketio
    socketio.emit("status_update", {"request_id": r.id, "status": status},
                  room=f"user_{r.user_id}")
    return success({"status": status})


@api_bp.route("/requests/active")
@login_required
def active_request():
    r = Request.query.filter_by(user_id=current_user.id)\
                     .filter(Request.status.in_(["pending","accepted","traveling","reached","in_progress"]))\
                     .order_by(Request.requested_at.desc()).first()
    return success(r.to_dict() if r else None)


@api_bp.route("/requests/history")
@login_required
def request_history():
    requests = Request.query.filter_by(user_id=current_user.id)\
                            .order_by(Request.requested_at.desc()).limit(50).all()
    return success([r.to_dict() for r in requests])


# ────────────────────────────────────────────────────────────────────────────
# PAYMENTS — RAZORPAY
# ────────────────────────────────────────────────────────────────────────────
@api_bp.route("/payments/create-order", methods=["POST"])
@login_required
def create_payment_order():
    from flask import current_app
    data       = req.get_json()
    request_id = data.get("request_id")
    r          = Request.query.get_or_404(request_id)

    if r.user_id != current_user.id:
        return error("Access denied", 403)
    if r.payment and r.payment.status == "paid":
        return error("Already paid")

    rz = razorpay.Client(
        auth=(current_app.config["RAZORPAY_KEY_ID"],
              current_app.config["RAZORPAY_KEY_SECRET"])
    )
    amount_paise = int(float(r.total_amount) * 100)  # Razorpay uses paise
    order = rz.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": f"receipt_req_{r.id}",
    })

    payment = Payment(
        request_id=r.id,
        user_id=current_user.id,
        mechanic_id=r.mechanic_id,
        razorpay_order_id=order["id"],
        amount=float(r.total_amount),
        platform_fee=float(r.platform_fee),
        mechanic_payout=float(r.total_amount) - float(r.platform_fee),
        status="created",
    )
    db.session.add(payment)
    db.session.commit()

    return success({
        "order_id": order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "key_id": current_app.config["RAZORPAY_KEY_ID"],
        "request_id": r.id,
    })


@api_bp.route("/payments/verify", methods=["POST"])
@login_required
def verify_payment():
    from flask import current_app
    data       = req.get_json()
    order_id   = data.get("razorpay_order_id")
    payment_id = data.get("razorpay_payment_id")
    signature  = data.get("razorpay_signature")

    secret = current_app.config["RAZORPAY_KEY_SECRET"].encode()
    message = f"{order_id}|{payment_id}".encode()
    computed = hmac.new(secret, message, hashlib.sha256).hexdigest()

    payment = Payment.query.filter_by(razorpay_order_id=order_id).first()
    if not payment:
        return error("Payment record not found")

    if computed == signature:
        payment.razorpay_payment_id = payment_id
        payment.razorpay_signature  = signature
        payment.status = "paid"
        payment.request.status = "completed"
        payment.request.completed_at = datetime.utcnow()
        if payment.mechanic_id:
            m = Mechanic.query.get(payment.mechanic_id)
            if m:
                m.is_available = True
                m.total_earnings += float(payment.mechanic_payout)
        db.session.commit()

        # Notify user
        from app import socketio
        socketio.emit("payment_success", {"request_id": payment.request_id},
                      room=f"user_{payment.user_id}")
        return success({"status": "paid"}, "Payment verified successfully!")
    else:
        payment.status = "failed"
        db.session.commit()
        return error("Payment verification failed", 400)


# ────────────────────────────────────────────────────────────────────────────
# REVIEWS
# ────────────────────────────────────────────────────────────────────────────
@api_bp.route("/reviews", methods=["POST"])
@login_required
def submit_review():
    data       = req.get_json()
    request_id = data.get("request_id")
    rating     = data.get("rating")
    comment    = data.get("comment", "")

    r = Request.query.get_or_404(request_id)
    if r.user_id != current_user.id:
        return error("Access denied", 403)
    if r.review:
        return error("Review already submitted")
    if not (1 <= int(rating) <= 5):
        return error("Rating must be 1–5")

    review = Review(
        request_id=request_id,
        reviewer_id=current_user.id,
        mechanic_id=r.mechanic_id,
        rating=int(rating),
        comment=comment,
    )
    db.session.add(review)

    # Recalculate mechanic average rating
    from sqlalchemy import func
    mech = r.mechanic
    if mech:
        avg = db.session.query(func.avg(Review.rating)).filter_by(mechanic_id=mech.id).scalar()
        mech.rating = round(float(avg), 2)
        mech.total_reviews += 1

    db.session.commit()
    return success(None, "Review submitted. Thank you!", 201)


# ────────────────────────────────────────────────────────────────────────────
# NOTIFICATIONS
# ────────────────────────────────────────────────────────────────────────────
@api_bp.route("/notifications")
@login_required
def get_notifications():
    notifs = Notification.query.filter_by(user_id=current_user.id)\
                               .order_by(Notification.created_at.desc()).limit(20).all()
    return success([n.to_dict() for n in notifs])


@api_bp.route("/notifications/read", methods=["POST"])
@login_required
def mark_notifications_read():
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return success(None, "Marked as read")


# ────────────────────────────────────────────────────────────────────────────
# EMERGENCY LOG
# ────────────────────────────────────────────────────────────────────────────
@api_bp.route("/emergency/log", methods=["POST"])
@login_required
def log_emergency():
    data = req.get_json()
    log  = EmergencyLog(
        user_id=current_user.id,
        lat=data.get("lat"),
        lng=data.get("lng"),
        address=data.get("address"),
        note=data.get("note"),
    )
    db.session.add(log)
    db.session.commit()
    return success(None, "Emergency logged", 201)


# ────────────────────────────────────────────────────────────────────────────
# MECHANIC: update location + status
# ────────────────────────────────────────────────────────────────────────────
@api_bp.route("/mechanic/location", methods=["PATCH"])
@login_required
def update_mechanic_location():
    if current_user.role != "mechanic":
        return error("Mechanic access only", 403)
    data = req.get_json()
    m = current_user.mechanic_profile
    if not m:
        return error("Mechanic profile not found")
    m.latitude  = data.get("lat")
    m.longitude = data.get("lng")
    db.session.commit()

    from app import socketio
    # Broadcast to any active user tracking this mechanic
    active_req = Request.query.filter_by(mechanic_id=m.id)\
                              .filter(Request.status.in_(["accepted","traveling","reached"])).first()
    if active_req:
        socketio.emit("mechanic_location", {
            "lat": float(m.latitude),
            "lng": float(m.longitude),
            "request_id": active_req.id,
        }, room=f"user_{active_req.user_id}")
    return success(None)


@api_bp.route("/mechanic/toggle-status", methods=["POST"])
@login_required
def toggle_mechanic_status():
    if current_user.role != "mechanic":
        return error("Mechanic access only", 403)
    m = current_user.mechanic_profile
    m.is_online    = not m.is_online
    m.is_available = m.is_online  # offline means not available
    db.session.commit()
    return success({"is_online": m.is_online})


# ────────────────────────────────────────────────────────────────────────────
# ADMIN APIS
# ────────────────────────────────────────────────────────────────────────────
def admin_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != "admin":
            return error("Admin access only", 403)
        return f(*args, **kwargs)
    return decorated


@api_bp.route("/admin/stats")
@login_required
@admin_required
def admin_stats():
    from sqlalchemy import func
    total_users     = User.query.filter_by(role="user").count()
    total_mechanics = Mechanic.query.count()
    online_mechanics = Mechanic.query.filter_by(is_online=True).count()
    active_requests  = Request.query.filter(
        Request.status.in_(["pending","accepted","traveling","reached","in_progress"])
    ).count()
    total_revenue = db.session.query(func.sum(Payment.amount)).filter_by(status="paid").scalar() or 0

    return success({
        "total_users": total_users,
        "total_mechanics": total_mechanics,
        "online_mechanics": online_mechanics,
        "active_requests": active_requests,
        "total_revenue": float(total_revenue),
    })


@api_bp.route("/admin/revenue-chart")
@login_required
@admin_required
def revenue_chart():
    from sqlalchemy import func, cast, Date
    rows = db.session.query(
        cast(Payment.created_at, Date).label("day"),
        func.sum(Payment.amount).label("revenue")
    ).filter(Payment.status == "paid")\
     .group_by("day")\
     .order_by("day")\
     .limit(30).all()
    return success([{"date": str(r.day), "revenue": float(r.revenue)} for r in rows])


@api_bp.route("/admin/users")
@login_required
@admin_required
def admin_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return success([u.to_dict() for u in users])


@api_bp.route("/admin/users/<int:uid>/toggle-block", methods=["POST"])
@login_required
@admin_required
def toggle_block_user(uid):
    u = User.query.get_or_404(uid)
    u.is_active = not u.is_active
    db.session.commit()
    return success({"is_active": u.is_active})


@api_bp.route("/admin/mechanics/<int:mid>/approve", methods=["POST"])
@login_required
@admin_required
def approve_mechanic(mid):
    m = Mechanic.query.get_or_404(mid)
    m.is_approved = True
    db.session.commit()
    return success(None, "Mechanic approved")


@api_bp.route("/admin/mechanics/<int:mid>/suspend", methods=["POST"])
@login_required
@admin_required
def suspend_mechanic(mid):
    m = Mechanic.query.get_or_404(mid)
    m.is_suspended = not m.is_suspended
    m.is_online = False
    db.session.commit()
    return success({"is_suspended": m.is_suspended})
