"""
AI Blueprint — OpenAI chatbot + ETA prediction endpoints.
"""
from flask import Blueprint, jsonify, request as req, current_app
from flask_login import login_required, current_user

ai_bp = Blueprint("ai", __name__)


def _get_openai_client():
    """Lazy-init OpenAI client using configured API key."""
    from openai import OpenAI
    return OpenAI(api_key=current_app.config["OPENAI_API_KEY"])


# ── AI Roadside Chatbot ───────────────────────────────────────────────────
SYSTEM_PROMPT = """You are RoadBot — an expert AI roadside assistant for RoadSide+.
You help stranded drivers by:
1. Diagnosing vehicle issues based on symptoms they describe
2. Providing immediate safety steps while waiting for help
3. Estimating repair complexity (minor / moderate / major)
4. Answering questions about car maintenance and emergency procedures
5. Providing calming, reassuring support

Always be concise, practical, and safety-first.
If someone describes a dangerous situation (fire, smoke, brake failure on highway),
immediately tell them to move away from the vehicle and call emergency services.
Reply in the same language the user writes in."""


@ai_bp.route("/chat", methods=["POST"])
@login_required
def chat():
    data    = req.get_json()
    message = data.get("message", "").strip()
    history = data.get("history", [])   # [{role, content}, ...]

    if not message:
        return jsonify({"error": "Message is required"}), 400

    if not current_app.config.get("OPENAI_API_KEY"):
        # Fallback response when no API key is configured
        return jsonify({
            "reply": (
                "I'm RoadBot! 🤖 It looks like the AI service isn't configured yet. "
                "Please contact support or add your OpenAI API key. "
                "In the meantime, stay safe — move away from traffic, turn on hazard lights, "
                "and wait for your mechanic!"
            )
        })

    try:
        client = _get_openai_client()
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Include last 8 turns for context
        for turn in history[-8:]:
            messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": message})

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=400,
            temperature=0.7,
        )
        reply = response.choices[0].message.content.strip()
        return jsonify({"reply": reply})

    except Exception as e:
        current_app.logger.error(f"OpenAI error: {e}")
        return jsonify({
            "reply": "I'm having trouble connecting right now. "
                     "Please stay safe: hazard lights on, move off the road, "
                     "and your mechanic is on the way! 🚗"
        })


# ── AI ETA Prediction ─────────────────────────────────────────────────────
@ai_bp.route("/eta", methods=["POST"])
@login_required
def predict_eta():
    """
    Predict ETA based on distance, time of day, and service complexity.
    Uses simple rule-based model; can be enhanced with ML.
    """
    data         = req.get_json()
    distance_km  = float(data.get("distance_km", 5))
    service_type = data.get("service_type", "other")
    hour         = data.get("hour", 12)  # 0-23

    # Base travel time: 2 min/km, adjusted for traffic by hour
    if 8 <= hour <= 10 or 17 <= hour <= 20:   # rush hour
        speed_factor = 1.8
    elif 23 <= hour or hour <= 5:               # night
        speed_factor = 0.9
    else:
        speed_factor = 1.3

    travel_time = distance_km * 2 * speed_factor

    # Service complexity additions
    service_times = {
        "flat_tire":  20,
        "battery":    15,
        "fuel":       10,
        "engine":     45,
        "towing":     30,
        "other":      25,
    }
    service_time  = service_times.get(service_type, 25)
    total_eta     = int(travel_time + service_time)

    return jsonify({
        "travel_minutes": int(travel_time),
        "service_minutes": service_time,
        "total_eta_minutes": total_eta,
        "message": f"Estimated total time: {total_eta} minutes (arrival in ~{int(travel_time)} min)"
    })


# ── Smart Mechanic Recommendation ────────────────────────────────────────
@ai_bp.route("/recommend-mechanic", methods=["POST"])
@login_required
def recommend_mechanic():
    """Return the best mechanic recommendation with reasoning."""
    from models.mechanic import Mechanic
    data         = req.get_json()
    user_lat     = data.get("lat")
    user_lng     = data.get("lng")
    service_type = data.get("service_type", "")

    mechanics = Mechanic.query.filter_by(is_online=True, is_available=True,
                                          is_approved=True, is_suspended=False).all()
    if not mechanics:
        return jsonify({"mechanic": None, "reason": "No mechanics available right now."})

    if service_type:
        mechanics = [m for m in mechanics if not m.specialization or service_type in m.specialization]

    if not mechanics:
        return jsonify({"mechanic": None, "reason": f"No mechanics available for {service_type} right now."})

    best = max(mechanics, key=lambda m: m.score(user_lat, user_lng))
    dist = best.distance_to(user_lat, user_lng)

    reason = (
        f"{best.user.name} is the best match — "
        f"only {dist:.1f} km away, "
        f"rated {float(best.rating):.1f}★, "
        f"with {best.total_jobs} completed jobs."
    )
    return jsonify({"mechanic": best.to_dict(user_lat, user_lng), "reason": reason})
