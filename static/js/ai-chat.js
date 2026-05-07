/* ═══════════════════════════════════════════════════════════════
   RoadBot AI — Conversational Roadside Assistant
   Works with OpenAI GPT (when key set) OR built-in smart engine
═══════════════════════════════════════════════════════════════ */

// ── Conversation state ────────────────────────────────────────
const RoadBot = {
  history: [],
  issue: null,          // detected issue type
  phase: 'initial',     // initial | diagnosed | requested | waiting | arrived | done
  stepIndex: 0,
  userSafe: null,
  waitTimer: null,

  // Step-by-step guides per issue
  guides: {
    battery: {
      label: 'Dead Battery / Won\'t Start',
      steps: [
        '🔑 **Step 1 — Don\'t panic.** Turn the ignition OFF. Keep all lights and accessories switched off to preserve any remaining charge.',
        '🔍 **Step 2 — Check the basics.** Open the bonnet and visually inspect the battery. Look for any corrosion (white/blue powder) on the terminals.',
        '🚗 **Step 3 — Try a jump start** if another car is nearby: Red (+) to red (+), Black (-) to chassis ground (NOT battery negative). Start the working car first, wait 2 minutes, then try yours.',
        '🌡️ **Step 4 — If jump start fails**, the battery may be dead or there\'s an alternator fault. Don\'t keep cranking — it drains the starter motor.',
        '✅ **Step 5 — Our mechanic is on the way.** Keep the bonnet open so they can identify your car easily. Stay inside the vehicle if it\'s dark.',
      ]
    },
    flat_tire: {
      label: 'Flat Tyre',
      steps: [
        '⚠️ **Step 1 — Safety first.** Slowly steer to the left shoulder or a safe area. Turn on your hazard lights immediately.',
        '🛑 **Step 2 — Stop safely.** Engage the handbrake. If on a slope, put it in gear (manual) or "Park" (auto). Do NOT use the brakes while steering.',
        '🔺 **Step 3 — Place warning triangles** at least 30 metres behind your car to alert other drivers.',
        '🔧 **Step 4 — If you have a spare**, loosen wheel nuts slightly BEFORE jacking the car. Jack under the reinforced sill points in your car manual.',
        '✅ **Step 5 — Mechanic is en route.** Stay off the road, away from traffic. Do not attempt to change a tyre on a highway alone.',
      ]
    },
    fuel: {
      label: 'Fuel / Petrol Empty',
      steps: [
        '⚠️ **Step 1 — Steer safely to the kerb.** As the engine sputters, you\'ll have a few seconds — use them to coast to a safe stop.',
        '🔦 **Step 2 — Hazard lights on.** Switch them on and place warning triangles if you have them.',
        '❌ **Step 3 — Don\'t restart repeatedly.** Modern fuel-injected engines can get air-locked. Wait for fuel delivery.',
        '📋 **Step 4 — Note your fuel type** (Petrol/Diesel/EV) so we send the right fuel. Check your fuel cap or dashboard.',
        '✅ **Step 5 — Our fuel delivery is on the way.** Typically 10–20 minutes. Stay with your vehicle.',
      ]
    },
    engine: {
      label: 'Engine Warning / Overheating',
      steps: [
        '🚨 **Step 1 — Pull over IMMEDIATELY** if the temperature gauge is in red or you see steam from the bonnet.',
        '🔑 **Step 2 — Turn off the engine.** Do NOT open the bonnet or radiator cap — pressurised steam can cause severe burns.',
        '❄️ **Step 3 — Allow 20–30 minutes to cool** before attempting anything. Turn on the heater (yes, really) — it helps dump engine heat.',
        '🔍 **Step 4 — Check for leaks** once cooled. Look under the car for coolant (green/orange liquid). A warning light alone without heat may just be a sensor.',
        '✅ **Step 5 — Do not drive further.** Our mechanic will diagnose the root cause — driving an overheated engine can warp the cylinder head (₹50,000+ repair).',
      ]
    },
    towing: {
      label: 'Towing Required',
      steps: [
        '🅿️ **Step 1 — Move to a safe, flat area** if possible. Avoid slopes, narrow lanes, or areas with overhead power lines.',
        '🔑 **Step 2 — Unlock the steering** by turning the key to accessory mode. This allows the car to be steered during loading.',
        '📋 **Step 3 — Gather your documents** — RC book, insurance. The mechanic may need them.',
        '📞 **Step 4 — Confirm your destination** — garage of your choice or nearest authorised service centre.',
        '✅ **Step 5 — Our tow truck is on the way.** Flatbed trucks are used for automatic/AWD vehicles. Stay near your car.',
      ]
    },
    other: {
      label: 'General Breakdown',
      steps: [
        '⚠️ **Step 1 — Move off the main road** to the shoulder or side street if the car is still driveable.',
        '💡 **Step 2 — Hazard lights on.** Place warning triangles behind the car.',
        '🔍 **Step 3 — Try to identify the symptom** — is it a noise, a smell, a warning light, or complete breakdown?',
        '📋 **Step 4 — Note any recent changes** — last service, any new sounds, when it started. This helps the mechanic diagnose faster.',
        '✅ **Step 5 — Our mechanic is on the way.** Share any additional details and I\'ll relay them.',
      ]
    }
  },

  // Detect issue from user message
  detectIssue(msg) {
    const m = msg.toLowerCase();
    if (/battery|dead|jump|start|crank|click|ignition|charge/i.test(m)) return 'battery';
    if (/tyre|tire|flat|puncture|rim|wheel|blowout/i.test(m)) return 'flat_tire';
    if (/fuel|petrol|diesel|empty|ran out|gas/i.test(m)) return 'fuel';
    if (/engine|overheat|temp|temperature|smoke|steam|warning light|red light|check engine/i.test(m)) return 'engine';
    if (/tow|towing|stuck|can't move|cannot move|broken/i.test(m)) return 'towing';
    return null;
  },

  // Build conversational response
  respond(msg) {
    const m = msg.toLowerCase();

    // Safety check first
    if (/accident|crash|fire|hurt|injur|blood|emergency/i.test(m)) {
      return '🚨 **This sounds like an emergency beyond roadside help.** Please call **112 (Police/Ambulance)** immediately. If your car is on fire, get at least 50 metres away. I\'ve flagged your request as Priority SOS — a responder is being dispatched right now. Are you physically safe?';
    }

    // Greetings
    if (/^(hi|hello|hey|help|sos|assist)/i.test(m)) {
      this.phase = 'initial';
      return '👋 Hi! I\'m **RoadBot**, your 24/7 emergency assistant. I\'m here to guide you safely until our mechanic arrives.\n\n**What\'s happening with your vehicle?** Tell me in your own words and I\'ll give you immediate guidance.';
    }

    // If issue not detected yet, try to detect
    if (!this.issue) {
      const detected = this.detectIssue(msg);
      if (detected) {
        this.issue = detected;
        this.stepIndex = 0;
        this.phase = 'diagnosed';
        const guide = this.guides[detected];
        const step = guide.steps[0];
        this.stepIndex = 1;
        return `I understand — **${guide.label}**. Let me guide you through this.\n\n${step}\n\n_Type "next" for the next step, or ask me anything specific._`;
      }
      // Can't detect — ask clarifying question
      return this.clarifyingQuestion(msg);
    }

    // Step navigation
    if (/next|continue|ok|okay|done|yes|got it|step/i.test(m)) {
      return this.nextStep();
    }
    if (/back|previous|repeat|again/i.test(m)) {
      return this.repeatStep();
    }

    // Status / ETA questions
    if (/where|how long|eta|time|arrive|coming|status|track/i.test(m)) {
      const eta = document.getElementById('eta-display')?.textContent || '';
      const status = document.getElementById('req-status-badge')?.textContent || '';
      if (status && status !== 'Accepted') {
        return `📡 Your mechanic\'s current status: **${status}**. ${eta ? '\n⏱️ ' + eta : ''}\n\nKeep your hazard lights on and stay visible. Do you need me to continue with safety steps?`;
      }
      return '📡 Your request is being processed — a mechanic is being matched right now. This usually takes 2–5 minutes.\n\nIn the meantime, shall I continue with the safety guide?';
    }

    // Reassurance
    if (/scared|worried|alone|dark|night|afraid/i.test(m)) {
      return '💙 I completely understand — being stranded is stressful. **Our mechanic is on the way and will be with you soon.**\n\nHere\'s what to do right now:\n• Keep your car doors **locked**\n• Hazard lights **on**\n• Stay on the **phone with someone** if it helps\n• You can also call our emergency line: **1800-ROADSIDE**\n\nYou\'re not alone. I\'m right here. 👍';
    }

    // If we have an active issue, continue the guide contextually
    if (this.issue) {
      const detected = this.detectIssue(msg);
      if (detected && detected !== this.issue) {
        // New issue detected
        this.issue = detected;
        this.stepIndex = 0;
        this.phase = 'diagnosed';
        const guide = this.guides[detected];
        const step = guide.steps[0];
        this.stepIndex = 1;
        return `Got it — switching to **${guide.label}** guidance.\n\n${step}\n\n_Type "next" for the next step._`;
      }
      // Continue with contextual advice
      return this.contextualAdvice(msg);
    }

    return this.clarifyingQuestion(msg);
  },

  nextStep() {
    if (!this.issue) return 'Please tell me your vehicle issue first and I\'ll guide you step by step.';
    const guide = this.guides[this.issue];
    if (this.stepIndex >= guide.steps.length) {
      this.phase = 'waiting';
      return '✅ **You\'ve completed all safety steps — great job!**\n\nNow just:\n• Stay with your vehicle\n• Keep hazard lights on\n• Watch the tracking screen for mechanic arrival\n\nI\'ll be right here if you have any questions. The mechanic will contact you when they\'re close! 🚗';
    }
    const step = guide.steps[this.stepIndex];
    this.stepIndex++;
    const remaining = guide.steps.length - this.stepIndex;
    const suffix = remaining > 0 ? `\n\n_${remaining} step${remaining > 1 ? 's' : ''} remaining — type "next" to continue._` : '\n\n_That\'s all the steps! Type "done" when the mechanic arrives._';
    return `${step}${suffix}`;
  },

  repeatStep() {
    if (!this.issue || this.stepIndex === 0) return 'No step to repeat yet. Tell me your issue and I\'ll start from the beginning.';
    const guide = this.guides[this.issue];
    const idx = Math.max(0, this.stepIndex - 1);
    return `🔄 Repeating Step ${idx + 1}:\n\n${guide.steps[idx]}`;
  },

  contextualAdvice(msg) {
    const m = msg.toLowerCase();
    if (/smell|burn|smoke/i.test(m)) return '🚨 If you smell burning or see smoke, **get out of the car immediately** and move at least 30 metres away. Call 112 if you see flames. Our mechanic has been notified of your situation.';
    if (/noise|sound|grinding|clunk/i.test(m)) return '🔊 Please don\'t try to drive further. Strange noises often indicate a structural issue that can worsen — and create a safety risk. Our mechanic will diagnose the exact cause. Can you describe the sound more (grinding/clicking/squealing)?';
    if (/rain|weather|wind|storm/i.test(m)) return '🌧️ In bad weather: stay **inside your vehicle** with seatbelt on (this is actually safer than standing outside). Keep hazard lights on. Our mechanic is still coming — they operate in all weather conditions.';
    if (/highway|motorway|freeway|fast/i.test(m)) return '🛣️ On a highway: **never stand behind or in front** of your car. Get everyone behind the barrier if possible. Our mechanic will approach from the correct direction with safety protocols.';
    if (/kids|child|baby|family/i.test(m)) return '👨‍👩‍👧 With children: keep them inside and buckled if near traffic. If it\'s hot, crack a window and call 112 if temperature is dangerous. Our mechanic is being prioritised — please let me know your exact situation.';
    return this.nextStep();
  },

  clarifyingQuestion(msg) {
    const questions = [
      'Can you describe what happened? For example: "My car won\'t start", "I have a flat tyre", or "I ran out of fuel".',
      'What does your dashboard show? Any warning lights? That\'ll help me guide you better.',
      'Is your vehicle still driveable, or are you completely stopped? And are you in a safe location?',
    ];
    const q = questions[Math.floor(Math.random() * questions.length)];
    return `🤔 I want to make sure I give you the right guidance. ${q}`;
  }
};

// ── Send message ──────────────────────────────────────────────
async function sendAIMessage() {
  const input = document.getElementById('ai-chat-input');
  const msg   = input?.value.trim();
  if (!msg) return;
  input.value = '';

  appendAIMsg(msg, 'user');
  RoadBot.history.push({ role: 'user', content: msg });

  const typingEl = appendAIMsg('', 'bot', true);

  try {
    const res = await fetch('/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        history: RoadBot.history,
        context: {
          issue: RoadBot.issue,
          phase: RoadBot.phase,
          service: typeof selectedService !== 'undefined' ? selectedService : null,
          request_id: typeof currentRequestId !== 'undefined' ? currentRequestId : null,
        }
      })
    });
    const data = await res.json();
    typingEl.remove();

    const reply = (data.reply && data.reply.trim()) ? data.reply : RoadBot.respond(msg);
    // Also update local state from smart engine to keep context
    if (!data.reply) RoadBot.detectIssue(msg);

    displayAIReply(reply, typingEl);
    RoadBot.history.push({ role: 'assistant', content: reply });
  } catch {
    typingEl.remove();
    const reply = RoadBot.respond(msg);
    displayAIReply(reply);
    RoadBot.history.push({ role: 'assistant', content: reply });
  }
}

function displayAIReply(text, oldEl) {
  // Render markdown-lite (bold, line breaks)
  const el = appendAIMsg('', 'bot');
  let rendered = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  el.innerHTML = rendered;

  // Auto-show quick reply chips if step-based
  if (text.includes('next step') || text.includes('type "next"')) {
    addQuickReplies(['Next step ➡️', 'Repeat this step', 'How long until mechanic?', 'I\'m scared 😟']);
  } else if (text.includes('What\'s happening') || text.includes('Tell me')) {
    addQuickReplies(['Dead battery', 'Flat tyre', 'Ran out of fuel', 'Engine overheating', 'Need towing']);
  }
}

function addQuickReplies(options) {
  const box = document.getElementById('ai-chat-messages');
  if (!box) return;
  // Remove old chips
  box.querySelectorAll('.quick-chips').forEach(e => e.remove());
  const wrap = document.createElement('div');
  wrap.className = 'quick-chips';
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.25rem';
  options.forEach(opt => {
    const chip = document.createElement('button');
    chip.textContent = opt;
    chip.style.cssText = 'padding:.35rem .75rem;border-radius:99px;border:1.5px solid #D0D9E5;background:#F8FAFC;font-size:.75rem;font-weight:600;color:#1E3A5F;cursor:pointer;font-family:inherit;transition:all .15s';
    chip.onmouseover = () => { chip.style.borderColor = '#FF6B35'; chip.style.color = '#FF6B35'; };
    chip.onmouseout  = () => { chip.style.borderColor = '#D0D9E5'; chip.style.color = '#1E3A5F'; };
    chip.onclick = () => {
      const input = document.getElementById('ai-chat-input');
      if (input) { input.value = opt.replace(/[^\w\s']/g, '').trim(); sendAIMessage(); }
      wrap.remove();
    };
    wrap.appendChild(chip);
  });
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
}

function appendAIMsg(text, side, isTyping = false) {
  const box = document.getElementById('ai-chat-messages');
  if (!box) return null;
  const el = document.createElement('div');
  el.className = `chat-msg ${side}`;
  if (isTyping) {
    el.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    el.style.cssText = 'min-width:52px;display:flex;align-items:center;gap:4px';
  } else {
    el.textContent = text;
  }
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
}

// ── Open chat + greet ─────────────────────────────────────────
function openAIChat() {
  const win = document.getElementById('chat-window');
  if (!win) return;
  win.classList.toggle('open');

  if (win.classList.contains('open')) {
    const box = document.getElementById('ai-chat-messages');
    if (box && box.children.length <= 1) {
      // Auto-greet with context
      const svc = typeof selectedService !== 'undefined' ? selectedService : null;
      let greeting;
      if (svc && RoadBot.guides[svc]) {
        RoadBot.issue = svc;
        RoadBot.stepIndex = 0;
        greeting = `👋 Hi! I'm **RoadBot** — I see you've selected **${RoadBot.guides[svc].label}**.\n\nI'll guide you step by step until our mechanic arrives. Ready to start?\n\n_Type "start" or tap a button below._`;
        setTimeout(() => addQuickReplies(['Start safety guide ✅', 'I\'m already safe', 'What should I do now?']), 100);
      } else {
        greeting = '👋 Hi! I\'m **RoadBot**, your 24/7 roadside assistant.\n\nI\'m here to guide you safely until our mechanic arrives. **What\'s happening with your vehicle?**';
        setTimeout(() => addQuickReplies(['Dead battery', 'Flat tyre', 'Ran out of fuel', 'Engine overheating', 'Need towing']), 100);
      }
      const el = appendAIMsg('', 'bot');
      el.innerHTML = greeting.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    }
    document.getElementById('ai-chat-input')?.focus();
  }
}

// Notify AI when a service request is made
function notifyAIRequestSubmitted(serviceType) {
  RoadBot.issue = serviceType;
  RoadBot.phase = 'requested';
  const win = document.getElementById('chat-window');
  if (win && !win.classList.contains('open')) {
    win.classList.add('open');
  }
  const box = document.getElementById('ai-chat-messages');
  if (box) {
    const el = document.createElement('div');
    el.className = 'chat-msg bot';
    el.style.cssText = 'background:linear-gradient(135deg,#E8FBF7,#D4F5EC);border:1px solid #A3E9D8;border-radius:12px;padding:.75rem 1rem';
    el.innerHTML = '✅ <strong>Request submitted!</strong> A mechanic is being matched right now.<br><br>I\'m starting your safety guide — follow these steps while you wait:';
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    // Start the guide automatically
    setTimeout(() => {
      RoadBot.stepIndex = 0;
      const reply = RoadBot.nextStep();
      const step = appendAIMsg('', 'bot');
      step.innerHTML = reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
      box.scrollTop = box.scrollHeight;
      addQuickReplies(['Next step ➡️', 'I need more help', 'Where is my mechanic?']);
    }, 800);
  }
}

// Add typing animation CSS
const style = document.createElement('style');
style.textContent = `
.typing-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #9AA5B4; display: inline-block;
  animation: typingBounce 1.2s infinite;
}
.typing-dot:nth-child(2) { animation-delay: .2s; }
.typing-dot:nth-child(3) { animation-delay: .4s; }
@keyframes typingBounce {
  0%,60%,100% { transform: translateY(0); opacity:.5; }
  30%          { transform: translateY(-6px); opacity:1; }
}
.chat-msg.bot strong { color: #1E3A5F; }
`;
document.head.appendChild(style);
