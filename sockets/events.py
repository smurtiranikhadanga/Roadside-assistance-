"""
Flask-SocketIO event handlers for real-time features:
- Mechanic GPS location broadcasting
- Request status notifications
- Live chat between user and mechanic
- Room management (user_<id>, mechanic_<id>)
"""
from flask_socketio import join_room, leave_room, emit
from flask_login import current_user
from flask import request


def register_events(socketio):
    """Register all SocketIO event handlers."""

    @socketio.on("connect")
    def handle_connect():
        """On connect, join personal room based on role."""
        # Authentication is handled by Flask-Login session cookie
        # If not authenticated, we still allow connection (public events)
        sid = request.sid
        print(f"[Socket] Client connected: {sid}")

    @socketio.on("disconnect")
    def handle_disconnect():
        print(f"[Socket] Client disconnected: {request.sid}")

    @socketio.on("join")
    def handle_join(data):
        """
        Client sends { role: 'user'|'mechanic'|'admin', id: <user_id> }
        to join their personal notification room.
        """
        role = data.get("role", "user")
        uid  = data.get("id")
        if uid:
            room = f"{role}_{uid}"
            join_room(room)
            emit("joined", {"room": room, "message": f"Joined room {room}"})
            print(f"[Socket] Joined room: {room}")

    @socketio.on("leave")
    def handle_leave(data):
        role = data.get("role", "user")
        uid  = data.get("id")
        if uid:
            room = f"{role}_{uid}"
            leave_room(room)

    # ── Real-time GPS from mechanic app ──────────────────────────────────
    @socketio.on("mechanic_location_update")
    def handle_mechanic_location(data):
        """
        Mechanic client sends live GPS every 5 seconds.
        data = { mechanic_id, lat, lng, request_id }
        Broadcast to the user's room tracking this mechanic.
        """
        request_id  = data.get("request_id")
        mechanic_id = data.get("mechanic_id")
        lat         = data.get("lat")
        lng         = data.get("lng")

        if not all([request_id, lat, lng]):
            return

        # Find which user is tracking this request
        from models.request import Request
        from extensions import db
        req = Request.query.get(request_id)
        if req and req.status in ("accepted", "traveling", "reached"):
            # Calculate updated ETA (simple formula)
            from models.mechanic import Mechanic
            mech = Mechanic.query.get(mechanic_id)
            eta = None
            if mech:
                dist = mech.distance_to(float(req.user_lat), float(req.user_lng))
                eta  = max(1, int(dist * 2))

            emit("mechanic_position", {
                "lat": lat,
                "lng": lng,
                "eta_minutes": eta,
                "request_id": request_id,
            }, room=f"user_{req.user_id}")

            # Update mechanic location in DB
            if mech:
                mech.latitude  = lat
                mech.longitude = lng
                db.session.commit()

    # ── Chat messages ─────────────────────────────────────────────────────
    @socketio.on("chat_send")
    def handle_chat_send(data):
        """
        data = { request_id, sender_id, sender_role, content }
        Save to DB and broadcast to both parties in the request room.
        """
        from models.request import Request
        request_id  = data.get("request_id")
        sender_id   = data.get("sender_id")
        sender_role = data.get("sender_role", "user")
        content     = data.get("content", "").strip()

        if not content or not request_id:
            return

        req = Request.query.get(request_id)
        if not req:
            return

        msg_payload = {
            "request_id": request_id,
            "sender_id": sender_id,
            "sender_role": sender_role,
            "content": content,
        }

        # Send to user
        emit("chat_message", msg_payload, room=f"user_{req.user_id}")
        # Send to mechanic
        if req.mechanic:
            emit("chat_message", msg_payload, room=f"mechanic_{req.mechanic.id}")

    # ── Status update broadcast ───────────────────────────────────────────
    @socketio.on("status_update")
    def handle_status_update(data):
        """Mechanic updates job status; notify user."""
        from models.request import Request
        from extensions import db
        from datetime import datetime

        request_id = data.get("request_id")
        new_status = data.get("status")
        valid      = ["traveling", "reached", "in_progress", "completed", "cancelled"]

        if new_status not in valid or not request_id:
            return

        req = Request.query.get(request_id)
        if not req:
            return

        req.status = new_status
        if new_status == "completed":
            req.completed_at = datetime.utcnow()
            if req.mechanic:
                req.mechanic.is_available = True
                req.mechanic.total_jobs  += 1
        db.session.commit()

        status_messages = {
            "traveling": "🚗 Your mechanic is on the way!",
            "reached":   "📍 Mechanic has arrived at your location!",
            "in_progress": "🔧 Service in progress...",
            "completed": "✅ Service completed! Please rate your experience.",
            "cancelled": "❌ Request has been cancelled.",
        }

        emit("request_status_changed", {
            "request_id": request_id,
            "status": new_status,
            "message": status_messages.get(new_status, "Status updated"),
        }, room=f"user_{req.user_id}")

    # ── SOS / Emergency broadcast ─────────────────────────────────────────
    @socketio.on("sos_triggered")
    def handle_sos(data):
        """User triggers SOS — log and notify admin room."""
        from models.request import EmergencyLog
        from extensions import db

        user_id = data.get("user_id")
        lat     = data.get("lat")
        lng     = data.get("lng")
        address = data.get("address", "")

        if user_id and lat and lng:
            log = EmergencyLog(user_id=user_id, lat=lat, lng=lng, address=address,
                               note="SOS triggered from app")
            db.session.add(log)
            db.session.commit()

        # Notify admin room
        emit("sos_alert", data, room="admin_room")
        emit("sos_confirmed", {"message": "🚨 SOS sent! Help is coming."})

    @socketio.on("join_admin")
    def handle_join_admin():
        join_room("admin_room")
        emit("joined", {"room": "admin_room"})
