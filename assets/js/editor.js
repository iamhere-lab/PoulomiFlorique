/* Poulomi Florique: live text editing.
 *
 * 1. On every load (preview AND deployed site): tags each text element with a
 *    stable key and applies saved text from content.json, if present.
 * 2. In the Claude preview, for people allowed to edit: shows an "Edit page"
 *    button. Edit mode makes text editable in place; Save writes content.json
 *    back to the artifact as a new version (the page itself never changes).
 */
(function () {
  "use strict";

  var CANDIDATES = [
    "main h1", "main h2", "main h3", "main p", "main li", "main dt", "main dd",
    "main figcaption", "main strong", "main .hero-stats span", "main .tag", "main .no",
    "main .btn", "main .text-link", ".site-header nav a", ".site-header .btn",
    ".site-footer p", ".action-bar button", ".modal-banner-text p", ".modal-inner .form-lede",
    ".hero-form .form-title", ".hero-form .form-lede"
  ].join(",");
  var EXCLUDE = ".js-phone-text, .js-modal-title, .js-consent-entity, .js-agent-rera, .js-privacy-link, template, svg, .lead-form, .js-form-slot, .plan-source, dialog.lightbox";
  var INLINE = { EM: 1, STRONG: 1, B: 1, I: 1, BR: 1 };

  var editable = {};   // key -> element
  var original = {};   // key -> html as served
  var saved = {};      // key -> html from content.json

  function sectionKey(el) {
    var s = el.closest("section[id], header, footer, .action-bar, dialog");
    if (!s) return "page";
    return s.id || (s.classList[0] || s.tagName.toLowerCase());
  }

  function qualifies(el) {
    if (el.closest(EXCLUDE) || el.matches(EXCLUDE)) return null;
    var kids = Array.prototype.slice.call(el.childNodes);
    var hasText = /\S/.test(el.textContent);
    if (!hasText) return null;
    var onlyInline = kids.every(function (n) {
      return n.nodeType === 3 || (n.nodeType === 1 && INLINE[n.tagName] && !n.querySelector("*:not(br)"));
    });
    if (onlyInline) return el;
    // icon + text (e.g. pin list items, buttons with an icon): wrap the text run in a span
    var icons = kids.filter(function (n) { return n.nodeType === 1; });
    if (icons.length && icons.every(function (n) { return n.tagName.toLowerCase() === "svg"; })) {
      var texts = kids.filter(function (n) { return n.nodeType === 3 && /\S/.test(n.nodeValue); });
      if (texts.length === 1) {
        var span = document.createElement("span");
        span.className = "ss-t";
        texts[0].parentNode.insertBefore(span, texts[0]);
        span.appendChild(texts[0]);
        return span;
      }
    }
    return null;
  }

  // Tag in document order with stable, section-scoped keys.
  var counters = {};
  var taken = [];
  document.querySelectorAll(CANDIDATES).forEach(function (el) {
    if (taken.some(function (t) { return t.contains(el); })) return; // already inside an editable
    var target = qualifies(el);
    if (!target) return;
    var sk = sectionKey(target);
    counters[sk] = (counters[sk] || 0) + 1;
    var key = sk + "-" + counters[sk];
    target.setAttribute("data-edit", key);
    editable[key] = target;
    original[key] = target.innerHTML.trim();
    taken.push(target);
  });

  /* Allow only simple inline formatting in saved text. */
  function clean(html) {
    var tpl = document.createElement("template");
    tpl.innerHTML = html;
    function walk(node) {
      var out = "";
      node.childNodes.forEach(function (n) {
        if (n.nodeType === 3) {
          out += n.nodeValue.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        } else if (n.nodeType === 1) {
          var t = n.tagName;
          if (t === "BR") out += "<br>";
          else if (t === "DIV" || t === "P") out += (out ? "<br>" : "") + walk(n);
          else if (INLINE[t]) out += "<" + t.toLowerCase() + ">" + walk(n) + "</" + t.toLowerCase() + ">";
          else out += walk(n);
        }
      });
      return out;
    }
    return walk(tpl.content).replace(/ /g, " ").replace(/(<br>)+$/, "").trim();
  }

  function apply(map) {
    Object.keys(map || {}).forEach(function (k) {
      if (editable[k] && typeof map[k] === "string") editable[k].innerHTML = clean(map[k]);
    });
  }

  var loaded = fetch("content.json", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) { if (data && data.edits) { saved = data.edits; apply(saved); } })
    .catch(function () { /* no saved edits yet */ });

  /* ---------- editor UI (Claude preview only) ---------- */
  if (!window.claude || typeof window.claude.use !== "function") return;

  var artifact = null;
  var editing = false;
  var bar, editBtn, statusEl;

  function ui() {
    var css = document.createElement("style");
    css.textContent =
      ".ss-edit-btn{position:fixed;left:16px;bottom:16px;z-index:70;background:#d41f30;color:#ffffff;border:1px solid rgba(255,255,255,.5);border-radius:999px;padding:10px 16px;font:600 13px/1 system-ui,sans-serif;box-shadow:0 10px 26px -10px rgba(0,0,0,.6);cursor:pointer}" +
      ".ss-edit-btn:hover{background:#b0162a}" +
      ".ss-bar{position:fixed;left:16px;bottom:16px;z-index:80;display:flex;gap:10px;align-items:center;background:#d41f30;color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:10px;padding:8px 10px 8px 14px;font:500 13px/1.3 system-ui,sans-serif;box-shadow:0 16px 40px -14px rgba(0,0,0,.7);max-width:calc(100vw - 24px);flex-wrap:wrap}" +
      ".ss-bar button{font:600 13px/1 system-ui,sans-serif;border-radius:6px;padding:9px 14px;cursor:pointer;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff}" +
      ".ss-bar .ss-save{background:#3a4891;border-color:#3a4891;color:#d41f30}" +
      ".ss-bar .ss-save[disabled]{opacity:.5;cursor:default}" +
      ".ss-bar .ss-status{color:#ffffff;min-width:0}" +
      "html.ss-editing [data-edit]{outline:1px dashed rgba(255,255,255,.85);outline-offset:3px;cursor:text;border-radius:2px}" +
      "html.ss-editing [data-edit]:hover{outline-style:solid}" +
      "html.ss-editing [data-edit]:focus{outline:2px solid #3a4891;background:rgba(255,255,255,.12)}" +
      "html.ss-editing [data-edit].ss-changed{outline-color:#3fae6a}" +
      "@media(max-width:899px){.ss-edit-btn,.ss-bar{bottom:84px}}";
    document.head.appendChild(css);

    editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "ss-edit-btn";
    editBtn.textContent = "✎ Edit page";
    editBtn.addEventListener("click", startEditing);
    document.body.appendChild(editBtn);

    bar = document.createElement("div");
    bar.className = "ss-bar";
    bar.hidden = true;
    bar.innerHTML = '<span class="ss-status">Editing: click any text to change it.</span>' +
      '<button type="button" class="ss-cancel">Cancel</button>' +
      '<button type="button" class="ss-reset" title="Put every text back to the original version">Reset all</button>' +
      '<button type="button" class="ss-save" disabled>Save</button>';
    document.body.appendChild(bar);
    statusEl = bar.querySelector(".ss-status");
    bar.querySelector(".ss-cancel").addEventListener("click", cancelEditing);
    bar.querySelector(".ss-reset").addEventListener("click", resetAll);
    bar.querySelector(".ss-save").addEventListener("click", save);
  }

  function current(key) { return clean(editable[key].innerHTML); }
  function baseline(key) { return clean(saved[key] != null ? saved[key] : original[key]); }

  function changedKeys() {
    return Object.keys(editable).filter(function (k) { return current(k) !== baseline(k); });
  }

  function refresh() {
    var n = changedKeys().length;
    Object.keys(editable).forEach(function (k) { editable[k].classList.toggle("ss-changed", current(k) !== baseline(k)); });
    bar.querySelector(".ss-save").disabled = n === 0;
    statusEl.textContent = n ? n + " change" + (n > 1 ? "s" : "") + " not saved yet" : "Editing: click any text to change it.";
  }

  // While editing, links and buttons must not navigate or open popups.
  function block(e) {
    if (!editing) return;
    if (e.target.closest(".ss-bar")) return;
    var hit = e.target.closest("a, button, [data-edit]");
    if (hit) { e.preventDefault(); e.stopPropagation(); }
    var ed = e.target.closest("[data-edit]");
    if (ed && e.type === "click") ed.focus();
  }
  function keydown(e) {
    if (!editing) return;
    var ed = e.target.closest && e.target.closest("[data-edit]");
    if (!ed) return;
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ed.blur(); }
    if (e.key === "Escape") { e.preventDefault(); ed.blur(); }
  }
  function paste(e) {
    var ed = e.target.closest && e.target.closest("[data-edit]");
    if (!editing || !ed) return;
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text.replace(/\s*\n\s*/g, " "));
  }

  function setEditable(on) {
    Object.keys(editable).forEach(function (k) {
      var el = editable[k];
      if (on) { el.setAttribute("contenteditable", "true"); el.setAttribute("spellcheck", "true"); }
      else { el.removeAttribute("contenteditable"); el.removeAttribute("spellcheck"); el.classList.remove("ss-changed"); }
    });
  }

  function startEditing() {
    editing = true;
    document.documentElement.classList.add("ss-editing");
    document.querySelectorAll("dialog[open]").forEach(function (d) { d.close(); });
    setEditable(true);
    editBtn.hidden = true;
    bar.hidden = false;
    refresh();
  }

  function stopEditing() {
    editing = false;
    document.documentElement.classList.remove("ss-editing");
    setEditable(false);
    editBtn.hidden = false;
    bar.hidden = true;
  }

  function cancelEditing() {
    Object.keys(editable).forEach(function (k) { editable[k].innerHTML = baseline(k); });
    stopEditing();
  }

  function resetAll() {
    if (!window.confirm("Put every text on the page back to the original version? You still need to press Save.")) return;
    Object.keys(editable).forEach(function (k) { editable[k].innerHTML = clean(original[k]); });
    refresh();
  }

  function save() {
    var keys = changedKeys();
    if (!keys.length) return;
    var next = {};
    Object.keys(saved).forEach(function (k) { next[k] = saved[k]; });
    keys.forEach(function (k) {
      var v = current(k);
      if (v === clean(original[k])) delete next[k]; else next[k] = v;
    });
    var btn = bar.querySelector(".ss-save");
    btn.disabled = true;
    statusEl.textContent = "Saving…";
    try { sessionStorage.setItem("ss_edit_draft", JSON.stringify(next)); } catch (e) {}
    var body = JSON.stringify({ v: 1, updated: new Date().toISOString(), edits: next }, null, 2);
    artifact.publish({ "content.json": { content: body, contentType: "application/json" } })
      .then(function () {
        saved = next;
        try { sessionStorage.removeItem("ss_edit_draft"); } catch (e) {}
        stopEditing();
        editBtn.textContent = "✓ Saved · Edit page";
        setTimeout(function () { editBtn.textContent = "✎ Edit page"; }, 3000);
      })
      .catch(function (err) {
        var code = err && err.code;
        if (code === "conflict") { statusEl.textContent = "Someone else saved first. Reloading with their version…"; return; }
        if (code === "not_writer" || code === "not_granted" || code === "not_declared" || code === "capability_disabled" || code === "consent_required" || code === "capability_removed") {
          statusEl.textContent = "This view can't save changes (view-only access).";
          return;
        }
        if (code === "rate_limited") { statusEl.textContent = "Saving too often. Wait a moment, then press Save again."; btn.disabled = false; return; }
        statusEl.textContent = "Couldn't save just now. Please press Save again.";
        btn.disabled = false;
      });
  }

  document.addEventListener("click", block, true);
  document.addEventListener("keydown", keydown, true);
  document.addEventListener("paste", paste, true);
  document.addEventListener("input", function (e) { if (editing && e.target.closest && e.target.closest("[data-edit]")) refresh(); }, true);
  document.addEventListener("focusout", function (e) { if (editing && e.target.closest && e.target.closest("[data-edit]")) refresh(); }, true);
  window.addEventListener("beforeunload", function (e) { if (editing && changedKeys().length) { e.preventDefault(); e.returnValue = ""; } });

  window.claude.use("artifact").then(function (ns) {
    if (!ns) return;
    artifact = ns;
    return window.claude.use("user").then(function (u) {
      return u ? u.canEdit() : null;
    }).catch(function () { return null; }).then(function (can) {
      if (can === false) return; // view-only visitors never see the editor
      return loaded.then(ui);
    });
  });
})();
