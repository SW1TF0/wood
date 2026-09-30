/* Chopaholic — legal documents (GDPR Privacy Policy, Terms & Conditions, Right of Withdrawal, Cookie Policy). */
(function () {
  'use strict';

  const CH = (window.CH = window.CH || {});
  const LAST_UPDATED = '30/09/2026';

  function merchantBlock(m) {
    const e = CH.esc;
    return `
      <ul class="legal-merchant">
        <li><strong>Merchant / Business owner:</strong> ${e(m.name)}</li>
        <li><strong>Address:</strong> ${e(m.address)}</li>
        <li><strong>Phone:</strong> <a href="tel:${e(m.phone.replace(/\s/g, ''))}">${e(m.phone)}</a></li>
        <li><strong>Email:</strong> <a href="mailto:${e(m.email)}">${e(m.email)}</a></li>
        ${m.companyId ? `<li><strong>Company ID (UIC):</strong> ${e(m.companyId)}</li>` : ''}
        ${m.vatNumber ? `<li><strong>VAT number:</strong> ${e(m.vatNumber)}</li>` : ''}
      </ul>`;
  }

  function privacy(m) {
    return `
      <p class="legal-meta">Last updated: ${LAST_UPDATED}</p>
      <p>This Privacy Policy explains how personal data is processed when you visit the Chopaholic online store, place an order, contact us or exercise your right of withdrawal. It is issued in accordance with Regulation (EU) 2016/679 (General Data Protection Regulation, "GDPR") and the Bulgarian Personal Data Protection Act.</p>

      <h3>1. Data controller</h3>
      <p>The controller of your personal data is:</p>
      ${merchantBlock(m)}
      <p>For any question about your data or to exercise your rights, write to <a href="mailto:${CH.esc(m.email)}">${CH.esc(m.email)}</a>. We do not have a legal obligation to appoint a Data Protection Officer.</p>

      <h3>2. What data we process</h3>
      <ul>
        <li><strong>Order data:</strong> full name, phone number, email address, delivery method and delivery address (or courier office), order notes, ordered products, amounts and order date.</li>
        <li><strong>Contact enquiries:</strong> name, email address, subject and the content of your message.</li>
        <li><strong>Withdrawal requests:</strong> name, contact details, order number, the goods concerned and the date and time of the request.</li>
        <li><strong>Device storage:</strong> your cookie choices, shopping cart and — only with your consent — display preferences and anonymous on-device product-view statistics (see the Cookie Policy).</li>
      </ul>
      <p>We do not collect special categories of data, we do not use automated decision-making or profiling, and we do not sell personal data.</p>

      <h3>3. Purposes and legal bases</h3>
      <table class="legal-table">
        <thead><tr><th>Purpose</th><th>Legal basis (GDPR)</th></tr></thead>
        <tbody>
          <tr><td>Processing and delivering your order, cash-on-delivery collection, customer service about the order</td><td>Art. 6(1)(b) — performance of a contract</td></tr>
          <tr><td>Issuing invoices and keeping accounting records</td><td>Art. 6(1)(c) — legal obligation (Bulgarian Accountancy Act, VAT Act)</td></tr>
          <tr><td>Handling withdrawals, returns, refunds and legal guarantee claims</td><td>Art. 6(1)(b) and (c) — contract and consumer-protection law</td></tr>
          <tr><td>Answering enquiries sent through the contact form or by email</td><td>Art. 6(1)(b) (pre-contractual steps) or Art. 6(1)(f) — legitimate interest in answering you</td></tr>
          <tr><td>Keeping the store secure and preventing fraud</td><td>Art. 6(1)(f) — legitimate interest</td></tr>
          <tr><td>Optional preference and statistics storage on your device</td><td>Art. 6(1)(a) — consent, which you may withdraw at any time</td></tr>
        </tbody>
      </table>

      <h3>4. Recipients</h3>
      <p>Your data is shared only as necessary with: the courier company delivering your parcel (name, phone, delivery address, cash-on-delivery amount); accounting service providers; IT and hosting providers acting as processors under Art. 28 GDPR; and public authorities where required by law. We do not transfer personal data outside the European Economic Area. If this ever becomes necessary, it will only happen with appropriate safeguards under Chapter V GDPR (e.g. an adequacy decision or Standard Contractual Clauses).</p>

      <h3>5. Retention periods</h3>
      <ul>
        <li>Order and invoicing data: for the statutory period required by Bulgarian accounting and tax law (generally up to 10 years for accounting documents).</li>
        <li>Data needed for guarantee claims: for the duration of the 2-year legal guarantee plus the applicable limitation period.</li>
        <li>Contact enquiries: up to 12 months after the enquiry has been resolved.</li>
        <li>Consent-based device storage: until you withdraw consent or clear your browser storage; cookie choices are re-requested after 12 months.</li>
      </ul>

      <h3>6. Your rights</h3>
      <p>Under Articles 15–22 GDPR you have the right to:</p>
      <ul>
        <li>access your personal data and receive a copy;</li>
        <li>rectify inaccurate or incomplete data;</li>
        <li>erasure ("right to be forgotten"), unless we must retain the data by law;</li>
        <li>restriction of processing;</li>
        <li>data portability in a structured, machine-readable format;</li>
        <li>object to processing based on legitimate interest;</li>
        <li>withdraw consent at any time, without affecting the lawfulness of processing before withdrawal (use "Cookie settings" in the footer).</li>
      </ul>
      <p>We respond within one month of receiving your request. This period may be extended by two further months for complex requests, in which case we will inform you.</p>

      <h3>7. Right to lodge a complaint</h3>
      <p>You may lodge a complaint with the Bulgarian supervisory authority — the Commission for Personal Data Protection (CPDP), 2 Prof. Tsvetan Lazarov Blvd., Sofia 1592, <a href="https://www.cpdp.bg" target="_blank" rel="noopener noreferrer">www.cpdp.bg</a> — or with the supervisory authority of your EU country of residence or work.</p>

      <h3>8. Is providing data mandatory?</h3>
      <p>Providing your name, phone number, email and delivery address is necessary to conclude and perform the sales contract. Without it we cannot accept your order. Order notes are optional.</p>

      <h3>9. Security</h3>
      <p>We apply appropriate technical and organisational measures (access control, encrypted connections, minimal data collection, restricted staff access) to protect your data against loss, misuse and unauthorised access.</p>

      <h3>10. Children</h3>
      <p>Our store is intended for adults. We do not knowingly collect data from persons under 16. Orders must be placed by persons who have legal capacity to enter into contracts.</p>

      <h3>11. Changes</h3>
      <p>We may update this Privacy Policy to reflect legal or operational changes. The date of the latest version is shown at the top of this page.</p>`;
  }

  function terms(m, s) {
    const e = CH.esc;
    const f = CH.fmtMoney;
    return `
      <p class="legal-meta">Last updated: ${LAST_UPDATED}</p>
      <h3>1. Merchant information</h3>
      <p>These Terms & Conditions govern the sale of goods through the Chopaholic online store. The seller is:</p>
      ${merchantBlock(m)}

      <h3>2. Scope</h3>
      <p>These Terms apply to all contracts concluded at a distance between the seller and customers through this website. They are drafted primarily for consumers within the meaning of Directive 2011/83/EU and the Bulgarian Consumer Protection Act. Mandatory consumer-protection rules of your country of residence remain unaffected.</p>

      <h3>3. Products</h3>
      <p>All boards are handcrafted from natural wood. Grain pattern, colour tone and knots vary from piece to piece and may differ slightly from the photographs; such natural variation is a characteristic of the product and not a defect. Dimensions may vary by up to ±5 mm. Every board is finished with food-safe mineral oil and/or beeswax.</p>

      <h3>4. Prices and price transparency</h3>
      <ul>
        <li>All prices are in euro (EUR) and <strong>include ${e(s.vatRate)}% VAT</strong> and all other taxes.</li>
        <li>Delivery costs are shown separately before you place your order: ${f(s.shipping.courierOffice)} to a courier office, ${f(s.shipping.address)} to a personal address within Bulgaria. Delivery is <strong>free for orders of ${f(s.shipping.freeThreshold)} or more</strong> (after discounts).</li>
        <li>The price applicable to your order is the price displayed at the moment you place it. Discount codes cannot be combined and apply to product prices only.</li>
        <li>When a price reduction is announced, the prior price shown is the lowest price applied during the 30 days before the reduction (Art. 6a, Directive 98/6/EC).</li>
      </ul>

      <h3>5. Conclusion of the contract</h3>
      <ol>
        <li>Adding products to the cart does not create a binding obligation.</li>
        <li>In the checkout you enter your details, choose a delivery method and review the order summary, where you may correct any input errors.</li>
        <li>By ticking the agreement box and clicking <strong>"Place order with obligation to pay"</strong> you submit a binding offer to purchase.</li>
        <li>You immediately receive an on-screen order confirmation with a unique order number, which you can print or save. The contract is concluded when the seller confirms or dispatches the order.</li>
        <li>The contract language is English. The contract text is stored by the seller and is available on request.</li>
      </ol>

      <h3>6. Payment</h3>
      <p>Payment is made by <strong>Cash on Delivery (COD)</strong> — you pay the full amount in cash (or card, where the courier supports it) to the courier when you receive the parcel. No additional COD fee is charged by the seller.</p>

      <h3>7. Delivery</h3>
      <p>We deliver within Bulgaria by courier, either to a courier office of your choice or to your personal address. Orders are prepared and dispatched within ${e(s.shipping.dispatchDays)}; courier transit normally takes 1–3 working days. If we cannot deliver within 30 days, we will inform you and you may cancel the contract with a full refund of any amount paid. The risk of loss passes to you when you (or a person designated by you, other than the carrier) take physical possession of the goods.</p>

      <h3>8. Retention of title</h3>
      <p>Goods remain the property of the seller until paid in full.</p>

      <h3>9. Right of withdrawal</h3>
      <p>Consumers have a 14-day right of withdrawal without giving any reason. Full details, the model withdrawal form and our online withdrawal function are set out in the <em>Right of Withdrawal & Returns</em> policy, which forms part of these Terms.</p>

      <h3>10. Legal guarantee of conformity and complaints</h3>
      <p>The seller is liable for any lack of conformity which exists at the time of delivery and becomes apparent within <strong>two years</strong> of delivery, in accordance with Directive (EU) 2019/771 and the Bulgarian Act on the Supply of Digital Content and Digital Services and the Sale of Goods. In case of non-conformity you are entitled, free of charge, to have the goods brought into conformity by repair or replacement, or to a proportionate price reduction or termination of the contract. Please report defects to <a href="mailto:${e(m.email)}">${e(m.email)}</a> or ${e(m.phone)}, stating your order number and, where possible, attaching photographs. We confirm receipt of complaints and respond within 14 days, and resolve them within a maximum of 30 days. Normal wear such as knife marks, and damage caused by dishwashing, soaking or failure to follow the care instructions, are not defects.</p>

      <h3>11. Merchant guarantees</h3>
      <p>In addition to the legal guarantee, and without affecting it, we offer a <strong>5-year craftsmanship guarantee</strong> against glue-line separation on all boards used and cared for as described in our care guides. To make a claim, contact us with your order number and photographs; we will repair or replace the board free of charge.</p>

      <h3>12. Liability</h3>
      <p>The seller is liable without limitation for intent and gross negligence, for injury to life, body or health, and under mandatory product liability law. Otherwise, liability is limited to foreseeable damage typical of the contract.</p>

      <h3>13. Dispute resolution</h3>
      <p>We aim to resolve every complaint amicably. Consumers may also contact the Bulgarian Commission for Consumer Protection (KZP), 1 Vrabcha Str., Sofia 1000, <a href="https://kzp.bg" target="_blank" rel="noopener noreferrer">kzp.bg</a>, and its General Conciliation Commission for alternative dispute resolution, or the ADR bodies of their own EU country. Cross-border consumers may seek assistance from the European Consumer Centre in their country.</p>

      <h3>14. Governing law</h3>
      <p>These Terms are governed by Bulgarian law. For consumers, this choice of law does not deprive you of the protection afforded by mandatory provisions of the law of your habitual residence.</p>`;
  }

  function withdrawal(m, s) {
    const e = CH.esc;
    return `
      <p class="legal-meta">Last updated: ${LAST_UPDATED}</p>
      <div class="legal-callout">
        <strong>Want to withdraw from your order?</strong> Use our online withdrawal function — it takes one minute and you receive an immediate acknowledgement.
        <div class="mt-3"><button type="button" class="btn btn-primary btn-sm" data-action="open-withdrawal">Withdraw from contract here</button></div>
      </div>

      <h3>Right of withdrawal</h3>
      <p>You have the right to withdraw from this contract within <strong>14 days</strong> without giving any reason.</p>
      <p>The withdrawal period will expire after 14 days from the day on which you acquire, or a third party other than the carrier and indicated by you acquires, physical possession of the goods. Where you ordered multiple goods delivered separately, the period expires 14 days after you (or your nominee) acquire physical possession of the last good.</p>
      <p>To exercise the right of withdrawal, you must inform us (${e(m.name)}, ${e(m.address)}, phone ${e(m.phone)}, email <a href="mailto:${e(m.email)}">${e(m.email)}</a>) of your decision to withdraw from this contract by an unequivocal statement — for example a letter sent by post, an email, the online withdrawal function on this website ("Withdraw from contract here") or the model withdrawal form below, which is not obligatory. When you use the online withdrawal function, we will communicate to you an acknowledgement of receipt of your withdrawal on a durable medium without delay.</p>
      <p>To meet the withdrawal deadline, it is sufficient for you to send your communication concerning the exercise of the right of withdrawal before the withdrawal period has expired.</p>

      <h3>Effects of withdrawal</h3>
      <p>If you withdraw from this contract, we shall reimburse to you all payments received from you, including the costs of delivery (with the exception of supplementary costs resulting from your choice of a type of delivery other than the least expensive type of standard delivery offered by us), without undue delay and in any event not later than 14 days from the day on which we are informed about your decision to withdraw. We will carry out such reimbursement by bank transfer to an account you indicate (as the original payment was cash on delivery), unless you have expressly agreed otherwise; in any event, you will not incur any fees as a result of such reimbursement.</p>
      <p>We may withhold reimbursement until we have received the goods back or you have supplied evidence of having sent back the goods, whichever is the earliest.</p>
      <p>You shall send back the goods or hand them over to us at ${e(m.address)}, without undue delay and in any event not later than 14 days from the day on which you communicate your withdrawal from this contract to us. The deadline is met if you send back the goods before the period of 14 days has expired.</p>
      <p><strong>You will have to bear the direct cost of returning the goods.</strong></p>
      <p>You are only liable for any diminished value of the goods resulting from handling other than what is necessary to establish the nature, characteristics and functioning of the goods (for example, visible knife marks from use).</p>

      <h3>Exceptions</h3>
      <p>The right of withdrawal does not apply to goods made to the consumer's specifications or clearly personalised (for example boards with custom engraving or custom dimensions), in accordance with Art. 16(c) of Directive 2011/83/EU.</p>

      <h3>Return process — step by step</h3>
      <ol>
        <li>Notify us within 14 days of receipt using the online withdrawal function, email or the model form.</li>
        <li>Pack the goods securely, preferably in the original packaging, and include your order number.</li>
        <li>Send the parcel to ${e(m.address)} within 14 days of notifying us.</li>
        <li>After we receive the goods, we refund the purchase price and the standard delivery cost within 14 days of your withdrawal notice.</li>
      </ol>

      <h3>Model withdrawal form</h3>
      <p class="text-sm">(Complete and return this form only if you wish to withdraw from the contract.)</p>
      <div class="legal-form-box" id="model-withdrawal-form">
        <p>To: ${e(m.name)}, ${e(m.address)}, email: ${e(m.email)}</p>
        <p>I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of the following goods (*)/for the provision of the following service (*):</p>
        <p>Ordered on (*)/received on (*) (dd/mm/yyyy):</p>
        <p>Order number:</p>
        <p>Name of consumer(s):</p>
        <p>Address of consumer(s):</p>
        <p>Signature of consumer(s) (only if this form is notified on paper):</p>
        <p>Date (dd/mm/yyyy):</p>
        <p class="text-sm">(*) Delete as appropriate.</p>
      </div>
      <div class="flex flex-wrap gap-3 mt-3">
        <button type="button" class="btn btn-ghost btn-sm" data-action="copy-model-form">Copy form text</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="print-model-form">Print / save as PDF</button>
      </div>`;
  }

  function cookies() {
    return `
      <p class="legal-meta">Last updated: ${LAST_UPDATED}</p>
      <p>This store does not use third-party advertising or tracking cookies. It uses your browser's local storage (a technology similar to cookies, covered by Art. 5(3) of the ePrivacy Directive) for the purposes below. Non-essential storage is only used after you give consent, and you can change your choice at any time via "Cookie settings" in the footer.</p>
      <table class="legal-table">
        <thead><tr><th>Category</th><th>Storage key</th><th>Purpose</th><th>Duration</th></tr></thead>
        <tbody>
          <tr><td>Strictly necessary</td><td>chopaholic_consent</td><td>Remembers your cookie choices</td><td>12 months</td></tr>
          <tr><td>Strictly necessary</td><td>chopaholic_cart</td><td>Keeps the contents of your shopping cart</td><td>Until checkout or cleared</td></tr>
          <tr><td>Strictly necessary</td><td>chopaholic_products, _posts, _settings, _seed</td><td>Store catalogue and content required to display the shop</td><td>Persistent</td></tr>
          <tr><td>Strictly necessary</td><td>chopaholic_orders, _messages, _withdrawals</td><td>Records of orders, enquiries and withdrawal requests you submit</td><td>See Privacy Policy</td></tr>
          <tr><td>Strictly necessary</td><td>chopaholic_admin (session)</td><td>Staff login session, deleted when the browser tab closes</td><td>Session</td></tr>
          <tr><td>Preferences</td><td>chopaholic_prefs</td><td>Remembers your last chosen shop category and sort order</td><td>Until consent is withdrawn</td></tr>
          <tr><td>Statistics</td><td>chopaholic_analytics</td><td>Anonymous count of product views on this device, used to rank "most popular" boards. Never sent to third parties.</td><td>Until consent is withdrawn</td></tr>
        </tbody>
      </table>
      <p>Declining non-essential storage deletes any preference and statistics data already stored.</p>`;
  }

  CH.Legal = { privacy, terms, withdrawal, cookies, LAST_UPDATED };
})();
