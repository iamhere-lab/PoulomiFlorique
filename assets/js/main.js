/* Poulomi Florique landing page: behaviour.
 * Lead forms, enquiry popup (auto + on click, intent-aware), gated floor plans,
 * hero slider, lightbox, WhatsApp, mobile action bar, dataLayer events (no PII).
 */
(function () {
  "use strict";

  var CFG = window.SS_CONFIG || {};
  var dl = (window.dataLayer = window.dataLayer || []);
  function track(event, params) {
    var payload = { event: event };
    for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) payload[k] = params[k];
    dl.push(payload);
  }
  function ss(key, val) {
    try {
      if (val === undefined) return sessionStorage.getItem(key);
      sessionStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  /* ---------- config-driven content ---------- */
  if (CFG.phoneE164) document.querySelectorAll(".js-phone").forEach(function (a) { a.href = "tel:" + CFG.phoneE164; });
  if (CFG.phoneDisplay) {
    var phoneNb = String(CFG.phoneDisplay).replace(/ /g, "\u00a0");
    document.querySelectorAll(".js-phone-text").forEach(function (s) { s.textContent = phoneNb; });
    document.querySelectorAll(".icon-btn.js-phone").forEach(function (a) { a.setAttribute("aria-label", "Call sales on " + CFG.phoneDisplay); });
  }
  if (CFG.privacyUrl) {
    document.querySelectorAll(".js-privacy-link").forEach(function (s) {
      var a = document.createElement("a"); a.href = CFG.privacyUrl; a.textContent = "Read the privacy policy."; a.rel = "noopener"; s.appendChild(a);
    });
  }
  if (CFG.agentRera) document.querySelectorAll(".js-agent-rera").forEach(function (s) { s.textContent = " · Agent RERA: " + CFG.agentRera; });
  if (CFG.whatsappNumber) {
    var waHref = "https://wa.me/" + String(CFG.whatsappNumber).replace(/\D/g, "") + "?text=" + encodeURIComponent(CFG.whatsappMessage || "");
    document.querySelectorAll(".js-whatsapp").forEach(function (a) { a.href = waHref; a.hidden = false; });
  }
  // Canonical URL: set SS_CONFIG.siteUrl once the domain is final; otherwise use the live URL without query/hash.
  if (!document.querySelector('link[rel="canonical"]') && /^https?:$/.test(location.protocol)) {
    var can = document.createElement("link"); can.rel = "canonical";
    can.href = CFG.siteUrl || (location.origin + location.pathname);
    document.head.appendChild(can);
  }

  if (/[?&]review=1\b/.test(location.search)) document.documentElement.classList.add("review-mode");

  /* ---------- attribution (UTMs + click IDs), kept for the session ---------- */
  var ATTR_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid", "fbclid", "msclkid"];
  var attribution = {};
  try { attribution = JSON.parse(ss("ss_attr") || "{}") || {}; } catch (e) { attribution = {}; }
  var qs = new URLSearchParams(location.search);
  var fresh = false;
  ATTR_KEYS.forEach(function (k) { var v = qs.get(k); if (v) { attribution[k] = v.slice(0, 200); fresh = true; } });
  if (fresh || !attribution.landing_page) {
    attribution.landing_page = attribution.landing_page || location.href.split("#")[0];
    attribution.referrer = attribution.referrer || document.referrer || "";
    ss("ss_attr", JSON.stringify(attribution));
  }

  /* ---------- state ---------- */
  var pageLoadedAt = Date.now();
  var submitted = ss("ss_lead") === "1"; // one lead per session
  var anyFormStarted = false;
  var modalIntent = "general";
  var modalConfig = ""; // unit type from the button that opened the popup (e.g. a floor-plan card)

  var INTENTS = {
    general:    { title: "Unlock price & floor plans", button: "Get Price Sheet & Floor Plans" },
    price:      { title: "Get the complete price sheet", button: "Send Me the Price Sheet" },
    brochure:   { title: "Download the brochure",    button: "Download Brochure" },
    floor_plan: { title: "Download the floor plans", button: "Send Me the Floor Plans" },
    site_visit: { title: "Book your private site visit", button: "Reserve My Visit Slot" }
  };

  function unlockPlans() {
    document.querySelectorAll(".fp-grid").forEach(function (g) { g.classList.add("is-unlocked"); });
    document.querySelectorAll(".fp-lock").forEach(function (l) { l.remove(); });
  }
  if (submitted) unlockPlans();

  /* ---------- lead forms ---------- */
  var tpl = document.getElementById("lead-form-tpl");

  /* Rejects obviously fake numbers: one or two distinct digits (9999999999, 9090909090),
   * long runs of one digit (9000000001), straight sequences (9876543210, 6789012345)
   * and repeated blocks (9898989898, 9876598765). */
  function isJunkNumber(d) {
    var distinct = {}; for (var i = 0; i < d.length; i++) distinct[d.charAt(i)] = 1;
    if (Object.keys(distinct).length <= 2) return true;
    if (/(\d)\1{6,}/.test(d)) return true;
    var up = "01234567890123456789", down = "98765432109876543210";
    if (up.indexOf(d) > -1 || down.indexOf(d) > -1) return true;
    for (var n = 1; n <= d.length / 2; n++) {
      if (d.length % n) continue;
      if (d.slice(0, n).repeat(d.length / n) === d) return true;
    }
    return false;
  }
  function phoneValid(cc, digits) {
    var ok = cc === "+91" ? /^[6-9]\d{9}$/.test(digits) : /^\d{6,14}$/.test(digits);
    return ok && !isJunkNumber(digits);
  }
  function emailValid(e) {
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e)) return false;
    return !/@(example|test|abc|xyz|asdf|email|mail)\.(com|in|org)$/i.test(e);
  }
  function setError(form, name, msg) {
    var input = form.querySelector('[name="' + name + '"]');
    var err = form.querySelector('[data-err="' + name + '"]');
    if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (err) err.textContent = msg || "";
  }
  function validate(form) {
    var ok = true, first = null;
    var name = form.elements.name.value.trim();
    var cc = form.elements.cc.value;
    var digits = form.elements.phone.value.replace(/\D/g, "");
    if (cc === "+91" && digits.length === 12 && digits.indexOf("91") === 0) digits = digits.slice(2);
    if (cc === "+91" && digits.length === 13 && digits.indexOf("091") === 0) digits = digits.slice(3);
    if (cc === "+91" && digits.length === 11 && digits.charAt(0) === "0") digits = digits.slice(1);
    if (name.length < 2 || !/[A-Za-zऀ-ൿ]/.test(name)) { setError(form, "name", "Please enter your name."); ok = false; first = first || form.elements.name; }
    else setError(form, "name", "");
    if (!phoneValid(cc, digits)) { setError(form, "phone", cc === "+91" ? "Please enter your real 10-digit mobile number (starting 6–9)." : "Please enter your real mobile number."); ok = false; first = first || form.elements.phone; }
    else setError(form, "phone", "");
    var email = form.elements.email.value.trim();
    if (email && !emailValid(email)) { setError(form, "email", "Please check the email address, or leave it blank."); ok = false; first = first || form.elements.email; }
    else setError(form, "email", "");
    if (!form.elements.consent.checked) { setError(form, "consent", "Please tick the box so the sales team can contact you."); ok = false; first = first || form.elements.consent; }
    else setError(form, "consent", "");
    return { ok: ok, first: first, name: name, cc: cc, digits: digits, email: email };
  }

  function buildForm(slot) {
    var formId = slot.getAttribute("data-form-id");
    var frag = tpl.content.cloneNode(true);
    frag.querySelectorAll("[id]").forEach(function (el) { el.id = el.id.replace("tpl", "lf-" + formId); });
    frag.querySelectorAll("label[for]").forEach(function (el) { el.htmlFor = el.htmlFor.replace("tpl", "lf-" + formId); });
    frag.querySelectorAll(".err").forEach(function (el) {
      var field = el.id.replace("lf-" + formId + "-", "").replace("-err", "");
      el.setAttribute("data-err", field);
      var input = frag.querySelector('[name="' + field + '"]');
      if (input) input.setAttribute("aria-describedby", el.id);
    });
    frag.querySelectorAll(".js-consent-entity").forEach(function (s) { s.textContent = CFG.consentEntity || "the developer and its authorised sales partners"; });
    var form = frag.querySelector("form");
    form.setAttribute("data-form-id", formId);
    var label = slot.getAttribute("data-submit-label");
    if (label) form.querySelector('button[type="submit"]').textContent = label;
    slot.appendChild(frag);

    var started = false;
    form.addEventListener("focusin", function () {
      anyFormStarted = true;
      if (started) return; started = true;
      track("form_start", { form_id: formId });
    });
    form.elements.phone.addEventListener("input", function (e) {
      var v = e.target.value.replace(/[^\d\s]/g, "");
      if (form.elements.cc.value === "+91") { var dg = v.replace(/\D/g, ""); if (dg.length > 10) v = dg.slice(-10); }
      if (v !== e.target.value) e.target.value = v;
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); handleSubmit(form, formId); });
    return form;
  }

  function intentFor(formId) {
    if (formId === "modal") return modalIntent;
    if (formId === "hero" || formId === "hero-m") return "site_visit";
    if (formId === "inline") return "brochure";
    return "general";
  }

  function handleSubmit(form, formId) {
    var btn = form.querySelector('button[type="submit"]');
    var status = form.querySelector(".form-status");
    if (btn.disabled) return;
    status.textContent = ""; status.className = "form-status";

    var v = validate(form);
    if (!v.ok) { track("form_error", { form_id: formId }); if (v.first) v.first.focus(); return; }

    if (form.elements.company.value || Date.now() - pageLoadedAt < 2500) {
      track("form_blocked", { form_id: formId });
      showError(form, "We couldn't send that. Please try again in a moment, or call ");
      return;
    }

    var intent = intentFor(formId);
    var config = formId === "modal" ? modalConfig : "";
    track("form_submit", { form_id: formId, intent: intent, configuration: config || "not_specified" });

    if (submitted) { showSuccess(form, v.name, true, intent); return; }

    if (!CFG.leadEndpoint) {
      console.warn("[Florique] SS_CONFIG.leadEndpoint is empty, so the lead was NOT sent. Configure it in assets/js/config.js.");
      track("lead_submit_error", { form_id: formId, reason: "no_endpoint" });
      showError(form, "Online enquiries aren't connected on this page yet. Please call ");
      return;
    }

    var payload = {
      project: "Poulomi Florique",
      name: v.name,
      phone: v.cc + v.digits,
      email: v.email || "",
      country_code: v.cc,
      configuration: config,
      intent: intent,
      consent: true,
      consent_text: form.querySelector(".consent-text").textContent.trim(),
      consent_at: new Date().toISOString(),
      form_id: formId,
      page_url: location.href.split("#")[0],
      submitted_at: new Date().toISOString()
    };
    ATTR_KEYS.concat(["landing_page", "referrer"]).forEach(function (k) { if (attribution[k]) payload[k] = attribution[k]; });

    btn.disabled = true;
    var label = btn.textContent;
    btn.textContent = "Sending…";
    var controller = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 15000);

    // "form" mode (Pabbly and other webhook catchers): a plain form-encoded POST sent with
    // mode "no-cors", so no cross-site preflight is needed. The response is opaque, so a
    // resolved request counts as delivered; only a network failure shows the error.
    var formMode = CFG.leadEndpointFormat === "form";
    var req = formMode
      ? { method: "POST", mode: "no-cors", body: new URLSearchParams(payload), keepalive: true }
      : { method: "POST", headers: { "Content-Type": CFG.leadEndpointSimpleRequest ? "text/plain;charset=utf-8" : "application/json" }, body: JSON.stringify(payload) };
    if (controller) req.signal = controller.signal;
    fetch(CFG.leadEndpoint, req).then(function (res) {
      clearTimeout(timer);
      if (!formMode && !res.ok) throw new Error("HTTP " + res.status);
      submitted = true; ss("ss_lead", "1"); unlockPlans();
      track("lead_submit_success", { form_id: formId, intent: intent, configuration: config || "not_specified" });
      if (CFG.thankYouUrl) location.assign(CFG.thankYouUrl);
      else showSuccess(form, v.name, false, intent);
    }).catch(function (err) {
      clearTimeout(timer);
      console.error("[Florique] lead submit failed", err);
      track("lead_submit_error", { form_id: formId, reason: "network_or_server" });
      btn.disabled = false; btn.textContent = label;
      showError(form, "Something went wrong sending your details. Please try again, or call ");
    });
  }

  function showError(form, lead) {
    var status = form.querySelector(".form-status");
    status.className = "form-status is-error";
    status.textContent = lead;
    var a = document.createElement("a");
    a.href = "tel:" + (CFG.phoneE164 || "+917406917711");
    a.textContent = CFG.phoneDisplay || "74069 17711";
    a.setAttribute("data-cta", "form_error_call");
    status.appendChild(a);
    status.appendChild(document.createTextNode("."));
  }

  function showSuccess(form, name, repeat, intent) {
    var first = name.split(/\s+/)[0];
    var box = document.createElement("div");
    box.className = "form-success"; box.setAttribute("role", "status"); box.setAttribute("tabindex", "-1");
    var tick = document.createElement("div"); tick.className = "tick";
    tick.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path fill="none" stroke="currentColor" stroke-width="2.4" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    var h = document.createElement("h4"); h.textContent = "Thank you, " + first + ".";
    var p = document.createElement("p");
    p.textContent = repeat
      ? "We already have your details from this visit. The Poulomi Florique sales team will be in touch."
      : "We've received your details. The Poulomi Florique sales team will contact you shortly.";
    box.appendChild(tick); box.appendChild(h); box.appendChild(p);
    if (intent === "floor_plan") {
      var b = document.createElement("button"); b.type = "button"; b.className = "btn btn-dark"; b.textContent = "View floor plans";
      b.addEventListener("click", function () { if (modal.open) modal.close(); if (plans.length) lbOpen(plans, plans[0]); });
      box.appendChild(b);
    }
    if (intent === "brochure" && CFG.brochureUrl) {
      var d = document.createElement("a"); d.className = "btn btn-dark"; d.href = CFG.brochureUrl; d.target = "_blank"; d.rel = "noopener"; d.textContent = "Download brochure";
      d.addEventListener("click", function () { track("brochure_download", {}); });
      box.appendChild(d);
    }
    form.replaceWith(box);
    box.focus();
  }

  document.querySelectorAll(".js-form-slot").forEach(buildForm);

  /* ---------- enquiry popup ---------- */
  var modal = document.getElementById("enquiry-modal");
  var modalTitle = modal.querySelector(".js-modal-title");

  function openEnquiry(intent, config, source) {
    modalIntent = INTENTS[intent] ? intent : "general";
    modalConfig = config || "";
    modalTitle.textContent = INTENTS[modalIntent].title;
    var form = modal.querySelector("form");
    if (form) {
      form.querySelector('button[type="submit"]').textContent = INTENTS[modalIntent].button;
    }
    if (typeof modal.showModal !== "function") { document.getElementById("contact").scrollIntoView(); return; }
    if (!modal.open) modal.showModal();
    track("popup_open", { intent: modalIntent, source: source || "click" });
    var firstInput = modal.querySelector("input[name=name]");
    if (firstInput && source !== "auto") setTimeout(function () { firstInput.focus(); }, 30);
  }
  modal.addEventListener("click", function (e) {
    if (e.target === modal || e.target.closest("[data-close]")) modal.close();
  });
  modal.addEventListener("close", function () { ss("ss_popup_seen", "1"); });

  // Auto-open once per session, only if the visitor hasn't already engaged with a form.
  var delay = Number(CFG.popupDelaySeconds);
  if (delay > 0 && !submitted && ss("ss_popup_seen") !== "1") {
    setTimeout(function () {
      if (submitted || anyFormStarted || ss("ss_popup_seen") === "1") return;
      if (document.documentElement.classList.contains("ss-editing")) return;
      if (document.querySelector("dialog[open]")) return;
      openEnquiry("general", null, "auto");
    }, delay * 1000);
  }

  /* ---------- CTA tracking + openers (delegated) ---------- */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-cta], .js-open-enquiry, a[href^='tel:'], a[href^='mailto:'], a[href*='wa.me']");
    if (!el) return;
    if (el.classList.contains("js-plan")) return; // tracked by the plan handler
    var cta = el.getAttribute("data-cta") || "";
    var href = el.getAttribute("href") || "";
    if (href.indexOf("tel:") === 0) track("phone_click", { cta_location: cta || "inline" });
    else if (href.indexOf("mailto:") === 0) track("email_click", { cta_location: cta || "inline" });
    else if (href.indexOf("wa.me") > -1) track("whatsapp_click", { cta_location: cta || "inline" });
    else if (cta) track("cta_click", { cta_location: cta, cta_label: (el.textContent || "").trim().slice(0, 60) });
    if (el.classList.contains("js-open-enquiry")) {
      e.preventDefault();
      openEnquiry(el.getAttribute("data-intent") || "general", el.getAttribute("data-config"), "click");
    }
  });

  /* ---------- lightbox ---------- */
  var lb = document.getElementById("lightbox");
  var lbImg = lb.querySelector("img");
  var lbCap = lb.querySelector("figcaption");
  var lbItems = [], lbIndex = 0;
  function lbShow(i) {
    lbIndex = (i + lbItems.length) % lbItems.length;
    var el = lbItems[lbIndex];
    lbImg.src = el.getAttribute("data-full");
    var cap = el.getAttribute("data-caption") || "";
    lbImg.alt = cap; lbCap.textContent = cap;
  }
  function lbOpen(items, el) {
    lbItems = items; lbShow(items.indexOf(el));
    track("image_view", { image: el.getAttribute("data-caption") || "" });
    if (typeof lb.showModal === "function") lb.showModal(); else window.open(el.getAttribute("data-full"), "_blank");
  }
  document.querySelectorAll(".js-lightbox").forEach(function (el) {
    el.addEventListener("click", function () { lbOpen(Array.prototype.slice.call(document.querySelectorAll(".js-lightbox")), el); });
  });
  lb.querySelector(".lb-prev").addEventListener("click", function () { lbShow(lbIndex - 1); });
  lb.querySelector(".lb-next").addEventListener("click", function () { lbShow(lbIndex + 1); });
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target.closest("[data-close]")) lb.close(); });
  lb.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") lbShow(lbIndex + 1);
    if (e.key === "ArrowLeft") lbShow(lbIndex - 1);
  });

  /* ---------- gated floor plans ---------- */
  var plans = Array.prototype.slice.call(document.querySelectorAll(".js-plan"));
  function onPlan(thumb) {
    track("cta_click", { cta_location: thumb.getAttribute("data-cta") || "plan", cta_label: "View Plan" });
    if (submitted) lbOpen(plans, thumb);
    else openEnquiry("floor_plan", null, "plan");
  }
  plans.forEach(function (thumb) {
    thumb.addEventListener("click", function () { onPlan(thumb); });
    var link = thumb.parentElement.querySelector(".js-plan-link");
    if (link) link.addEventListener("click", function () { onPlan(thumb); });
  });

  /* ---------- hero slider ---------- */
  var slides = Array.prototype.slice.call(document.querySelectorAll(".hero-slides .slide"));
  var dots = Array.prototype.slice.call(document.querySelectorAll(".slide-dots button"));
  var cur = 0, timerId = null;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function hydrate(s) {
    s.querySelectorAll("[data-srcset]").forEach(function (x) { x.srcset = x.getAttribute("data-srcset"); x.removeAttribute("data-srcset"); });
    s.querySelectorAll("[data-src]").forEach(function (x) { x.src = x.getAttribute("data-src"); x.removeAttribute("data-src"); });
  }
  function go(i) {
    cur = (i + slides.length) % slides.length;
    hydrate(slides[cur]); hydrate(slides[(cur + 1) % slides.length]);
    slides.forEach(function (s, j) { s.classList.toggle("is-active", j === cur); });
    dots.forEach(function (d, j) { d.setAttribute("aria-pressed", j === cur ? "true" : "false"); });
  }
  function start() { if (!reduced && slides.length > 1) timerId = setInterval(function () { go(cur + 1); }, 5500); }
  dots.forEach(function (d, j) { d.addEventListener("click", function () { clearInterval(timerId); go(j); start(); }); });
  window.addEventListener("load", function () { if (slides[1]) hydrate(slides[1]); start(); });

  /* ---------- walkthrough videos (click-to-play, no YouTube load until clicked) ---------- */
  /* ---------- walkthrough: videos play inside the page ----------
   * The large frame is the player. Clicking any thumbnail loads that video into it
   * (side videos swap in, the page scrolls the player into view). Never opens a new tab. */
  var mainThumb = document.querySelector(".video-main .video-thumb");
  var vTitle = document.querySelector(".js-video-title");
  var vDesc = document.querySelector(".js-video-desc");
  var vFallback = document.querySelector(".video-fallback");
  var vYt = document.querySelector(".js-video-yt");
  function playVideo(id, title, desc) {
    if (!mainThumb || !id) return;
    var f = document.createElement("iframe");
    f.src = "https://www.youtube.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1&playsinline=1";
    f.title = (title || "Poulomi Florique") + " video";
    f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    f.setAttribute("allowfullscreen", "");
    f.referrerPolicy = "strict-origin-when-cross-origin";
    mainThumb.innerHTML = "";
    mainThumb.appendChild(f);
    mainThumb.classList.add("is-playing");
    mainThumb.removeAttribute("href");
    mainThumb.removeAttribute("aria-label");
    mainThumb.setAttribute("role", "presentation");
    if (vTitle && title) vTitle.textContent = title;
    if (vDesc) vDesc.textContent = desc || "";
    if (vYt) vYt.href = "https://www.youtube.com/watch?v=" + id;
    if (vFallback) vFallback.hidden = false;
    document.querySelectorAll(".video-side .js-video").forEach(function (t) {
      var on = t.getAttribute("data-yt") === id;
      t.classList.toggle("is-active", on);
      if (on) t.setAttribute("aria-current", "true"); else t.removeAttribute("aria-current");
    });
  }
  document.querySelectorAll(".js-video").forEach(function (el) {
    el.addEventListener("click", function (e) {
      if (!el.getAttribute("data-yt")) return;
      e.preventDefault();
      var id = el.getAttribute("data-yt"), title = el.getAttribute("data-title");
      track("video_play", { video: title || id });
      playVideo(id, title, el.getAttribute("data-desc"));
      if (el !== mainThumb) {
        var r = mainThumb.getBoundingClientRect();
        if (r.top < 70 || r.bottom > window.innerHeight) {
          mainThumb.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    });
  });

  /* ---------- mobile menu ---------- */
  var menuBtn = document.querySelector(".menu-btn");
  var nav = document.getElementById("site-nav");
  if (menuBtn && nav) {
    var setMenu = function (open) {
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.documentElement.classList.toggle("menu-open", open);
    };
    menuBtn.addEventListener("click", function () { setMenu(menuBtn.getAttribute("aria-expanded") !== "true"); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true") { setMenu(false); menuBtn.focus(); } });
    document.addEventListener("click", function (e) { if (!e.target.closest(".site-header")) setMenu(false); });
    window.addEventListener("resize", function () { if (window.innerWidth >= 1100) setMenu(false); });
  }

  /* ---------- swipe rows ---------- */
  document.querySelectorAll(".js-prev, .js-next").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var row = document.getElementById(btn.getAttribute("data-target"));
      if (!row) return;
      var item = row.firstElementChild;
      var step = item ? item.getBoundingClientRect().width + 16 : row.clientWidth * 0.8;
      row.scrollBy({ left: btn.classList.contains("js-next") ? step : -step, behavior: "smooth" });
    });
  });



  /* ---------- amenity tabs ---------- */
  var amTabs = Array.prototype.slice.call(document.querySelectorAll(".am-tab"));
  amTabs.forEach(function (t) {
    t.addEventListener("click", function () {
      amTabs.forEach(function (o) { o.classList.toggle("is-active", o === t); o.setAttribute("aria-selected", o === t ? "true" : "false"); });
      document.querySelectorAll(".am-panel").forEach(function (p) { var on = p.id === t.getAttribute("data-target"); p.hidden = !on; p.classList.toggle("is-active", on); });
      track("cta_click", { cta_location: "amenity_tab", cta_label: (t.textContent || "").trim().slice(0, 40) });
    });
  });

  /* ---------- location tabs ---------- */
  var locTabs = Array.prototype.slice.call(document.querySelectorAll(".loc-tab"));
  locTabs.forEach(function (t) {
    t.addEventListener("click", function () {
      locTabs.forEach(function (o) { o.classList.toggle("is-active", o === t); o.setAttribute("aria-selected", o === t ? "true" : "false"); });
      document.querySelectorAll(".loc-panel").forEach(function (p) { var on = p.id === t.getAttribute("data-target"); p.hidden = !on; p.classList.toggle("is-active", on); });
      track("cta_click", { cta_location: "location_tab", cta_label: (t.textContent || "").trim().slice(0, 40) });
    });
  });

  /* ---------- action bar: show after the hero ---------- */
  var bar = document.querySelector(".action-bar");
  var hero = document.querySelector(".hero");
  if (bar && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) { bar.classList.toggle("is-visible", !entries[0].isIntersecting); }, { threshold: 0.05 }).observe(hero);
  } else if (bar) bar.classList.add("is-visible");
})();
