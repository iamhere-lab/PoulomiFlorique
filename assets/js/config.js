/*
 * Poulomi Florique landing page: deployment configuration.
 * Everything that differs between preview and production lives here.
 * Nothing secret belongs in this file: it is shipped to the browser.
 */
window.SS_CONFIG = {
  /* Lead delivery. POST target that accepts JSON and returns 2xx on success
   * (Vercel function, Google Apps Script web app, Pabbly webhook, Leadrat proxy).
   * Leave empty until a real endpoint exists: the form then refuses to submit
   * and offers the phone number instead of showing a fake success message. */
  leadEndpoint: "https://connect.pabbly.com/webhook-listener/webhook/IjU3NjUwNTY1MDYzNTA0MzY1MjZjNTUzNyI_3D_pc/IjU3NjcwNTZiMDYzNzA0MzU1MjY4NTUzZDUxMzUi_pc",

  /* "form" = form-encoded POST, reply checked for {"status":"success"} (Pabbly Connect webhook).
   * "json" = JSON body with a readable response (own API / Vercel function). */
  leadEndpointFormat: "form",

  /* json format only: send as text/plain to avoid a CORS preflight (Google Apps Script). */
  leadEndpointSimpleRequest: false,

  /* Optional: redirect here after a confirmed submission (thank-you page).
   * Leave empty to show the inline success message (which also unlocks the floor plans). */
  thankYouUrl: "thank-you.html",

  /* Google Tag Manager container, e.g. "GTM-XXXXXXX". Loaded only when set. */
  gtmId: "",

  /* Phone shown on the page (sales / channel-partner number). */
  phoneDisplay: "74069 17711",
  phoneE164: "+917406917711",

  /* WhatsApp number, digits only with country code, e.g. "917406917711".
   * All WhatsApp buttons stay hidden until this is set. Confirm the number is on WhatsApp. */
  whatsappNumber: "",
  whatsappMessage: "Hi, I'm interested in Poulomi Florique, Thanisandra. Please share the price sheet and floor plans.",

  /* Auto-open the enquiry popup after this many seconds (once per session).
   * 0 disables auto-open; the popup still opens from every Enquire button. */
  popupDelaySeconds: 10,

  /* Optional public brochure URL. If set, a download link is shown after a successful
   * "Download Brochure" enquiry. Leave empty and the sales team sends it instead. */
  brochureUrl: "",

  /* Channel-partner / agent RERA number, shown in the footer when set. */
  agentRera: "", /* shown in the footer markup directly: Buildnest Realty Pvt Ltd, PRM/KA/RERA/1251/446/AG/210729/002406 */

  /* Named in the consent line: who will contact the enquirer. Confirm before launch. */
  consentEntity: "Buildnest Realty Pvt Ltd (authorised channel partner), Poulomi Florique LLP and Poulomi Estates",

  /* Final site URL for the canonical tag, e.g. "https://www.example.com/". Empty = use the live URL. */
  siteUrl: "",

  /* Full privacy policy URL. The footer link only renders when this is set. */
  privacyUrl: ""
};
