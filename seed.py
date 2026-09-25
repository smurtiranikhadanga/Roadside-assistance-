import os
from app import create_app
from extensions import db
from models.user import User
from models.mechanic import Mechanic
from models.request import Request
from datetime import datetime

app = create_app()

def seed_data():
    with app.app_context():
        # Drop all tables and recreate them to ensure a clean slate
        db.drop_all()
        db.create_all()

        print("Creating dummy users...")
        
        # 1. Admin
        admin = User(
            name="Admin User",
            email="admin@demo.com",
            phone="1112223333",
            role="admin",
            is_verified=True,
            avatar="https://ui-avatars.com/api/?name=Admin+User&background=FF6B35&color=fff&size=128"
        )
        admin.set_password("password123")
        db.session.add(admin)

        # 2. Regular User
        user = User(
            name="Jane Doe",
            email="user@demo.com",
            phone="9998887777",
            role="user",
            is_verified=True,
            vehicle_make="Toyota",
            vehicle_model="Camry",
            vehicle_year=2020,
            license_plate="ABC-1234",
            avatar="https://ui-avatars.com/api/?name=Jane+Doe&background=3b82f6&color=fff&size=128"
        )
        user.set_password("password123")
        db.session.add(user)

        # 3. Mechanic
        mechanic_user = User(
            name="Mike The Mechanic",
            email="mechanic@demo.com",
            phone="5554443333",
            role="mechanic",
            is_verified=True,
            avatar="https://ui-avatars.com/api/?name=Mike+Mechanic&background=10b981&color=fff&size=128"
        )
        mechanic_user.set_password("password123")
        db.session.add(mechanic_user)
        db.session.commit()

        # Mechanic Profile
        print("Creating mechanic profiles...")
        mechanic = Mechanic(
            user_id=mechanic_user.id,
            specialization="Towing, Jump Start, Flat Tire",
            experience_years=5,
            vehicle_number="TOW-999",
            vehicle_type="Tow Truck",
            latitude=28.7041,   # Dummy lat (Delhi)
            longitude=77.1025,  # Dummy long (Delhi)
            is_online=True,
            is_available=True,
            is_approved=True,
            rating=4.8,
            total_reviews=25,
            total_jobs=42
        )
        db.session.add(mechanic)
        db.session.commit()

        # 4. Dummy Request
        print("Creating dummy requests...")
        req1 = Request(
            user_id=user.id,
            service_type="towing",
            description="Car broke down on the highway",
            user_lat=28.7045,
            user_lng=77.1030,
            user_address="Highway 1",
            status="pending"
        )
        db.session.add(req1)
        
        req2 = Request(
            user_id=user.id,
            mechanic_id=mechanic.id,
            service_type="battery",
            description="Battery died in the parking lot",
            user_lat=28.7050,
            user_lng=77.1040,
            user_address="Mall Parking Lot",
            status="accepted"
        )
        db.session.add(req2)
        
        req3 = Request(
            user_id=user.id,
            mechanic_id=mechanic.id,
            service_type="flat_tire",
            description="Nail in tire",
            user_lat=28.7000,
            user_lng=77.1000,
            user_address="Main Street",
            status="completed",
            total_amount=50.0
        )
        db.session.add(req3)
        db.session.commit()

        print("Database seeded successfully with dummy data!")
        print("Login credentials:")
        print("Admin: admin@demo.com / password123")
        print("User: user@demo.com / password123")
        print("Mechanic: mechanic@demo.com / password123")

if __name__ == "__main__":
    seed_data()
