"""
Mechanic model — linked to User, stores location + stats.
"""
from app import db
from datetime import datetime
import math


class Mechanic(db.Model):
    __tablename__ = "mechanics"

    id                = db.Column(db.Integer, primary_key=True)
    user_id           = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    specialization    = db.Column(db.String(200))   # comma-separated
    experience_years  = db.Column(db.Integer, default=0)
    vehicle_number    = db.Column(db.String(30))
    vehicle_type      = db.Column(db.String(60))
    # Real-time GPS
    latitude          = db.Column(db.Numeric(10, 8))
    longitude         = db.Column(db.Numeric(11, 8))
    # Status
    is_online         = db.Column(db.Boolean, default=False)
    is_available      = db.Column(db.Boolean, default=False)
    is_approved       = db.Column(db.Boolean, default=False)
    is_suspended      = db.Column(db.Boolean, default=False)
    # Stats
    rating            = db.Column(db.Numeric(3, 2), default=5.00)
    total_reviews     = db.Column(db.Integer, default=0)
    total_jobs        = db.Column(db.Integer, default=0)
    total_earnings    = db.Column(db.Numeric(10, 2), default=0.00)
    created_at        = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at        = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    active_requests   = db.relationship("Request", backref="mechanic", lazy=True,
                                         foreign_keys="Request.mechanic_id")
    reviews           = db.relationship("Review", backref="mechanic", lazy=True)

    def distance_to(self, lat, lng):
        """Haversine distance in km from mechanic to given coordinates."""
        if not self.latitude or not self.longitude:
            return float("inf")
        R = 6371
        lat1, lon1 = math.radians(float(self.latitude)), math.radians(float(self.longitude))
        lat2, lon2 = math.radians(lat), math.radians(lng)
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        return R * 2 * math.asin(math.sqrt(a))

    def score(self, user_lat, user_lng):
        """Score for matching: lower distance + higher rating = higher score."""
        dist = self.distance_to(user_lat, user_lng)
        if dist > 20:
            return -1  # too far
        return (0.5 * (1 / (dist + 0.1))) + (0.3 * float(self.rating) / 5) + (0.2 * min(self.total_jobs, 200) / 200)

    def to_dict(self, user_lat=None, user_lng=None):
        dist = self.distance_to(user_lat, user_lng) if user_lat else None
        return {
            "id": self.id,
            "name": self.user.name if self.user else "",
            "avatar": self.user.avatar if self.user else "",
            "phone": self.user.phone if self.user else "",
            "specialization": self.specialization.split(",") if self.specialization else [],
            "vehicle_number": self.vehicle_number,
            "vehicle_type": self.vehicle_type,
            "latitude": float(self.latitude) if self.latitude else None,
            "longitude": float(self.longitude) if self.longitude else None,
            "is_online": self.is_online,
            "is_available": self.is_available,
            "rating": float(self.rating),
            "total_reviews": self.total_reviews,
            "total_jobs": self.total_jobs,
            "distance_km": round(dist, 2) if dist is not None else None,
        }
