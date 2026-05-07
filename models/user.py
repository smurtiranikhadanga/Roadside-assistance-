"""
User model — Google OAuth + email/password authentication.
"""
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db
from datetime import datetime


class User(db.Model, UserMixin):
    __tablename__ = "users"

    id              = db.Column(db.Integer, primary_key=True)
    google_id       = db.Column(db.String(100), unique=True, nullable=True)
    name            = db.Column(db.String(120), nullable=False)
    email           = db.Column(db.String(180), unique=True, nullable=False)
    password_hash   = db.Column(db.String(256), nullable=True)   # NULL for Google-only accounts
    avatar          = db.Column(db.String(500))
    phone           = db.Column(db.String(20))
    role            = db.Column(db.Enum("user", "mechanic", "admin"), default="user")
    is_active       = db.Column(db.Boolean, default=True)
    is_verified     = db.Column(db.Boolean, default=False)
    # Vehicle info
    vehicle_make    = db.Column(db.String(60))
    vehicle_model   = db.Column(db.String(60))
    vehicle_year    = db.Column(db.SmallInteger)
    license_plate   = db.Column(db.String(20))
    # Location
    saved_address   = db.Column(db.String(300))
    emergency_contact = db.Column(db.String(20))
    # Timestamps
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at      = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    mechanic_profile = db.relationship("Mechanic", backref="user", uselist=False, lazy=True)
    requests         = db.relationship("Request", backref="requester", lazy=True,
                                       foreign_keys="Request.user_id")
    notifications    = db.relationship("Notification", backref="recipient", lazy=True)

    # ── Password helpers ─────────────────────────────────────
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "avatar": self.avatar,
            "role": self.role,
            "phone": self.phone,
            "vehicle": f"{self.vehicle_make} {self.vehicle_model}" if self.vehicle_make else None,
            "license_plate": self.license_plate,
        }
