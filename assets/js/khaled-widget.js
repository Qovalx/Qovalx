/**
 * KHALED - QOVALX chatbox widget
 * Path in repository: /assets/js/khaled-widget.js
 *
 * Framework free. Add one line before </body> in every page layout:
 *   <script defer src="/assets/js/khaled-widget.js"></script>
 *
 * No visible text lives in this file. Every string is loaded from
 * /assets/i18n/khaled/<locale>.json, chosen from the page language.
 */

(function () {
  "use strict";

  var ENDPOINT = "/api/khaled";
  var I18N_PATH = "/assets/i18n/khaled/";
  var LOCALES = ["ar", "en", "ru", "zh-Hans", "fr", "es", "hi"];
  var RTL = ["ar"];
  var MAX_LENGTH = 1200;

  var locale = detectLocale();
  var strings = null;
  var messages = [];
  var sending = false;
  var open = false;
  var root, panel, stream, input, sendButton, launcher, launcherLabel, greeting, status;

  function matchLocale(value) {
    var lower = String(value || "").trim().toLowerCase();
    if (!lower) return null;
    var i;
    for (i = 0; i < LOCALES.length; i++) {
      if (LOCALES[i].toLowerCase() === lower) return LOCALES[i];
    }
    var base = lower.split("-")[0];
    for (i = 0; i < LOCALES.length; i++) {
      if (LOCALES[i].toLowerCase().split("-")[0] === base) return LOCALES[i];
    }
    return null;
  }

  function detectLocale() {
    return (
      matchLocale(document.documentElement.getAttribute("lang")) ||
      matchLocale(location.pathname.split("/")[1]) ||
      "en"
    );
  }

  function t(key) {
    return (strings && strings[key]) || "";
  }

  function loadStrings() {
    return fetch(I18N_PATH + locale + ".json")
      .then(function (res) {
        if (!res.ok) throw new Error("i18n");
        return res.json();
      })
      .catch(function () {
        return fetch(I18N_PATH + "en.json").then(function (res) { return res.json(); });
      })
      .then(function (data) { strings = data; });
  }

  function injectStyles() {
    var css = [
      ".qx-khaled{position:fixed;inset-inline-end:24px;inset-block-end:24px;z-index:9000;font-family:inherit;color:#011230}",
      ".qx-khaled *{box-sizing:border-box}",
      ".qx-launcher{display:inline-flex;align-items:center;gap:10px;padding:13px 22px;border:1px solid #D7A347;border-radius:2px;background:#011230;color:#FFF9F2;font:inherit;font-size:13px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:background .2s ease,color .2s ease}",
      ".qx-launcher:hover{background:#F1E3D8;color:#011230}",
      ".qx-dot{width:7px;height:7px;background:#D7A347;border-radius:50%}",
      ".qx-panel{position:absolute;inset-block-end:60px;inset-inline-end:0;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 140px));display:flex;flex-direction:column;background:#FFF9F2;border:1px solid rgba(1,18,48,.12);border-top:2px solid #D7A347;border-radius:2px;box-shadow:0 24px 60px rgba(1,18,48,.22);overflow:hidden}",
      ".qx-head{padding:20px 22px 16px;background:#011230;color:#FFF9F2}",
      ".qx-eyebrow{margin:0;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#D7A347}",
      ".qx-title{margin:6px 0 0;font-size:19px;font-weight:600}",
      ".qx-disclosure{margin:8px 0 0;font-size:12px;line-height:1.55;opacity:.72}",
      ".qx-stream{flex:1;overflow-y:auto;padding:20px 22px;display:flex;flex-direction:column;gap:14px}",
      ".qx-greeting{margin:0;font-size:14px;line-height:1.65}",
      ".qx-msg{max-width:88%;font-size:14px;line-height:1.65;white-space:pre-wrap;border-radius:2px;padding:11px 15px}",
      ".qx-user{align-self:flex-end;background:#011230;color:#FFF9F2}",
      ".qx-bot{align-self:flex-start;background:#F1E3D8;border-inline-start:2px solid #D7A347}",
      ".qx-note{align-self:flex-start;max-width:88%;margin:0;font-size:12px;line-height:1.5;padding-inline-start:2px}",
      // #8C2F2F is a deliberate exception to the brand palette: a system state
      // colour, not a brand colour. An error has to read as an error at a
      // glance. Leave it in place; do not fold it back into the palette.
      ".qx-error{color:#8C2F2F}",
      ".qx-quiet{opacity:.6}",
      ".qx-composer{display:flex;gap:10px;padding:14px;border-top:1px solid rgba(1,18,48,.1);background:#F1E3D8}",
      ".qx-composer textarea{flex:1;resize:none;padding:10px 12px;font:inherit;font-size:14px;line-height:1.5;color:#011230;background:#FFF9F2;border:1px solid rgba(1,18,48,.18);border-radius:2px}",
      ".qx-composer button{padding:0 18px;font:inherit;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#FFF9F2;background:#011230;border:1px solid #011230;border-radius:2px;cursor:pointer}",
      ".qx-composer button[disabled]{opacity:.4;cursor:default}",
      ".qx-khaled :focus-visible{outline:2px solid #D7A347;outline-offset:2px}",
      ".qx-foot{padding:10px 14px;font-size:11px;line-height:1.5;text-align:center;background:#F1E3D8;border-top:1px solid rgba(1,18,48,.08);opacity:.7}",
      "@media (prefers-reduced-motion:reduce){.qx-khaled *{transition:none!important}}",
      "@media (max-width:480px){.qx-khaled{inset-inline-end:16px;inset-block-end:16px}}"
    ].join("");
    var tag = document.createElement("style");
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function build() {
    root = document.createElement("div");
    root.className = "qx-khaled";
    root.setAttribute("dir", RTL.indexOf(locale) !== -1 ? "rtl" : "ltr");
    root.setAttribute("lang", locale);

    launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "qx-launcher";
    launcher.setAttribute("aria-expanded", "false");

    var dot = document.createElement("span");
    dot.className = "qx-dot";
    dot.setAttribute("aria-hidden", "true");
    launcherLabel = el("span", "qx-launcher-label", t("launcher_open"));
    launcher.appendChild(dot);
    launcher.appendChild(launcherLabel);
    launcher.addEventListener("click", toggle);

    root.appendChild(launcher);
    document.body.appendChild(root);
  }

  function buildPanel() {
    panel = document.createElement("section");
    panel.className = "qx-panel";
    panel.setAttribute("aria-label", t("title"));

    var head = document.createElement("header");
    head.className = "qx-head";
    head.appendChild(el("p", "qx-eyebrow", t("eyebrow")));
    head.appendChild(el("h2", "qx-title", t("title")));
    head.appendChild(el("p", "qx-disclosure", t("disclosure")));

    stream = document.createElement("div");
    stream.className = "qx-stream";
    stream.setAttribute("role", "log");
    stream.setAttribute("aria-live", "polite");
    greeting = el("p", "qx-greeting", t("greeting"));
    stream.appendChild(greeting);

    var composer = document.createElement("div");
    composer.className = "qx-composer";
    input = document.createElement("textarea");
    input.rows = 2;
    input.maxLength = MAX_LENGTH;
    input.placeholder = t("placeholder");
    input.setAttribute("aria-label", t("placeholder"));
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    });
    input.addEventListener("input", refreshSendState);

    sendButton = document.createElement("button");
    sendButton.type = "button";
    sendButton.textContent = t("send");
    sendButton.disabled = true;
    sendButton.addEventListener("click", send);

    composer.appendChild(input);
    composer.appendChild(sendButton);

    panel.appendChild(head);
    panel.appendChild(stream);
    panel.appendChild(composer);
    panel.appendChild(el("footer", "qx-foot", t("footer")));
    root.appendChild(panel);
  }

  function toggle() {
    open = !open;
    launcher.setAttribute("aria-expanded", String(open));
    launcherLabel.textContent = t(open ? "launcher_close" : "launcher_open");
    if (open) {
      if (!panel) buildPanel();
      panel.style.display = "flex";
      input.focus();
    } else if (panel) {
      panel.style.display = "none";
    }
  }

  function refreshSendState() {
    sendButton.disabled = sending || !input.value.trim();
  }

  function append(className, text) {
    var node = el("div", "qx-msg " + className, text);
    stream.appendChild(node);
    stream.scrollTop = stream.scrollHeight;
    return node;
  }

  function note(className, text) {
    var node = el("p", "qx-note " + className, text);
    stream.appendChild(node);
    stream.scrollTop = stream.scrollHeight;
    return node;
  }

  function send() {
    var text = input.value.trim();
    if (!text || sending) return;

    if (greeting) { greeting.remove(); greeting = null; } // the greeting stands in for an empty stream only
    append("qx-user", text);
    messages.push({ role: "user", content: text });
    input.value = "";
    sending = true;
    refreshSendState();
    if (status) status.remove();
    status = note("qx-quiet", t("typing"));

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: messages, locale: locale })
    })
      .then(function (res) {
        if (res.status === 429) throw new Error("error_rate");
        if (!res.ok) throw new Error("error_unavailable");
        return res.json();
      })
      .then(function (data) {
        status.remove();
        status = null;
        append("qx-bot", data.reply);
        messages.push({ role: "assistant", content: data.reply });
        if (data.escalated) note("", t("escalated"));
      })
      .catch(function (error) {
        status.remove();
        status = null;
        var key = error && error.message && t(error.message) ? error.message : "error_network";
        note("qx-error", t(key));
      })
      .then(function () {
        sending = false;
        refreshSendState();
        input.focus();
      });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && open) toggle();
  });

  loadStrings().then(function () {
    injectStyles();
    build();
  });
})();
