"""
Request, Payment, Review, Notification, EmergencyLog models.
"""
from extensions import db
from datetime import datetime


class Request(db.Model):
    __tablename__ = "requests"

    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    mechanic_id     = db.Column(db.Integer, db.ForeignKey("mechanics.id"))
    service_type    = db.Column(db.Enum("flat_tire","battery","fuel","engine","towing","other"), nullable=False)
    description     = db.Column(db.Text)
    user_lat        = db.Column(db.Numeric(10, 8), nullable=False)
    user_lng        = db.Column(db.Numeric(11, 8), nullable=False)
    user_address    = db.Column(db.String(300))
    status          = db.Column(
        db.Enum("pending","accepted","traveling","reached","in_progress","completed","cancelled"),
        default="pending"
    )
    base_price      = db.Column(db.Numeric(8, 2), default=0)
    distance_km     = db.Column(db.Numeric(6, 2), default=0)
    distance_charge = db.Column(db.Numeric(8, 2), default=0)
    platform_fee    = db.Column(db.Numeric(8, 2), default=0)
    total_amount    = db.Column(db.Numeric(8, 2), default=0)
    ai_eta_minutes  = db.Column(db.Integer)
    requested_at    = db.Column(db.DateTime, default=datetime.utcnow)
    accepted_at     = db.Column(db.DateTime)
    completed_at    = db.Column(db.DateTime)
    updated_at      = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    payment         = db.relationship("Payment", backref="request", uselist=False, lazy=True)
    review          = db.relationship("Review", backref="request", uselist=False, lazy=True)

    # Base prices by service type (INR)
    BASE_PRICES = {
        "flat_tire": 300,
        "battery": 500,
        "fuel": 200,
        "engine": 800,
        "towing": 1200,
        "other": 400,
    }

    def calculate_pricing(self, distance_km, platform_fee_pct=15):
        base = self.BASE_PRICES.get(self.service_type, 400)
        dist_charge = round(distance_km * 25, 2)  # ₹25/km
        subtotal = base + dist_charge
        fee = round(subtotal * platform_fee_pct / 100, 2)
        self.base_price = base
        self.distance_km = distance_km
        self.distance_charge = dist_charge
        self.platform_fee = fee
        self.total_amount = round(subtotal + fee, 2)

    def to_dict(self):
        return {
            "id": self.id,
            "service_type": self.service_type,
            "description": self.description,
            "status": self.status,
            "user_lat": float(self.user_lat),
            "user_lng": float(self.user_lng),
            "user_address": self.user_address,
            "total_amount": float(self.total_amount),
            "ai_eta_minutes": self.ai_eta_minutes,
            "requested_at": self.requested_at.isoformat() if self.requested_at else None,
            "mechanic": self.mechanic.to_dict() if self.mechanic else None,
        }


class Payment(db.Model):
    __tablename__ = "payments"

    id                  = db.Column(db.Integer, primary_key=True)
    request_id          = db.Column(db.Integer, db.ForeignKey("requests.id"), nullable=False)
    user_id             = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    mechanic_id         = db.Column(db.Integer, db.ForeignKey("mechanics.id"))
    razorpay_order_id   = db.Column(db.String(100), unique=True)
    razorpay_payment_id = db.Column(db.String(100))
    razorpay_signature  = db.Column(db.String(500))
    amount              = db.Column(db.Numeric(10, 2), nullable=False)
    platform_fee        = db.Column(db.Numeric(10, 2), default=0)
    mechanic_payout     = db.Column(db.Numeric(10, 2), default=0)
    currency            = db.Column(db.String(10), default="INR")
    status              = db.Column(db.Enum("created","paid","failed","refunded"), default="created")
    payment_method      = db.Column(db.String(50))
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at          = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Review(db.Model):
    __tablename__ = "reviews"

    id          = db.Column(db.Integer, primary_key=True)
    request_id  = db.Column(db.Integer, db.ForeignKey("requests.id"), nullable=False, unique=True)
    reviewer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    mechanic_id = db.Column(db.Integer, db.ForeignKey("mechanics.id"), nullable=False)
    rating      = db.Column(db.SmallInteger, nullable=False)
    comment     = db.Column(db.Text)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)


class Notification(db.Model):
    __tablename__ = "notifications"

    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title       = db.Column(db.String(150), nullable=False)
    message     = db.Column(db.Text, nullable=False)
    type        = db.Column(db.Enum("info","success","warning","danger"), default="info")
    is_read     = db.Column(db.Boolean, default=False)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "type": self.type,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
        }


class EmergencyLog(db.Model):
    __tablename__ = "emergency_logs"

    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    lat         = db.Column(db.Numeric(10, 8))
    lng         = db.Column(db.Numeric(11, 8))
    address     = db.Column(db.String(300))
    note        = db.Column(db.Text)
    logged_at   = db.Column(db.DateTime, default=datetime.utcnow)
