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
SYSTEM_PROMPT = """You are RoadBot — a calm, expert AI roadside emergency assistant for RoadSide+ (India's #1 roadside platform).

YOUR PRIMARY MISSION: Guide stranded drivers step-by-step through their emergency UNTIL the mechanic physically arrives.

PERSONALITY:
- Calm, reassuring, and professional — like a knowledgeable friend on the phone
- Never panic even when the user does
- Use clear numbered steps, not long paragraphs
- Use relevant emojis sparingly (they help in stressful moments)
- Always end with what the user should do NEXT

WHAT YOU DO:
1. IMMEDIATE SAFETY — First assess if the user/others are physically safe
2. DIAGNOSE — Understand the exact vehicle issue from their description
3. GUIDE — Give specific, step-by-step instructions for their issue
4. WAIT SUPPORT — Keep them engaged, calm and informed while mechanic travels
5. HANDOFF — When mechanic arrives, guide the user on what to show/tell them

ISSUE EXPERTISE:
- Dead battery: terminals, jump-start procedure, alternator signs
- Flat tyre: safe stopping, warning triangles, spare tyre procedure
- Fuel empty: coasting safely, fuel type confirmation, restart procedure
- Engine overheating: immediate shutdown, coolant, when NOT to open hood
- Towing: preparation, document gathering, safe positioning
- Brake issues: engine braking, emergency stops, handbrake use
- Electrical: fuses, warning lights interpretation
- Accidents: call 112 first, document scene, injury assessment

SAFETY RULES:
- If user mentions fire/smoke → immediately say GET OUT and call 112
- If user mentions accident with injuries → call 112 FIRST, then guide
- If on highway → emphasise staying behind barrier, never in front of car
- Night time → keep lights on, stay inside locked car

CONTEXT AWARENESS:
- If they mention a mechanic is coming → acknowledge ETA and keep them focused
- If they seem scared/alone → be extra reassuring, suggest calling someone
- If they ask about cost/payment → "that's handled through the app once the mechanic arrives — focus on staying safe for now"

Always respond in the same language the user writes in.
Keep responses under 200 words — clear and actionable.
End every response with a specific next action for the user."""


@ai_bp.route("/chat", methods=["POST"])
@login_required
def chat():
    data    = req.get_json()
    message = data.get("message", "").strip()
    history = data.get("history", [])
    context = data.get("context", {})   # issue, phase, service, request_id

    if not message:
        return jsonify({"error": "Message is required"}), 400

    api_key = current_app.config.get("OPENAI_API_KEY", "")
    if not api_key or api_key == "YOUR_OPENAI_API_KEY":
        # Return empty so frontend uses its own smart engine
        return jsonify({"reply": ""})

    try:
        client = _get_openai_client()

        # Build context-aware system message
        system = SYSTEM_PROMPT
        if context.get("service"):
            svc_map = {
                "battery": "dead battery / won't start",
                "flat_tire": "flat tyre / puncture",
                "fuel": "ran out of fuel",
                "engine": "engine warning / overheating",
                "towing": "vehicle needs towing",
                "other": "general breakdown",
            }
            svc = svc_map.get(context["service"], context["service"])
            system += f"\n\nCURRENT CONTEXT: User has selected '{svc}' as their issue."
        if context.get("request_id"):
            system += "\nA mechanic has been dispatched and is on the way. Keep user calm and guided."

        messages = [{"role": "system", "content": system}]
        for turn in history[-10:]:
            if turn.get("role") in ("user", "assistant") and turn.get("content"):
                messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": message})

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=350,
            temperature=0.65,
        )
        reply = response.choices[0].message.content.strip()
        return jsonify({"reply": reply, "source": "gpt"})

    except Exception as e:
        current_app.logger.error(f"OpenAI error: {e}")
        return jsonify({"reply": ""})   # Fall back to frontend engine


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
