# Poulomi Florique — landing page

Lead-generation landing page for **Poulomi Florique**, Thanisandra Main Road, North Bengaluru
(Poulomi Estates · RERA PRM/KA/RERA/1251/446/PR/180326/008539).

Static site, no build step. Open `index.html` or deploy the folder as-is (Vercel, Netlify, any static host).

## Structure
- `index.html` — landing page (hero form, key facts, highlights, gated floor plans, gallery, bloomscapes, amenities, location, developer, enquiry, popup)
- `thank-you.html` — post-submit page with unlocked floor plans
- `assets/css/styles.css` — styles; brand palette from the Florique mini-brochure (hibiscus red, royal blue, sage, cream, forest green)
- `assets/js/config.js` — **all launch settings live here**
- `assets/js/main.js` — forms, popup, lightbox, tabs, tracking (dataLayer)
- `assets/js/editor.js` — in-place text editing in the Claude preview; reads `content.json`
- `assets/img/` — renders, plans, florals and logos extracted from the developer brochure

## Before launch (`assets/js/config.js`)
- `leadEndpoint` — set to the Pabbly Connect webhook; leads are sent as form fields (`leadEndpointFormat: "form"`).
- `phoneDisplay` / `phoneE164` — set to +91 74069 17711.
- `whatsappNumber`, `gtmId`, `agentRera`, `privacyUrl`, `siteUrl`

Pricing shown (₹2.22 Cr*, 1,780 sq ft 3 BHK) is indicative; areas are SBUA from the developer brochure.
