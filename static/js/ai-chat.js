/* ai-chat.js — AI Roadside Chatbot with mock fallback */

let chatHistory = [];

const MOCK_RESPONSES = {
  battery:  "🔋 For a dead battery: turn off all accessories, try jump-starting with cables. Red (+) to red (+), black (-) to chassis ground. Start the working car first, wait 2 mins, then try yours. If it clicks but won't start, you may need a replacement.",
  tyre:     "🔴 For a flat tyre: engage handbrake, place warning triangles, loosen wheel nuts before jacking. Jack under the reinforced sill points. Never lie under a car on a jack alone. Our mechanic is faster — tap 'Request Assistance'!",
  fuel:     "⛽ If you've run out of fuel: pull safely off the road, hazard lights on. Don't try to push the car — our fuel delivery mechanic will reach you with the right fuel type. Just select Fuel Delivery and we'll handle it.",
  engine:   "⚙️ If your engine warning light is on: stop safely, turn off AC, check temperature gauge. If it's overheating, turn off engine immediately. Don't open the radiator cap when hot! Let our mechanic diagnose it.",
  default:  "🚗 I'm RoadBot, your 24/7 assistant! I can help with: battery issues, flat tyres, fuel problems, engine warning lights, overheating, and more. What's your vehicle issue?"
};

function getMockResponse(msg) {
  const m = msg.toLowerCase();
  if (m.includes('battery') || m.includes('dead') || m.includes('start')) return MOCK_RESPONSES.battery;
  if (m.includes('tyre') || m.includes('tire') || m.includes('flat') || m.includes('puncture')) return MOCK_RESPONSES.tyre;
  if (m.includes('fuel') || m.includes('petrol') || m.includes('diesel') || m.includes('empty')) return MOCK_RESPONSES.fuel;
  if (m.includes('engine') || m.includes('overheat') || m.includes('smoke') || m.includes('warning')) return MOCK_RESPONSES.engine;
  return MOCK_RESPONSES.default;
}

async function sendAIMessage() {
  const input = document.getElementById('ai-chat-input');
  const msg   = input?.value.trim();
  if (!msg) return;
  input.value = '';

  appendAIMessage(msg, 'user');
  chatHistory.push({ role: 'user', content: msg });

  // Typing indicator
  const typingEl = appendAIMessage('● ● ●', 'bot', true);

  try {
    const res = await fetch('/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history: chatHistory })
    });
    const data = await res.json();
    typingEl.remove();

    const reply = (data.reply && data.reply.trim()) ? data.reply : getMockResponse(msg);
    appendAIMessage(reply, 'bot');
    chatHistory.push({ role: 'assistant', content: reply });
  } catch {
    typingEl.remove();
    appendAIMessage(getMockResponse(msg), 'bot');
  }
}

function appendAIMessage(text, side, isTyping = false) {
  const box = document.getElementById('ai-chat-messages');
  if (!box) return null;
  const el = document.createElement('div');
  el.className = `chat-msg ${side}`;
  el.textContent = text;
  if (isTyping) el.style.opacity = '0.5';
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
}
