"use strict";

// App part: phone login. The device session (`GET /api/session`) and the „Prihlás sa“ panel.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).
// The pure parts (steps, validation, resend countdown) are in logic-phone.js.

// --- session: which protected parties this device has verified ---

// Loads the session after the first state and after every login, logout or phone change.
function loadSession() {
  return request("GET", "api/session", undefined, undefined, POLL_TIMEOUT_MS).then(function (r) {
    if (r.status === 200 && r.json && r.json.ok) {
      app.session = { verified: Array.isArray(r.json.verified) ? r.json.verified : [], sms_enabled: r.json.sms_enabled === true };
      checkStoredLogin();
      if (app.panel && app.panel.refresh) app.panel.refresh();
      if (app.state) render();
    }
  }, function () { /* offline: the next reload of the session tries again */ });
}

function sessionVerified() {
  return app.session ? app.session.verified : [];
}

// A remembered party that is protected but not verified on this device (a phone added later, an expired cookie):
// „Si: …“ shows the empty state and „Kto si?“ opens with the login panel. The remembered id stays in
// localStorage, so a closed panel asks again on the next load.
function checkStoredLogin() {
  if (!app.session || !app.state || !app.myParty) return;
  var party = partyById(app.state, app.myParty);
  if (!party || !needsLogin(party, sessionVerified(), app.state.phone_verify)) return;
  app.myParty = null;
  liveReopen();
  app.loginPending = party.id;
  app.askWho = true;
  if (app.introDone) openWhoIfAsked();
}

// --- the „Prihlás sa“ panel ---

// `opts.after` runs once the party is chosen. „Späť“ goes back to „Kto si?“.
// With `opts.phone` ("add" or "change") the same panel saves a number for `party` instead (phone/start + phone/verify,
// T-097): „Späť“ calls `opts.back`, and `opts.after` runs once the number is saved.
function openLogin(party, opts) {
  opts = opts || {};
  var managing = !!opts.phone, apiPath = managing ? "phone" : "login";
  var st = loginInitial();
  var timer = 0;
  var resendBtn = null;
  function stop() { if (timer) { clearInterval(timer); timer = 0; } }
  openPanel(managing ? (opts.phone === "change" ? PHONE_TEXTS.changeTitle : PHONE_TEXTS.addTitle) : "Prihlás sa", function (body, panel) {
    function failed(r) {
      st = loginReduce(st, { type: "failed", error: r.error || { code: "unknown" } });
      draw();
    }
    function send() {
      var phone = normalizePhoneInput(st.phone);
      st = loginReduce(st, { type: "send" });
      draw();
      request("POST", "api/parties/" + party.id + "/" + apiPath + "/start", { phone: phone }).then(function (r) {
        if (r.status === 200 && r.json && r.json.ok) {
          st = loginReduce(st, { type: "sent", at: Date.now() });
          draw(true);
        } else {
          failed({ error: r.json ? r.json.error : undefined });
        }
      }, function () { failed({}); });
    }
    function verify() {
      var phone = normalizePhoneInput(st.phone);
      st = loginReduce(st, { type: "verify" });
      draw();
      request("POST", "api/parties/" + party.id + "/" + apiPath + "/verify", { phone: phone, code: st.code }).then(function (r) {
        if (r.status === 200 && r.json && r.json.ok) {
          st = loginReduce(st, { type: "verified" });
          if (r.json.state && (!app.state || r.json.state.version >= app.state.version)) applyState(r.json.state);
          if (app.session && app.session.verified.indexOf(party.id) < 0) app.session.verified.push(party.id);
          loadSession();
          if (!managing) {
            setMyParty(party.id);
            app.night = defaultNightFor(party, app.state.event.nights);
          }
          closePanel();
          render();
          if (managing) showToast(PHONE_TEXTS.added, "info");
          if (opts.after) opts.after();
        } else {
          failed({ error: r.json ? r.json.error : undefined });
        }
      }, function () { failed({}); });
    }
    function draw(focusCode) {
      clearNode(body);
      resendBtn = null;
      var form = htmlEl("div", { "class": "pform" });
      body.appendChild(form);
      var error = htmlEl("p", { "class": "form-error", role: "alert" });
      if (st.error) error.textContent = errorText(st.error, app.state); else error.hidden = true;
      var input;
      if (st.step === "phone") {
        var hint = phoneHintText(party);
        form.appendChild(htmlEl("p", null, managing ? (opts.phone === "change" ? PHONE_TEXTS.changeIntro : PHONE_TEXTS.addIntro) :
          "Zadaj svoje telefónne číslo" + (hint ? " (končí na " + hint + ")" : "") + "."));
        var field = htmlEl("div", { "class": "field" });
        field.appendChild(htmlEl("label", { "for": "lg-phone" }, "Telefónne číslo"));
        input = htmlEl("input", { id: "lg-phone", type: "tel", inputmode: "tel", autocomplete: "tel", maxlength: "20", "data-key": "login-phone" });
        input.value = st.phone;
        input.addEventListener("input", function () {
          st = loginReduce(st, { type: "phone", value: input.value });
          sendBtn.disabled = !canSendLoginCode(st);
          error.hidden = true;
        });
        input.addEventListener("keydown", function (e) { if (e.key === "Enter" && canSendLoginCode(st)) send(); });
        field.appendChild(input);
        form.appendChild(field);
        form.appendChild(error);
        var sendBtn = htmlEl("button", { "class": "btn", type: "button", "data-key": "login-send" }, "Poslať kód");
        sendBtn.disabled = !canSendLoginCode(st);
        sendBtn.addEventListener("click", send);
        form.appendChild(sendBtn);
      } else {
        form.appendChild(htmlEl("p", null, "Poslali sme ti SMS s kódom na " + formatPhoneDisplay(st.phone) + "."));
        var cfield = htmlEl("div", { "class": "field" });
        cfield.appendChild(htmlEl("label", { "for": "lg-code" }, "Kód z SMS"));
        input = htmlEl("input", {
          id: "lg-code", type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "6",
          pattern: "[0-9]*", "data-key": "login-code"
        });
        input.value = st.code;
        input.addEventListener("input", function () {
          st = loginReduce(st, { type: "code", value: input.value });
          if (input.value !== st.code) input.value = st.code;
          verifyBtn.disabled = !canVerifyLoginCode(st);
          error.hidden = true;
        });
        input.addEventListener("keydown", function (e) { if (e.key === "Enter" && canVerifyLoginCode(st)) verify(); });
        cfield.appendChild(input);
        form.appendChild(cfield);
        form.appendChild(error);
        var verifyBtn = htmlEl("button", { "class": "btn", type: "button", "data-key": "login-verify" }, "Overiť");
        verifyBtn.disabled = !canVerifyLoginCode(st);
        verifyBtn.addEventListener("click", verify);
        form.appendChild(verifyBtn);
        resendBtn = htmlEl("button", { "class": "btn secondary", type: "button", "data-key": "login-resend" });
        resendBtn.addEventListener("click", function () { if (canResend(st, Date.now())) send(); });
        form.appendChild(resendBtn);
        tick();
      }
      var back = htmlEl("button", { "class": "btn secondary", type: "button", "data-key": "login-back" }, "Späť");
      back.addEventListener("click", function () {
        closePanel();
        if (managing) { if (opts.back) opts.back(); return; }
        openWho(opts.after ? { after: opts.after } : undefined);
      });
      form.appendChild(back);
      if (focusCode !== false && input && (focusCode === true || !st.busy)) input.focus();
    }
    function tick() {
      if (!resendBtn) return;
      var left = resendSecondsLeft(st.sentAt, Date.now());
      resendBtn.textContent = left > 0 ? "Poslať znova (" + left + " s)" : "Poslať znova";
      resendBtn.disabled = !canResend(st, Date.now());
    }
    timer = setInterval(tick, 1000);
    draw();
  }, { returnKey: managing ? undefined : "who", center: true, onClose: stop });
}
