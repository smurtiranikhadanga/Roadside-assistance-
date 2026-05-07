/* ai-chat.js — AI Roadside Chatbot */

let chatHistory = [];

async function sendAIMessage() {
  const input = document.getElementById('ai-chat-input');
  const msg   = input?.value.trim();
  if (!msg) return;

  input.value = '';
  appendAIMessage(msg, 'user');
  chatHistory.push({ role: 'user', content: msg });

  // Typing indicator
  const typingEl = appendAIMessage('...', 'bot', true);

  try {
    const res = await api('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message: msg, history: chatHistory })
    });
    typingEl.remove();
    const reply = res.reply || 'Sorry, I could not process that.';
    appendAIMessage(reply, 'bot');
    chatHistory.push({ role: 'assistant', content: reply });
  } catch {
    typingEl.remove();
    appendAIMessage('Connection error. Please try again.', 'bot');
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
