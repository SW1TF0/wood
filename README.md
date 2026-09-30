# Chopaholic — Handcrafted Wooden Boards Store

A complete, responsive e-commerce storefront for **Chopaholic**, a premium brand of handcrafted wooden cutting and serving boards. It is built with plain HTML5, Tailwind CSS (precompiled) and Vanilla JavaScript (ES6+), and all data lives in `localStorage`. There is no build step to run it and no server-side code.

## Run it

Open `index.html` directly in a browser, or serve the folder:

```bash
cd chopaholic
npm start               # serves on http://localhost:8080 (or: python3 -m http.server 8080)
```

**Admin panel:** click the small lock icon in the header and enter the password `admin123`.

## Features

| Area | What's included |
|---|---|
| Storefront | Announcement bar, hero, trust strip, shop with category chips (Cutting Boards / Serving Boards / Gift Sets), search, sort (featured, price, name, most viewed, newest), product cards with hover effects, a Quick View modal with a quantity stepper, a homepage promotion block, Stories/Blog with a full-article modal, Legal Info, and Contact |
| Cart & checkout | Slide-out drawer with a 3-step flow (Cart → Details → Confirmed), quantity changes limited to stock, discount codes, a free-shipping progress bar, live subtotal/discount/shipping/total and the VAT breakdown. The checkout has name, phone, email, delivery method (courier office or personal address), city, postcode, address, notes, Cash on Delivery, and a mandatory T&C + Privacy checkbox. Placing an order saves it, reduces stock and shows a confirmation with a unique order ID (`CH-ddmmyy-XXXXX`) that can be printed or saved as PDF |
| Admin panel | Dashboard (revenue, today's orders, low stock, most viewed). Orders: filter, search, status (New / Processing / Dispatched), details, history, print, delete, CSV export. Products: full CRUD with image URL or upload stored as Base64. Stories: full CRUD. Ads & Promotions: announcement bar, hero text, homepage promotion, discount codes, shipping fees. Inbox: contact messages and withdrawal requests, with refund deadlines. Activity log. Settings: merchant details, VAT rate, JSON backup/restore, reset |
| Real-time | Every change fires store events. Admin views and the storefront re-render immediately, including across browser tabs (via the `storage` event) |
| Dates | Every date in the UI, receipts, logs and CSV/JSON exports uses `dd/mm/yyyy` (with `HH:mm` for timestamps). Blog dates are entered as `dd/mm/yyyy` and validated |

## EU legal & GDPR compliance

- **Cookie consent** (ePrivacy Art. 5(3) / GDPR): a banner on first visit with *Accept all*, *Decline non-essential* and *Settings*. There are separate Preferences and Statistics toggles, and the choice is saved in `localStorage` for 12 months. You can reopen it any time from "Cookie settings" in the footer. Non-essential storage is only written after consent, and declining deletes it.
- **Merchant information** (E-Commerce Directive Art. 5): Bozhidar Zafirov, 3 Yazovirska Str., Bulgaria, +359 87 716 8204, bozhidarzafirov@smartmenukj.com. It appears in the footer, the Contact section, the Legal section, all legal documents and every receipt. You can add an optional UIC and VAT number in Admin → Settings.
- **Legal documents**: Privacy Policy (GDPR Arts. 13–22, CPDP as supervisory authority), Terms & Conditions, Right of Withdrawal & Returns (14-day period, the EU model withdrawal form, exceptions), and Cookie Policy.
- **Online withdrawal function** (Art. 11a of Directive 2011/83/EU, as introduced by Directive (EU) 2023/2673 and applicable from 19/06/2026): a "Withdraw from contract here" button leads to a confirmation step. The customer then gets an immediate acknowledgement with the date and time, which they can print or save. The request is also recorded in the admin Inbox.
- **Checkout**: there is a mandatory checkbox to accept the T&C and Privacy Policy. The final button reads *"Place order with obligation to pay"* (Art. 8(2) CRD).
- **Price transparency**: all prices are shown in EUR including VAT. Shipping costs and the free-shipping threshold appear on product pages, in the cart and at checkout, and the VAT amount is itemised.

> The legal texts are a detailed, good-faith template tailored to a Bulgarian sole trader selling to EU consumers. Have them reviewed by a lawyer before going live, and add your UIC/VAT registration details if you have them.

## Project structure

```
chopaholic/
  index.html                 Page markup
  assets/css/chopaholic.css  Compiled CSS (Tailwind + custom styles). Do not edit by hand
  assets/js/utils.js         Formatting (dd/mm/yyyy, EUR), escaping, toasts, modal stack, printing
  assets/js/store.js         localStorage repository, seed data, generated SVG product artwork
  assets/js/legal.js         Privacy Policy, Terms, Withdrawal policy, Cookie Policy
  assets/js/app.js           Storefront, consent, cart, checkout, withdrawal function, contact form
  assets/js/admin.js         Admin panel
  src/styles.css             Custom design system (wood textures, glassmorphism, components)
  src/tailwind.css           CSS build entry
  tailwind.config.js         Brand colours & fonts
```

After changing markup, JS class names or `src/styles.css`, rebuild the CSS:

```bash
npm install
npm run build:css
```

## Migrating to Firebase

All reads and writes go through `CH.Store` in `store.js`. Collections (`products`, `orders`, `posts`, `messages`, `withdrawals`, `logs`) map one-to-one to Firestore collections, and the settings object maps to a single `settings/site` document. To go live with a real backend:

1. Replace `Store.all/get/upsert/remove/getDoc/setDoc` with Firestore calls and emit the same change events from `onSnapshot`.
2. Replace the admin password check in `admin.js` (`login()`) with Firebase Authentication. **The client-side password is not real security.** Anyone can read it in the page source, and as long as data lives in `localStorage`, orders only exist in the browser where they were placed.
3. Protect writes with Firestore security rules. Customers may only create orders, messages and withdrawals; only admins may read them or change products, posts and settings.
4. Use Admin → Settings → *Download backup* to export the current data as JSON for the initial import.
