(function () {
  var script = document.currentScript;
  var clientId = script ? script.getAttribute("data-client-id") : null;
  if (!clientId) return;

  var SUPABASE_URL = script.getAttribute("data-supabase-url") || "https://YOUR_PROJECT.supabase.co";
  var ENDPOINT = SUPABASE_URL + "/functions/v1/chatbot-widget";
  var sessionId = "sess_" + Math.random().toString(36).slice(2) + Date.now();
  var history = [];
  var isOpen = false;

  var PRIMARY = "#e8621a";
  var DARK = "#1e293b";

  function injectStyles() {
    var style = document.createElement("style");
    style.textContent = [
      "#m2-chat-btn{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:" + PRIMARY + ";border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;z-index:99998;transition:transform .15s;}",
      "#m2-chat-btn:hover{transform:scale(1.08);}",
      "#m2-chat-btn svg{width:26px;height:26px;fill:#fff;}",
      "#m2-chat-window{position:fixed;bottom:92px;right:24px;width:340px;max-width:calc(100vw - 32px);height:480px;max-height:calc(100vh - 120px);background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.2);display:flex;flex-direction:column;z-index:99997;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;transition:opacity .15s,transform .15s;}",
      "#m2-chat-window.m2-hidden{opacity:0;transform:translateY(12px);pointer-events:none;}",
      "#m2-chat-header{background:" + DARK + ";padding:14px 16px;display:flex;align-items:center;justify-content:space-between;}",
      "#m2-chat-header span{color:#fff;font-size:14px;font-weight:700;}",
      "#m2-chat-close{background:none;border:none;cursor:pointer;color:#94a3b8;font-size:18px;line-height:1;padding:0;}",
      "#m2-chat-close:hover{color:#fff;}",
      "#m2-chat-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}",
      ".m2-msg{max-width:82%;padding:9px 13px;border-radius:10px;font-size:14px;line-height:1.55;word-break:break-word;}",
      ".m2-msg.bot{background:#f1f5f9;color:" + DARK + ";align-self:flex-start;border-bottom-left-radius:2px;}",
      ".m2-msg.user{background:" + PRIMARY + ";color:#fff;align-self:flex-end;border-bottom-right-radius:2px;}",
      ".m2-typing{display:flex;gap:4px;align-items:center;padding:9px 13px;background:#f1f5f9;border-radius:10px;border-bottom-left-radius:2px;align-self:flex-start;}",
      ".m2-typing span{width:7px;height:7px;background:#94a3b8;border-radius:50%;animation:m2bounce .9s infinite;}",
      ".m2-typing span:nth-child(2){animation-delay:.15s;}",
      ".m2-typing span:nth-child(3){animation-delay:.3s;}",
      "@keyframes m2bounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-5px);}}",
      "#m2-chat-input-row{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #e2e8f0;}",
      "#m2-chat-input{flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:9px 12px;font-size:14px;outline:none;font-family:inherit;}",
      "#m2-chat-input:focus{border-color:" + PRIMARY + ";}",
      "#m2-chat-send{background:" + PRIMARY + ";color:#fff;border:none;border-radius:8px;padding:9px 14px;cursor:pointer;font-size:14px;font-weight:600;white-space:nowrap;}",
      "#m2-chat-send:hover{opacity:.9;}",
      "#m2-chat-send:disabled{opacity:.5;cursor:default;}"
    ].join("");
    document.head.appendChild(style);
  }

  function createUI() {
    var btn = document.createElement("button");
    btn.id = "m2-chat-btn";
    btn.setAttribute("aria-label", "Open chat");
    btn.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/></svg>';

    var win = document.createElement("div");
    win.id = "m2-chat-window";
    win.className = "m2-hidden";
    win.innerHTML =
      '<div id="m2-chat-header"><span>Chat with us</span><button id="m2-chat-close" aria-label="Close chat">&times;</button></div>' +
      '<div id="m2-chat-messages"></div>' +
      '<div id="m2-chat-input-row">' +
      '<input id="m2-chat-input" type="text" placeholder="Type a message..." autocomplete="off">' +
      '<button id="m2-chat-send">Send</button>' +
      "</div>";

    document.body.appendChild(btn);
    document.body.appendChild(win);

    btn.addEventListener("click", function () { toggleChat(true); });
    document.getElementById("m2-chat-close").addEventListener("click", function () { toggleChat(false); });
    document.getElementById("m2-chat-send").addEventListener("click", sendMessage);
    document.getElementById("m2-chat-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    appendMessage("bot", "Hi! How can I help you today?");
  }

  function toggleChat(open) {
    isOpen = open;
    var win = document.getElementById("m2-chat-window");
    if (isOpen) {
      win.classList.remove("m2-hidden");
      document.getElementById("m2-chat-input").focus();
    } else {
      win.classList.add("m2-hidden");
    }
  }

  function appendMessage(role, text) {
    var msgs = document.getElementById("m2-chat-messages");
    var div = document.createElement("div");
    div.className = "m2-msg " + role;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function showTyping() {
    var msgs = document.getElementById("m2-chat-messages");
    var div = document.createElement("div");
    div.className = "m2-typing";
    div.innerHTML = "<span></span><span></span><span></span>";
    div.id = "m2-typing-indicator";
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById("m2-typing-indicator");
    if (el) el.parentNode.removeChild(el);
  }

  function sendMessage() {
    var input = document.getElementById("m2-chat-input");
    var sendBtn = document.getElementById("m2-chat-send");
    var text = (input.value || "").trim();
    if (!text) return;

    input.value = "";
    sendBtn.disabled = true;

    appendMessage("user", text);
    history.push({ role: "user", content: text });

    showTyping();

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, session_id: sessionId, message: text, history: history.slice(-10) }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTyping();
        var reply = data.response || "Sorry, something went wrong. Please try again.";
        appendMessage("bot", reply);
        history.push({ role: "assistant", content: reply });
        sendBtn.disabled = false;
        document.getElementById("m2-chat-input").focus();
      })
      .catch(function () {
        hideTyping();
        appendMessage("bot", "Sorry, I'm having trouble connecting. Please call us directly.");
        sendBtn.disabled = false;
      });
  }

  injectStyles();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createUI);
  } else {
    createUI();
  }
})();
