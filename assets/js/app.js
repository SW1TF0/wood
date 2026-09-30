/* Chopaholic — storefront: rendering, consent, cart, checkout, contact, withdrawal function. */
(function () {
  'use strict';

  const CH = window.CH;
  const { $, $$, esc, fmtMoney, fmtDate, fmtDateTime, round2, Store, toast, openModal, closeModal } = CH;

  Store.seed();

  const CONSENT_VERSION = 1;
  const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

  const state = {
    category: 'all',
    search: '',
    sort: 'featured',
    drawerView: 'cart',
    deliveryMethod: 'office',
    checkoutDraft: {},
    lastOrderId: null,
  };

  /* ====================================================================
   * Consent (GDPR / ePrivacy)
   * ==================================================================== */
  const Consent = {
    get() {
      const c = Store.getDoc('consent', null);
      if (!c || c.version !== CONSENT_VERSION) return null;
      if (Date.now() - new Date(c.date).getTime() > CONSENT_MAX_AGE_MS) return null;
      return c;
    },
    has(category) {
      const c = this.get();
      return !!(c && c[category]);
    },
    save(preferences, analytics) {
      Store.setDoc('consent', { version: CONSENT_VERSION, necessary: true, preferences: !!preferences, analytics: !!analytics, date: new Date().toISOString() });
      if (!preferences) Store.removeDoc('prefs');
      if (!analytics) Store.removeDoc('analytics');
      if (preferences) savePrefs();
      hideCookieBanner();
      renderProducts();
    },
  };

  function showCookieBanner() {
    const banner = $('#cookie-banner');
    banner.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('show')));
  }

  function hideCookieBanner() {
    const banner = $('#cookie-banner');
    banner.classList.remove('show');
    setTimeout(() => { banner.hidden = true; }, 600);
  }

  function openCookieSettings() {
    const c = Consent.get() || { preferences: false, analytics: false };
    const body = openModal(`
      <p class="text-sm text-walnut/75 leading-relaxed">Choose which types of storage you allow. Strictly necessary storage cannot be switched off because the shop (cart, checkout, your choices) cannot work without it. You can change your choice at any time from "Cookie settings" in the footer.</p>
      <div class="mt-5 space-y-3">
        <div class="glass-card p-4 flex gap-4 items-start justify-between">
          <div><h3 class="font-semibold">Strictly necessary</h3><p class="text-sm text-walnut/70 mt-1">Cart contents, cookie choices, orders and messages you submit, staff login session.</p></div>
          <label class="switch" title="Always active"><input type="checkbox" checked disabled aria-label="Strictly necessary (always active)"><span></span></label>
        </div>
        <div class="glass-card p-4 flex gap-4 items-start justify-between">
          <div><h3 class="font-semibold">Preferences</h3><p class="text-sm text-walnut/70 mt-1">Remembers your last selected shop category and sort order.</p></div>
          <label class="switch"><input type="checkbox" id="cs-preferences" ${c.preferences ? 'checked' : ''} aria-label="Allow preference storage"><span></span></label>
        </div>
        <div class="glass-card p-4 flex gap-4 items-start justify-between">
          <div><h3 class="font-semibold">Statistics</h3><p class="text-sm text-walnut/70 mt-1">Anonymous on-device count of product views used for the "Most viewed" ranking. Never shared with third parties.</p></div>
          <label class="switch"><input type="checkbox" id="cs-analytics" ${c.analytics ? 'checked' : ''} aria-label="Allow statistics storage"><span></span></label>
        </div>
      </div>
      <div class="mt-6 flex flex-wrap gap-2 justify-end">
        <button type="button" class="btn btn-ghost" data-cs="decline">Decline non-essential</button>
        <button type="button" class="btn btn-ghost" data-cs="save">Save my choices</button>
        <button type="button" class="btn btn-primary" data-cs="accept">Accept all</button>
      </div>
      <p class="text-xs text-walnut/50 mt-4">${Consent.get() ? `Current choice saved on ${fmtDate(Consent.get().date)}.` : 'No choice saved yet.'} <button type="button" class="underline" data-legal="cookies">Cookie Policy</button> · <button type="button" class="underline" data-legal="privacy">Privacy Policy</button></p>
    `, { title: 'Cookie preferences', size: 'md' });
    body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cs]');
      if (!btn) return;
      const action = btn.dataset.cs;
      if (action === 'accept') Consent.save(true, true);
      else if (action === 'decline') Consent.save(false, false);
      else Consent.save($('#cs-preferences', body).checked, $('#cs-analytics', body).checked);
      toast('Your privacy choices have been saved.');
      closeModal(body);
    });
  }

  /* ---------- Preferences & statistics (consent-gated) ---------- */
  function savePrefs() {
    if (!Consent.has('preferences')) return;
    Store.setDoc('prefs', { category: state.category, sort: state.sort });
  }

  function loadPrefs() {
    if (!Consent.has('preferences')) return;
    const p = Store.getDoc('prefs', null);
    if (!p) return;
    if (p.category && (p.category === 'all' || CH.CATEGORIES.some((c) => c.id === p.category))) state.category = p.category;
    if (p.sort) state.sort = p.sort;
  }

  function trackView(productId) {
    if (!Consent.has('analytics')) return;
    const stats = Store.getDoc('analytics', {});
    stats[productId] = (stats[productId] || 0) + 1;
    Store.setDoc('analytics', stats);
  }

  /* ====================================================================
   * Site content (announcement, hero, promo, merchant info)
   * ==================================================================== */
  function renderSiteContent() {
    const s = Store.settings();

    // Announcement bar
    const bar = $('#announce');
    const dismissedText = sessionStorage.getItem('chopaholic_announce_dismissed');
    if (s.announcement.enabled && s.announcement.text && dismissedText !== s.announcement.text) {
      $('#announce-text').textContent = s.announcement.text;
      const link = $('#announce-link');
      link.textContent = s.announcement.linkText || '';
      link.hidden = !s.announcement.linkText;
      link.setAttribute('href', /^#[a-z-]+$/.test(s.announcement.linkTarget || '') ? s.announcement.linkTarget : '#shop');
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }

    // Hero
    $('#hero-eyebrow').innerHTML = `<span class="w-8 h-px bg-accent"></span>${esc(s.hero.eyebrow)}`;
    const words = String(s.hero.title || '').trim().split(/\s+/);
    const lastTwo = words.length > 2 ? words.splice(-2).join(' ') : '';
    $('#hero-title').innerHTML = `${esc(words.join(' '))}${lastTwo ? ` <span class="shimmer-text italic">${esc(lastTwo)}</span>` : ''}`;
    $('#hero-subtitle').textContent = s.hero.subtitle;
    $('#hero-cta-text').textContent = s.hero.ctaText || 'Explore Boards';
    const products = Store.all('products');
    const heroProduct = products.find((p) => p.id === 'p_butchers_block') || products.find((p) => p.featured) || products[0];
    if (heroProduct) {
      $('#hero-image').src = CH.productImage(heroProduct, { transparent: true });
      $('#hero-image').alt = heroProduct.name;
    }

    // Promotion block
    const promo = $('#promo');
    const promoProduct = products.find((p) => p.id === s.promo.productId);
    if (s.promo.enabled && s.promo.title) {
      $('#promo-badge').textContent = s.promo.badge || 'Featured';
      $('#promo-badge').hidden = !s.promo.badge;
      $('#promo-title').textContent = s.promo.title;
      $('#promo-text').textContent = s.promo.text;
      const cta = $('#promo-cta');
      cta.textContent = s.promo.ctaText || 'Shop now';
      cta.dataset.productId = promoProduct ? promoProduct.id : '';
      const img = $('#promo-image');
      if (promoProduct) {
        img.src = CH.productImage(promoProduct);
        img.alt = promoProduct.name;
        img.parentElement.hidden = false;
      } else {
        img.parentElement.hidden = true;
      }
      promo.classList.remove('hidden');
    } else {
      promo.classList.add('hidden');
    }

    // VAT & shipping texts
    $$('.vat-rate').forEach((el) => { el.textContent = s.vatRate; });
    $('#trust-shipping').textContent = `On orders over ${fmtMoney(s.shipping.freeThreshold)} — otherwise from ${fmtMoney(Math.min(s.shipping.courierOffice, s.shipping.address))}.`;

    // Merchant details (E-Commerce Directive Art. 5)
    const m = s.merchant;
    const tel = m.phone.replace(/\s/g, '');
    const rows = [
      ['Business owner / Merchant', esc(m.name)],
      ['Address', esc(m.address)],
      ['Phone', `<a class="underline hover:text-amberwood" href="tel:${esc(tel)}">${esc(m.phone)}</a>`],
      ['Email', `<a class="underline hover:text-amberwood break-all" href="mailto:${esc(m.email)}">${esc(m.email)}</a>`],
    ];
    if (m.companyId) rows.push(['Company ID (UIC)', esc(m.companyId)]);
    if (m.vatNumber) rows.push(['VAT number', esc(m.vatNumber)]);
    rows.push(['Supervisory authority (consumers)', 'Commission for Consumer Protection, Sofia']);
    rows.push(['Data protection authority', 'Commission for Personal Data Protection, Sofia']);
    $$('.merchant-details').forEach((dl) => {
      dl.innerHTML = rows.map(([k, v]) => `<div><dt class="text-walnut/55 text-xs uppercase tracking-wider">${esc(k)}</dt><dd class="font-medium mt-0.5">${v}</dd></div>`).join('');
    });

    $('#footer-merchant').innerHTML = `
      <p><span class="text-cream/50">Business owner:</span><br><span class="text-cream">${esc(m.name)}</span></p>
      <p>${esc(m.address)}</p>
      <p><a href="tel:${esc(tel)}" class="hover:text-accent transition">${esc(m.phone)}</a></p>
      <p><a href="mailto:${esc(m.email)}" class="hover:text-accent transition break-all">${esc(m.email)}</a></p>
      ${m.companyId ? `<p>UIC: ${esc(m.companyId)}</p>` : ''}
      ${m.vatNumber ? `<p>VAT: ${esc(m.vatNumber)}</p>` : ''}`;
    $('#footer-owner').textContent = m.name;

    $('#contact-details').innerHTML = [
      ['👤', 'Merchant', esc(m.name)],
      ['📍', 'Address', esc(m.address)],
      ['📞', 'Phone', `<a href="tel:${esc(tel)}" class="hover:text-accent transition">${esc(m.phone)}</a>`],
      ['✉️', 'Email', `<a href="mailto:${esc(m.email)}" class="hover:text-accent transition break-all">${esc(m.email)}</a>`],
      ['🕘', 'Hours', 'Mon–Fri, 09:00–18:00 (EET)'],
    ].map(([icon, label, value]) => `
      <li class="flex gap-4 items-start">
        <span class="w-11 h-11 rounded-2xl bg-accent/15 ring-1 ring-accent/30 flex items-center justify-center text-lg flex-shrink-0" aria-hidden="true">${icon}</span>
        <div><p class="text-xs uppercase tracking-widest text-cream/50">${label}</p><p class="font-medium text-cream mt-0.5">${value}</p></div>
      </li>`).join('');
  }

  /* ====================================================================
   * Shop
   * ==================================================================== */
  const categoryLabel = (id) => (CH.CATEGORIES.find((c) => c.id === id) || { label: id }).label;

  function renderFilters() {
    const products = Store.all('products');
    const chips = [{ id: 'all', label: 'All boards' }, ...CH.CATEGORIES];
    $('#category-filters').innerHTML = chips.map((c) => {
      const count = c.id === 'all' ? products.length : products.filter((p) => p.category === c.id).length;
      const active = state.category === c.id;
      return `<button type="button" role="tab" aria-selected="${active}" class="chip ${active ? 'active' : ''}" data-category="${esc(c.id)}">${esc(c.label)} <span class="opacity-60 ml-1">${count}</span></button>`;
    }).join('');
    $('#shop-sort').value = state.sort;
  }

  function stockBadge(p) {
    const stock = Number(p.stock);
    if (stock <= 0) return '<span class="badge badge-out">Sold out</span>';
    if (stock <= 5) return `<span class="badge badge-warn">Only ${stock} left</span>`;
    return '';
  }

  function filteredProducts() {
    const q = state.search.trim().toLowerCase();
    let list = Store.all('products').filter((p) => (state.category === 'all' || p.category === state.category));
    if (q) {
      list = list.filter((p) => [p.name, p.wood, p.description, categoryLabel(p.category), p.dimensions].join(' ').toLowerCase().includes(q));
    }
    const views = Store.getDoc('analytics', {});
    const sorters = {
      featured: (a, b) => (Number(!!b.featured) - Number(!!a.featured)) || ((b.stock > 0) - (a.stock > 0)),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      name: (a, b) => a.name.localeCompare(b.name),
      popular: (a, b) => (views[b.id] || 0) - (views[a.id] || 0) || (Number(!!b.featured) - Number(!!a.featured)),
      newest: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    };
    return list.slice().sort(sorters[state.sort] || sorters.featured);
  }

  function renderProducts() {
    renderFilters();
    const list = filteredProducts();
    const grid = $('#product-grid');
    const s = Store.settings();
    $('#shop-count').textContent = `${list.length} ${list.length === 1 ? 'board' : 'boards'}`;
    $('#product-empty').classList.toggle('hidden', list.length > 0);
    grid.innerHTML = list.map((p) => {
      const soldOut = Number(p.stock) <= 0;
      return `
      <article class="product-card reveal" data-product-id="${esc(p.id)}">
        <div class="img-wrap">
          <img src="${esc(CH.productImage(p))}" alt="${esc(p.name)} — ${esc(p.wood)}" loading="lazy" width="800" height="600">
          <div class="absolute top-3 left-3 flex flex-wrap gap-2">
            ${p.featured ? '<span class="badge badge-dark">★ Bestseller</span>' : ''}
            ${stockBadge(p)}
          </div>
          <button type="button" class="quick-btn btn btn-sm glass-panel !text-walnut" data-action="quick-view" data-id="${esc(p.id)}" aria-label="Quick view: ${esc(p.name)}">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
            Quick view
          </button>
        </div>
        <div class="p-5 flex flex-col flex-1">
          <div class="flex items-center gap-2 text-xs">
            <span class="badge badge-wood">${esc(p.wood)}</span>
            <span class="text-walnut/50">${esc(categoryLabel(p.category))}</span>
          </div>
          <h3 class="font-display text-xl font-semibold mt-3 leading-snug">
            <button type="button" class="text-left hover:text-amberwood transition" data-action="quick-view" data-id="${esc(p.id)}">${esc(p.name)}</button>
          </h3>
          <p class="text-sm text-walnut/60 mt-1 flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 7h18M3 7v10M21 7v10M7 7v3M11 7v3M15 7v3M19 7v3"/></svg>
            ${esc(p.dimensions)}
          </p>
          <p class="text-sm text-walnut/70 mt-3 line-clamp-2">${esc(p.description)}</p>
          <div class="mt-auto pt-5 flex items-end justify-between gap-3">
            <div>
              <p class="font-display text-2xl font-bold text-walnut">${fmtMoney(p.price)}</p>
              <p class="text-[11px] text-walnut/55">incl. ${esc(s.vatRate)}% VAT, excl. shipping</p>
            </div>
            <button type="button" class="btn btn-primary btn-sm" data-action="add-to-cart" data-id="${esc(p.id)}" ${soldOut ? 'disabled' : ''}>
              ${soldOut ? 'Sold out' : '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Add to cart'}
            </button>
          </div>
        </div>
      </article>`;
    }).join('');
    observeReveals();
  }

  function openQuickView(id) {
    const p = Store.get('products', id);
    if (!p) return;
    trackView(id);
    const s = Store.settings();
    const inCart = cartQty(id);
    const available = Math.max(0, Number(p.stock) - inCart);
    const body = openModal(`
      <div class="grid md:grid-cols-2 gap-6">
        <div class="rounded-2xl overflow-hidden bg-cream ring-1 ring-accent/40 self-start">
          <img src="${esc(CH.productImage(p))}" alt="${esc(p.name)}" class="block w-full h-auto object-cover aspect-[4/3]">
        </div>
        <div class="flex flex-col">
          <div class="flex flex-wrap gap-2">
            <span class="badge badge-wood">${esc(p.wood)}</span>
            <span class="badge badge-wood">${esc(categoryLabel(p.category))}</span>
            ${stockBadge(p)}
          </div>
          <h3 class="font-display text-3xl font-bold mt-3">${esc(p.name)}</h3>
          <dl class="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div class="glass-card p-3"><dt class="text-walnut/55 text-xs uppercase tracking-wider">Wood type</dt><dd class="font-semibold mt-1">${esc(p.wood)}</dd></div>
            <div class="glass-card p-3"><dt class="text-walnut/55 text-xs uppercase tracking-wider">Dimensions</dt><dd class="font-semibold mt-1">${esc(p.dimensions)}</dd></div>
          </dl>
          <p class="text-walnut/75 mt-4 leading-relaxed text-sm">${esc(p.description)}</p>
          <div class="mt-5">
            <p class="font-display text-3xl font-bold">${fmtMoney(p.price)}</p>
            <p class="text-xs text-walnut/60">Price incl. ${esc(s.vatRate)}% VAT (${fmtMoney(p.price - p.price / (1 + s.vatRate / 100))}). Shipping ${fmtMoney(s.shipping.courierOffice)}–${fmtMoney(s.shipping.address)}, free over ${fmtMoney(s.shipping.freeThreshold)}.</p>
          </div>
          <div class="mt-6 flex flex-wrap items-center gap-3">
            <div class="qty" data-qv-qty>
              <button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
              <input type="number" min="1" max="${available}" value="1" aria-label="Quantity" ${available <= 0 ? 'disabled' : ''}>
              <button type="button" data-step="1" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="btn btn-primary flex-1" data-qv-add ${available <= 0 ? 'disabled' : ''}>
              ${Number(p.stock) <= 0 ? 'Sold out' : available <= 0 ? 'All available stock is in your cart' : 'Add to cart'}
            </button>
          </div>
          <ul class="mt-6 text-xs text-walnut/65 space-y-1.5">
            <li>✓ Food-safe oil & beeswax finish</li>
            <li>✓ Dispatched within ${esc(s.shipping.dispatchDays)} · Cash on delivery</li>
            <li>✓ 14-day right of withdrawal · 2-year legal guarantee</li>
          </ul>
        </div>
      </div>`, { title: 'Quick view', size: 'lg' });

    const input = $('[data-qv-qty] input', body);
    const clamp = () => {
      let v = parseInt(input.value, 10);
      if (Number.isNaN(v) || v < 1) v = 1;
      if (v > available) v = Math.max(1, available);
      input.value = v;
      return v;
    };
    input.addEventListener('change', clamp);
    body.addEventListener('click', (e) => {
      const step = e.target.closest('[data-step]');
      if (step) {
        input.value = (parseInt(input.value, 10) || 1) + Number(step.dataset.step);
        clamp();
        return;
      }
      if (e.target.closest('[data-qv-add]')) {
        if (addToCart(id, clamp())) {
          closeModal(body);
          openDrawer();
        }
      }
    });
  }

  /* ====================================================================
   * Stories
   * ==================================================================== */
  function renderStories() {
    const posts = Store.all('posts').slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    $('#story-empty').classList.toggle('hidden', posts.length > 0);
    $('#story-grid').innerHTML = posts.map((p) => `
      <article class="story-card reveal">
        <button type="button" class="text-left flex flex-col h-full" data-action="open-story" data-id="${esc(p.id)}">
          <div class="overflow-hidden"><img src="${esc(p.image || CH.storyImage(p))}" alt="" loading="lazy"></div>
          <div class="p-6 flex flex-col flex-1">
            <div class="flex items-center gap-3 text-xs">
              <span class="badge badge-wood">${esc(p.category || 'Story')}</span>
              <time class="text-walnut/55" datetime="${esc(p.date)}">${fmtDate(p.date)}</time>
            </div>
            <h3 class="font-display text-xl font-semibold mt-3 leading-snug">${esc(p.title)}</h3>
            <p class="text-sm text-walnut/70 mt-2 line-clamp-3">${esc(p.excerpt)}</p>
            <span class="mt-auto pt-4 text-amberwood font-semibold text-sm">Read story →</span>
          </div>
        </button>
      </article>`).join('');
    observeReveals();
  }

  function openStory(id) {
    const p = Store.get('posts', id);
    if (!p) return;
    openModal(`
      <img src="${esc(p.image || CH.storyImage(p))}" alt="" class="w-full rounded-2xl aspect-[16/7] object-cover">
      <div class="flex flex-wrap items-center gap-3 text-xs mt-5">
        <span class="badge badge-wood">${esc(p.category || 'Story')}</span>
        <time class="text-walnut/60" datetime="${esc(p.date)}">${fmtDate(p.date)}</time>
        <span class="text-walnut/60">by ${esc(p.author || 'Chopaholic')}</span>
      </div>
      <h3 class="font-display text-3xl font-bold mt-3">${esc(p.title)}</h3>
      <p class="text-lg text-walnut/70 mt-3 italic">${esc(p.excerpt)}</p>
      <div class="prose-wood mt-4">${CH.richText(p.content)}</div>
      <div class="mt-8 p-5 rounded-2xl wood-dark text-cream flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <p class="font-display text-lg">Ready for a board that lasts a lifetime?</p>
        <a href="#shop" class="btn btn-accent btn-sm" data-close-modal>Shop the collection</a>
      </div>`, { title: 'Stories & care guides', size: 'lg' });
  }

  /* ====================================================================
   * Legal documents
   * ==================================================================== */
  const LEGAL_TABS = [
    { id: 'privacy', label: 'Privacy Policy' },
    { id: 'terms', label: 'Terms & Conditions' },
    { id: 'withdrawal', label: 'Withdrawal & Returns' },
    { id: 'cookies', label: 'Cookie Policy' },
  ];

  function legalHtml(id) {
    const s = Store.settings();
    if (id === 'terms') return CH.Legal.terms(s.merchant, s);
    if (id === 'withdrawal') return CH.Legal.withdrawal(s.merchant, s);
    if (id === 'cookies') return CH.Legal.cookies();
    return CH.Legal.privacy(s.merchant);
  }

  function openLegal(tab = 'privacy') {
    const body = openModal(`
      <div class="flex gap-1 overflow-x-auto scroll-thin pb-3 -mx-1 px-1 sticky top-0" role="tablist" aria-label="Legal documents">
        ${LEGAL_TABS.map((t) => `<button type="button" role="tab" class="tab-btn" data-legal-tab="${t.id}">${t.label}</button>`).join('')}
      </div>
      <div class="prose-wood mt-2" data-legal-content role="tabpanel"></div>`, { title: 'Legal information', size: 'lg' });

    const show = (id) => {
      $$('[data-legal-tab]', body).forEach((b) => {
        const active = b.dataset.legalTab === id;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', String(active));
      });
      $('[data-legal-content]', body).innerHTML = legalHtml(id);
      body.scrollTop = 0;
    };
    body.addEventListener('click', (e) => {
      const t = e.target.closest('[data-legal-tab]');
      if (t) show(t.dataset.legalTab);
    });
    show(tab);
  }

  function modelFormText() {
    const box = $('#model-withdrawal-form');
    return box ? Array.from(box.querySelectorAll('p')).map((p) => p.textContent.trim()).join('\n\n') : '';
  }

  /* ====================================================================
   * Cart
   * ==================================================================== */
  function getCart() {
    const cart = Store.getDoc('cart', { items: [], code: '' });
    return { items: Array.isArray(cart.items) ? cart.items : [], code: cart.code || '' };
  }

  function saveCart(cart) {
    // Re-rendering of the badge and drawer happens in the Store 'cart' listener.
    Store.setDoc('cart', cart);
  }

  function cartQty(id) {
    const line = getCart().items.find((i) => i.id === id);
    return line ? line.qty : 0;
  }

  /** Drops lines for products that no longer exist and clamps quantities to stock. */
  function sanitizeCart() {
    const cart = getCart();
    const products = Store.all('products');
    let changed = false;
    const items = cart.items.filter((line) => {
      const p = products.find((x) => x.id === line.id);
      if (!p || Number(p.stock) <= 0) { changed = true; return false; }
      if (line.qty > Number(p.stock)) { line.qty = Number(p.stock); changed = true; }
      if (line.qty < 1) { changed = true; return false; }
      return true;
    });
    if (changed) {
      Store.setDoc('cart', { ...cart, items });
    }
    return changed;
  }

  function addToCart(id, qty = 1) {
    const p = Store.get('products', id);
    if (!p) return false;
    const cart = getCart();
    const line = cart.items.find((i) => i.id === id);
    const current = line ? line.qty : 0;
    const stock = Number(p.stock);
    if (current + qty > stock) {
      toast(stock - current > 0 ? `Only ${stock - current} more available.` : `No more "${p.name}" in stock.`, 'error');
      return false;
    }
    if (line) line.qty += qty;
    else cart.items.push({ id, qty });
    saveCart(cart);
    const badge = $('#cart-count');
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
    toast(`${qty} × ${p.name} added to your cart`);
    return true;
  }

  function setQty(id, qty) {
    const cart = getCart();
    const line = cart.items.find((i) => i.id === id);
    const p = Store.get('products', id);
    if (!line || !p) return;
    if (qty < 1) { removeFromCart(id); return; }
    if (qty > Number(p.stock)) {
      toast(`Only ${p.stock} available.`, 'error');
      qty = Number(p.stock);
    }
    line.qty = qty;
    saveCart(cart);
  }

  function removeFromCart(id) {
    const cart = getCart();
    const p = Store.get('products', id);
    cart.items = cart.items.filter((i) => i.id !== id);
    saveCart(cart);
    if (p) toast(`${p.name} removed from cart`, 'info');
  }

  function findCode(code) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return null;
    return Store.settings().codes.find((x) => x.active && String(x.code).toUpperCase() === c) || null;
  }

  function computeTotals(method = state.deliveryMethod) {
    const s = Store.settings();
    const cart = getCart();
    const products = Store.all('products');
    const lines = cart.items
      .map((i) => {
        const p = products.find((x) => x.id === i.id);
        return p ? { product: p, qty: i.qty, lineTotal: round2(p.price * i.qty) } : null;
      })
      .filter(Boolean);
    const itemCount = lines.reduce((n, l) => n + l.qty, 0);
    const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
    const code = findCode(cart.code);
    const discount = code ? round2(subtotal * (Number(code.percent) / 100)) : 0;
    const afterDiscount = round2(subtotal - discount);
    const fee = method === 'address' ? Number(s.shipping.address) : Number(s.shipping.courierOffice);
    const freeShipping = afterDiscount >= Number(s.shipping.freeThreshold);
    const shipping = lines.length === 0 || freeShipping ? 0 : round2(fee);
    const total = round2(afterDiscount + shipping);
    const vat = round2(total - total / (1 + Number(s.vatRate) / 100));
    const toFree = Math.max(0, round2(Number(s.shipping.freeThreshold) - afterDiscount));
    return { lines, itemCount, subtotal, code, discount, afterDiscount, shipping, freeShipping, total, vat, vatRate: Number(s.vatRate), toFree, method, settings: s };
  }

  function renderCartBadge() {
    const count = getCart().items.reduce((n, i) => n + i.qty, 0);
    const badge = $('#cart-count');
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = count ? 'flex' : 'none';
    $('#cart-button').setAttribute('aria-label', `Open shopping cart (${count} ${count === 1 ? 'item' : 'items'})`);
  }

  /* ---------- Drawer ---------- */
  function openDrawer(view = 'cart') {
    state.drawerView = view;
    sanitizeCart();
    renderDrawer();
    const drawer = $('#cart-drawer');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    $('#drawer-overlay').classList.add('open');
    document.body.classList.add('no-scroll', 'drawer-open');
    setTimeout(() => $('#drawer-close').focus({ preventScroll: true }), 50);
  }

  function closeDrawer() {
    const drawer = $('#cart-drawer');
    if (state.drawerView === 'checkout') captureDraft();
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    $('#drawer-overlay').classList.remove('open');
    document.body.classList.remove('drawer-open');
    if (!document.querySelector('.modal-wrap') && !document.body.classList.contains('admin-open')) document.body.classList.remove('no-scroll');
    if (state.drawerView === 'done') state.drawerView = 'cart';
    $('#cart-button').focus({ preventScroll: true });
  }

  function setStepDots(view) {
    const order = ['cart', 'checkout', 'done'];
    const idx = order.indexOf(view);
    $$('[data-step-dot]').forEach((el) => {
      const i = order.indexOf(el.dataset.stepDot);
      el.className = `px-2 py-1 rounded-full ${i <= idx ? 'bg-walnut text-cream' : ''}`;
    });
  }

  function totalsHtml(t, { estimate }) {
    const s = t.settings;
    return `
      <dl class="space-y-2 text-sm">
        <div class="flex justify-between"><dt>Subtotal (${t.itemCount} ${t.itemCount === 1 ? 'item' : 'items'})</dt><dd class="font-semibold">${fmtMoney(t.subtotal)}</dd></div>
        ${t.discount ? `<div class="flex justify-between text-green-800"><dt>Discount (${esc(t.code.code)} −${esc(t.code.percent)}%)</dt><dd class="font-semibold">−${fmtMoney(t.discount)}</dd></div>` : ''}
        <div class="flex justify-between"><dt>Shipping ${estimate ? `<span class="text-walnut/55">(courier office, est.)</span>` : `<span class="text-walnut/55">(${t.method === 'address' ? 'to your address' : 'to courier office'})</span>`}</dt>
          <dd class="font-semibold">${t.shipping === 0 ? '<span class="text-green-800">Free</span>' : fmtMoney(t.shipping)}</dd></div>
        <div class="flex justify-between items-end pt-2 border-t border-accent/40"><dt class="font-display text-lg font-semibold">Total</dt><dd class="font-display text-2xl font-bold">${fmtMoney(t.total)}</dd></div>
        <p class="text-xs text-walnut/60 text-right">incl. ${t.vatRate}% VAT: ${fmtMoney(t.vat)}</p>
      </dl>
      ${estimate && !t.freeShipping ? `<p class="text-xs text-walnut/60 mt-2">Delivery to a personal address: ${fmtMoney(s.shipping.address)}. Free delivery on orders from ${fmtMoney(s.shipping.freeThreshold)}.</p>` : ''}`;
  }

  function renderDrawer() {
    const view = state.drawerView;
    setStepDots(view);
    $('#drawer-back').classList.toggle('hidden', view !== 'checkout');
    $('#drawer-title').textContent = view === 'cart' ? 'Your cart' : view === 'checkout' ? 'Checkout' : 'Order confirmed';
    if (view === 'checkout') renderCheckout();
    else if (view === 'done') renderDone();
    else renderCartView();
  }

  function renderCartView() {
    const t = computeTotals('office');
    const body = $('#drawer-body');
    const footer = $('#drawer-footer');
    if (!t.lines.length) {
      body.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-center py-16">
          <div class="w-24 h-24 rounded-full wood-light flex items-center justify-center text-4xl shadow-inner" aria-hidden="true">🪵</div>
          <p class="font-display text-2xl mt-5">Your cart is empty</p>
          <p class="text-sm text-walnut/60 mt-2 max-w-xs">Every great meal starts on a great board. Find yours in our collection.</p>
          <button type="button" class="btn btn-primary mt-6" data-action="shop-now">Explore boards</button>
        </div>`;
      footer.innerHTML = '<p class="text-xs text-center text-walnut/60">Cash on delivery · 14-day returns · Prices incl. VAT</p>';
      return;
    }
    const s = t.settings;
    const pct = Math.min(100, Math.round((t.afterDiscount / Number(s.shipping.freeThreshold)) * 100));
    body.innerHTML = `
      <div class="glass-card p-3 mb-4">
        <p class="text-xs font-medium">${t.freeShipping ? '🎉 You qualify for <strong>free delivery</strong>!' : `Add <strong>${fmtMoney(t.toFree)}</strong> more for free delivery.`}</p>
        <div class="h-2 rounded-full bg-accent/25 mt-2 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-amberwood to-accent transition-all duration-500" style="width:${pct}%"></div></div>
      </div>
      <ul class="space-y-3">
        ${t.lines.map(({ product: p, qty, lineTotal }) => `
          <li class="cart-item flex gap-3 p-3 rounded-2xl bg-white/60 ring-1 ring-accent/30">
            <img src="${esc(CH.productImage(p))}" alt="" class="w-20 h-20 rounded-xl object-cover flex-shrink-0">
            <div class="flex-1 min-w-0">
              <div class="flex justify-between gap-2">
                <p class="font-semibold leading-snug">${esc(p.name)}</p>
                <button type="button" class="text-walnut/40 hover:text-red-700 transition flex-shrink-0" data-action="remove-line" data-id="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">
                  <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>
                </button>
              </div>
              <p class="text-xs text-walnut/55">${esc(p.wood)} · ${esc(p.dimensions)}</p>
              <div class="flex items-center justify-between mt-2">
                <div class="qty" data-line="${esc(p.id)}">
                  <button type="button" data-line-step="-1" aria-label="Decrease quantity">−</button>
                  <input type="number" min="1" max="${Number(p.stock)}" value="${qty}" aria-label="Quantity for ${esc(p.name)}">
                  <button type="button" data-line-step="1" aria-label="Increase quantity" ${qty >= Number(p.stock) ? 'disabled' : ''}>+</button>
                </div>
                <div class="text-right">
                  <p class="font-semibold">${fmtMoney(lineTotal)}</p>
                  ${qty > 1 ? `<p class="text-[11px] text-walnut/50">${fmtMoney(p.price)} each</p>` : ''}
                </div>
              </div>
            </div>
          </li>`).join('')}
      </ul>
      <form class="mt-5 flex gap-2" data-promo-form>
        <label class="sr-only" for="promo-code">Discount code</label>
        <input id="promo-code" class="field uppercase" placeholder="Discount code" value="${esc(getCart().code)}" autocomplete="off" maxlength="30">
        ${getCart().code ? '<button type="button" class="btn btn-ghost" data-action="remove-code">Remove</button>' : '<button type="submit" class="btn btn-ghost">Apply</button>'}
      </form>
      ${getCart().code && !t.code ? '<p class="text-xs text-red-700 mt-2">This code is no longer valid.</p>' : ''}`;
    footer.innerHTML = `
      ${totalsHtml(t, { estimate: true })}
      <button type="button" class="btn btn-primary w-full mt-4" data-action="go-checkout">Proceed to checkout</button>
      <button type="button" class="w-full text-center text-sm text-amberwood mt-3 hover:underline" data-action="close-drawer">Continue shopping</button>`;
  }

  /* ---------- Checkout ---------- */
  function captureDraft() {
    const form = $('#checkout-form');
    if (!form) return;
    const fd = new FormData(form);
    state.checkoutDraft = {
      name: fd.get('name') || '',
      phone: fd.get('phone') || '',
      email: fd.get('email') || '',
      city: fd.get('city') || '',
      postcode: fd.get('postcode') || '',
      address: fd.get('address') || '',
      notes: fd.get('notes') || '',
    };
    state.deliveryMethod = fd.get('delivery') === 'address' ? 'address' : 'office';
  }

  function renderCheckout() {
    const t = computeTotals(state.deliveryMethod);
    if (!t.lines.length) {
      state.drawerView = 'cart';
      renderDrawer();
      return;
    }
    const s = t.settings;
    const d = state.checkoutDraft;
    const isAddr = state.deliveryMethod === 'address';
    $('#drawer-body').innerHTML = `
      <form id="checkout-form" novalidate class="space-y-4">
        <fieldset>
          <legend class="font-display text-lg font-semibold mb-3">Contact details</legend>
          <div class="space-y-3">
            <div>
              <label class="field-label" for="co-name">Full name *</label>
              <input id="co-name" name="name" class="field" autocomplete="name" value="${esc(d.name)}" maxlength="80" required>
              <p class="field-error" data-error-for="name"></p>
            </div>
            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <label class="field-label" for="co-phone">Phone number *</label>
                <input id="co-phone" name="phone" type="tel" class="field" autocomplete="tel" placeholder="+359 88 123 4567" value="${esc(d.phone)}" maxlength="20" required>
                <p class="field-error" data-error-for="phone"></p>
              </div>
              <div>
                <label class="field-label" for="co-email">Email *</label>
                <input id="co-email" name="email" type="email" class="field" autocomplete="email" value="${esc(d.email)}" maxlength="120" required>
                <p class="field-error" data-error-for="email"></p>
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend class="font-display text-lg font-semibold mb-3">Delivery</legend>
          <div class="grid gap-2">
            <label class="radio-card">
              <input type="radio" name="delivery" value="office" class="check" ${!isAddr ? 'checked' : ''}>
              <span class="flex-1"><span class="font-semibold block">Courier office</span><span class="text-xs text-walnut/60">Collect from the courier office of your choice</span></span>
              <span class="font-semibold text-sm">${t.freeShipping ? 'Free' : fmtMoney(s.shipping.courierOffice)}</span>
            </label>
            <label class="radio-card">
              <input type="radio" name="delivery" value="address" class="check" ${isAddr ? 'checked' : ''}>
              <span class="flex-1"><span class="font-semibold block">Personal address</span><span class="text-xs text-walnut/60">Door-to-door delivery by courier</span></span>
              <span class="font-semibold text-sm">${t.freeShipping ? 'Free' : fmtMoney(s.shipping.address)}</span>
            </label>
          </div>
          <div class="grid grid-cols-3 gap-3 mt-3">
            <div class="col-span-2">
              <label class="field-label" for="co-city">City / town *</label>
              <input id="co-city" name="city" class="field" autocomplete="address-level2" value="${esc(d.city)}" maxlength="60" required>
              <p class="field-error" data-error-for="city"></p>
            </div>
            <div>
              <label class="field-label" for="co-postcode">Postcode</label>
              <input id="co-postcode" name="postcode" class="field" autocomplete="postal-code" inputmode="numeric" value="${esc(d.postcode)}" maxlength="10">
              <p class="field-error" data-error-for="postcode"></p>
            </div>
          </div>
          <div class="mt-1">
            <label class="field-label" for="co-address" data-address-label>${isAddr ? 'Street address, number, apartment *' : 'Courier company & office name / address *'}</label>
            <input id="co-address" name="address" class="field" autocomplete="${isAddr ? 'street-address' : 'off'}" placeholder="${isAddr ? 'e.g. 12 Bulgaria Blvd., apt. 4' : 'e.g. Speedy — Kardzhali Centre office'}" value="${esc(d.address)}" maxlength="160" required>
            <p class="field-error" data-error-for="address"></p>
          </div>
          <p class="text-xs text-walnut/55 mt-1">Dispatched within ${esc(s.shipping.dispatchDays)}; courier delivery normally takes 1–3 working days within Bulgaria.</p>
        </fieldset>

        <div>
          <label class="field-label" for="co-notes">Order notes <span class="font-normal text-walnut/50">(optional)</span></label>
          <textarea id="co-notes" name="notes" rows="3" class="field resize-y" maxlength="500" placeholder="Delivery instructions, gift message…">${esc(d.notes)}</textarea>
        </div>

        <fieldset>
          <legend class="font-display text-lg font-semibold mb-3">Payment method</legend>
          <label class="radio-card">
            <input type="radio" name="payment" value="cod" class="check" checked>
            <span class="flex-1"><span class="font-semibold block">Cash on Delivery (COD)</span><span class="text-xs text-walnut/60">Pay the courier when you receive your parcel. No extra fee.</span></span>
            <span aria-hidden="true">💶</span>
          </label>
        </fieldset>

        <div class="glass-card p-4">
          <p class="font-display text-lg font-semibold mb-2">Order summary</p>
          <ul class="text-sm space-y-1 mb-3">
            ${t.lines.map((l) => `<li class="flex justify-between gap-3"><span>${l.qty} × ${esc(l.product.name)}</span><span class="font-medium">${fmtMoney(l.lineTotal)}</span></li>`).join('')}
          </ul>
          <div data-checkout-totals>${totalsHtml(t, { estimate: false })}</div>
        </div>

        <div>
          <label class="flex gap-3 items-start text-sm leading-relaxed">
            <input type="checkbox" name="terms" class="check" required>
            <span>I have read and agree to the <button type="button" class="underline text-amberwood font-semibold" data-legal="terms">Terms & Conditions</button> and confirm that I have read the <button type="button" class="underline text-amberwood font-semibold" data-legal="privacy">Privacy Policy</button>. *</span>
          </label>
          <p class="field-error" data-error-for="terms"></p>
          <p class="text-xs text-walnut/60 mt-1">You have a 14-day right of withdrawal — see our <button type="button" class="underline" data-legal="withdrawal">Withdrawal & Returns policy</button>.</p>
        </div>
      </form>`;
    $('#drawer-footer').innerHTML = `
      <div class="flex justify-between items-end mb-3">
        <span class="text-sm">Total to pay on delivery<br><span class="text-xs text-walnut/55">incl. ${t.vatRate}% VAT & shipping</span></span>
        <span class="font-display text-2xl font-bold" data-footer-total>${fmtMoney(t.total)}</span>
      </div>
      <button type="submit" form="checkout-form" class="btn btn-primary w-full" data-place-order>Place order with obligation to pay</button>
      <p class="text-[11px] text-center text-walnut/55 mt-2">By clicking you place a binding order. Payment in cash on delivery.</p>`;

    const form = $('#checkout-form');
    form.addEventListener('change', (e) => {
      if (e.target.name === 'delivery') {
        captureDraft();
        const nt = computeTotals(state.deliveryMethod);
        $('[data-checkout-totals]').innerHTML = totalsHtml(nt, { estimate: false });
        $('[data-footer-total]').textContent = fmtMoney(nt.total);
        const addr = state.deliveryMethod === 'address';
        $('[data-address-label]').textContent = addr ? 'Street address, number, apartment *' : 'Courier company & office name / address *';
        const input = $('#co-address');
        input.placeholder = addr ? 'e.g. 12 Bulgaria Blvd., apt. 4' : 'e.g. Speedy — Kardzhali Centre office';
        input.autocomplete = addr ? 'street-address' : 'off';
      }
    });
    form.addEventListener('input', (e) => {
      if (e.target.classList.contains('invalid')) {
        e.target.classList.remove('invalid');
        const err = $(`[data-error-for="${e.target.name}"]`, form);
        if (err) err.textContent = '';
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      placeOrder(form);
    });
  }

  function setFieldError(form, name, message) {
    const err = $(`[data-error-for="${name}"]`, form);
    if (err) err.textContent = message || '';
    const input = form.elements[name];
    if (input && input.classList) input.classList.toggle('invalid', !!message);
  }

  function validateCheckout(form) {
    const v = (n) => String(form.elements[n].value || '').trim();
    const errors = {};
    if (v('name').length < 3 || !/\s/.test(v('name'))) errors.name = 'Please enter your first and last name.';
    if (!CH.isPhone(v('phone'))) errors.phone = 'Please enter a valid phone number.';
    if (!CH.isEmail(v('email'))) errors.email = 'Please enter a valid email address.';
    if (v('city').length < 2) errors.city = 'Please enter your city or town.';
    if (v('postcode') && !/^[0-9A-Za-z \-]{3,10}$/.test(v('postcode'))) errors.postcode = 'Invalid postcode.';
    if (v('address').length < 5) errors.address = state.deliveryMethod === 'address' ? 'Please enter your street address.' : 'Please enter the courier office.';
    if (!form.elements.terms.checked) errors.terms = 'You must accept the Terms & Conditions and Privacy Policy to place an order.';
    ['name', 'phone', 'email', 'city', 'postcode', 'address', 'terms'].forEach((n) => setFieldError(form, n, errors[n]));
    const first = Object.keys(errors)[0];
    if (first) {
      const el = form.elements[first];
      if (el && el.focus) el.focus();
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return !first;
  }

  function newOrderId() {
    const d = new Date();
    const stamp = `${CH.pad(d.getDate())}${CH.pad(d.getMonth() + 1)}${String(d.getFullYear()).slice(2)}`;
    const existing = new Set(Store.all('orders').map((o) => o.id));
    let id;
    do { id = `CH-${stamp}-${CH.randomCode(5)}`; } while (existing.has(id));
    return id;
  }

  function placeOrder(form) {
    captureDraft();
    if (!validateCheckout(form)) {
      toast('Please check the highlighted fields.', 'error');
      return;
    }
    const btn = $('[data-place-order]');
    btn.disabled = true;
    btn.textContent = 'Placing order…';

    // Re-validate stock at the moment of ordering
    const products = Store.all('products');
    const cart = getCart();
    for (const line of cart.items) {
      const p = products.find((x) => x.id === line.id);
      if (!p || Number(p.stock) < line.qty) {
        toast(p ? `Sorry, only ${p.stock} × ${p.name} left. Your cart was updated.` : 'A product in your cart is no longer available.', 'error');
        sanitizeCart();
        state.drawerView = 'cart';
        renderDrawer();
        renderProducts();
        return;
      }
    }

    const t = computeTotals(state.deliveryMethod);
    const d = state.checkoutDraft;
    const now = new Date().toISOString();
    const order = {
      id: newOrderId(),
      createdAt: now,
      status: 'New',
      customer: { name: d.name.trim(), phone: d.phone.trim(), email: d.email.trim().toLowerCase() },
      delivery: {
        method: state.deliveryMethod,
        methodLabel: state.deliveryMethod === 'address' ? 'Courier — personal address' : 'Courier — office pick-up',
        city: d.city.trim(),
        postcode: d.postcode.trim(),
        address: d.address.trim(),
      },
      notes: d.notes.trim(),
      payment: 'Cash on Delivery (COD)',
      items: t.lines.map((l) => ({
        productId: l.product.id, name: l.product.name, wood: l.product.wood, dimensions: l.product.dimensions,
        price: l.product.price, qty: l.qty, lineTotal: l.lineTotal,
      })),
      subtotal: t.subtotal,
      discountCode: t.code ? t.code.code : '',
      discountPercent: t.code ? Number(t.code.percent) : 0,
      discount: t.discount,
      shipping: t.shipping,
      total: t.total,
      vat: t.vat,
      vatRate: t.vatRate,
      termsAcceptedAt: now,
      history: [{ at: now, status: 'New', note: 'Order placed by customer' }],
    };

    // Decrement stock
    const updated = products.map((p) => {
      const line = order.items.find((i) => i.productId === p.id);
      return line ? { ...p, stock: Math.max(0, Number(p.stock) - line.qty) } : p;
    });
    if (!Store.upsert('orders', order)) {
      btn.disabled = false;
      btn.textContent = 'Place order with obligation to pay';
      return;
    }
    Store.saveAll('products', updated);
    Store.log('Order placed', `${order.id} · ${order.customer.name} · ${fmtMoney(order.total)}`);
    Store.setDoc('cart', { items: [], code: '' });
    state.checkoutDraft = {};
    state.lastOrderId = order.id;
    state.drawerView = 'done';
    renderCartBadge();
    renderDrawer();
    renderProducts();
    $('#drawer-body').scrollTop = 0;
  }

  function orderReceiptHtml(o) {
    const s = Store.settings();
    const m = s.merchant;
    return `
      <h1>Chopaholic — Order confirmation</h1>
      <p class="muted">Order number <strong>${esc(o.id)}</strong> · Placed on ${fmtDateTime(o.createdAt)}</p>
      <h2>Seller</h2>
      <p>${esc(m.name)}<br>${esc(m.address)}<br>${esc(m.phone)} · ${esc(m.email)}${m.vatNumber ? `<br>VAT: ${esc(m.vatNumber)}` : ''}</p>
      <h2>Customer & delivery</h2>
      <p>${esc(o.customer.name)}<br>${esc(o.customer.phone)} · ${esc(o.customer.email)}<br>
      ${esc(o.delivery.methodLabel)}: ${esc(o.delivery.address)}, ${esc(o.delivery.postcode ? `${o.delivery.postcode} ` : '')}${esc(o.delivery.city)}</p>
      ${o.notes ? `<p class="muted">Notes: ${esc(o.notes)}</p>` : ''}
      <h2>Items</h2>
      <table><thead><tr><th>Product</th><th>Qty</th><th class="right">Unit price</th><th class="right">Total</th></tr></thead><tbody>
      ${o.items.map((i) => `<tr><td>${esc(i.name)}<br><span class="muted">${esc(i.wood)} · ${esc(i.dimensions)}</span></td><td>${i.qty}</td><td class="right">${fmtMoney(i.price)}</td><td class="right">${fmtMoney(i.lineTotal)}</td></tr>`).join('')}
      <tr><td colspan="3">Subtotal</td><td class="right">${fmtMoney(o.subtotal)}</td></tr>
      ${o.discount ? `<tr><td colspan="3">Discount (${esc(o.discountCode)} −${o.discountPercent}%)</td><td class="right">−${fmtMoney(o.discount)}</td></tr>` : ''}
      <tr><td colspan="3">Shipping</td><td class="right">${o.shipping ? fmtMoney(o.shipping) : 'Free'}</td></tr>
      <tr class="total"><td colspan="3">Total (payable on delivery)</td><td class="right">${fmtMoney(o.total)}</td></tr>
      <tr><td colspan="3" class="muted">of which VAT ${o.vatRate}%</td><td class="right muted">${fmtMoney(o.vat)}</td></tr>
      </tbody></table>
      <h2>Payment</h2><p>${esc(o.payment)}</p>
      <h2>Your right of withdrawal</h2>
      <p class="muted">You may withdraw from this contract within 14 days of receiving the goods without giving any reason, by informing ${esc(m.name)} (${esc(m.email)}, ${esc(m.phone)}, ${esc(m.address)}) or by using the "Withdraw from contract here" function on our website. The direct cost of returning the goods is borne by you. Full terms: Right of Withdrawal & Returns policy. Legal guarantee of conformity: 2 years.</p>`;
  }

  function renderDone() {
    const o = Store.get('orders', state.lastOrderId);
    if (!o) {
      state.drawerView = 'cart';
      renderDrawer();
      return;
    }
    $('#drawer-body').innerHTML = `
      <div class="text-center py-4">
        <div class="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amberwood to-accent text-cream flex items-center justify-center text-4xl shadow-lg" aria-hidden="true">✓</div>
        <h3 class="font-display text-2xl font-bold mt-4">Thank you, ${esc(o.customer.name.split(' ')[0])}!</h3>
        <p class="text-sm text-walnut/70 mt-1">Your order has been received and is being prepared.</p>
        <div class="mt-4 inline-flex flex-col items-center px-5 py-3 rounded-2xl wood-dark text-cream">
          <span class="text-[11px] uppercase tracking-widest text-accent">Order number</span>
          <span class="font-mono text-lg font-bold tracking-wider" data-order-id>${esc(o.id)}</span>
        </div>
        <p class="text-xs text-walnut/60 mt-2">Placed on ${fmtDateTime(o.createdAt)}</p>
      </div>
      <div class="glass-card p-4 mt-4 text-sm">
        <p class="font-semibold mb-2">Items</p>
        <ul class="space-y-1">${o.items.map((i) => `<li class="flex justify-between gap-3"><span>${i.qty} × ${esc(i.name)}</span><span>${fmtMoney(i.lineTotal)}</span></li>`).join('')}</ul>
        <dl class="mt-3 pt-3 border-t border-accent/40 space-y-1">
          <div class="flex justify-between"><dt>Subtotal</dt><dd>${fmtMoney(o.subtotal)}</dd></div>
          ${o.discount ? `<div class="flex justify-between text-green-800"><dt>Discount (${esc(o.discountCode)})</dt><dd>−${fmtMoney(o.discount)}</dd></div>` : ''}
          <div class="flex justify-between"><dt>Shipping</dt><dd>${o.shipping ? fmtMoney(o.shipping) : 'Free'}</dd></div>
          <div class="flex justify-between font-bold text-base pt-1"><dt>Total — cash on delivery</dt><dd>${fmtMoney(o.total)}</dd></div>
          <div class="flex justify-between text-xs text-walnut/60"><dt>incl. ${o.vatRate}% VAT</dt><dd>${fmtMoney(o.vat)}</dd></div>
        </dl>
      </div>
      <div class="glass-card p-4 mt-3 text-sm">
        <p class="font-semibold mb-1">Delivery</p>
        <p>${esc(o.customer.name)} · ${esc(o.customer.phone)}</p>
        <p>${esc(o.delivery.methodLabel)}</p>
        <p class="text-walnut/70">${esc(o.delivery.address)}, ${esc(o.delivery.postcode ? `${o.delivery.postcode} ` : '')}${esc(o.delivery.city)}</p>
      </div>
      <p class="text-xs text-walnut/60 mt-4 leading-relaxed">Please keep your order number. You can withdraw from this purchase within 14 days of receiving it via <button type="button" class="underline" data-action="open-withdrawal">Withdraw from contract here</button>. Questions? ${esc(Store.settings().merchant.phone)}.</p>`;
    $('#drawer-footer').innerHTML = `
      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="btn btn-ghost" data-action="print-order" data-id="${esc(o.id)}">Print / save PDF</button>
        <button type="button" class="btn btn-ghost" data-action="copy-order-id" data-id="${esc(o.id)}">Copy order no.</button>
      </div>
      <button type="button" class="btn btn-primary w-full mt-2" data-action="close-drawer">Continue shopping</button>`;
  }

  /* ====================================================================
   * Online withdrawal function (Art. 11a Directive 2011/83/EU)
   * ==================================================================== */
  function openWithdrawal() {
    const body = openModal(`
      <div data-wd-step="1">
        <p class="text-sm text-walnut/75 leading-relaxed">Use this form to withdraw from your purchase within 14 days of receiving the goods. After you confirm, you will immediately receive an acknowledgement of receipt with the date and time of your withdrawal, which you can print or save.</p>
        <form class="mt-5 space-y-3" data-wd-form novalidate>
          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="field-label" for="wd-name">Full name *</label>
              <input id="wd-name" name="name" class="field" autocomplete="name" maxlength="80" required>
              <p class="field-error" data-error-for="name"></p>
            </div>
            <div>
              <label class="field-label" for="wd-order">Order number *</label>
              <input id="wd-order" name="orderId" class="field uppercase" placeholder="CH-010126-ABCDE" maxlength="30" required value="${esc(state.lastOrderId || '')}">
              <p class="field-error" data-error-for="orderId"></p>
            </div>
            <div>
              <label class="field-label" for="wd-email">Email used for the order *</label>
              <input id="wd-email" name="email" type="email" class="field" autocomplete="email" maxlength="120" required>
              <p class="field-error" data-error-for="email"></p>
            </div>
            <div>
              <label class="field-label" for="wd-received">Received on (dd/mm/yyyy)</label>
              <input id="wd-received" name="received" class="field" placeholder="dd/mm/yyyy" inputmode="numeric" maxlength="10">
              <p class="field-error" data-error-for="received"></p>
            </div>
          </div>
          <div>
            <span class="field-label">Scope of withdrawal *</span>
            <div class="grid sm:grid-cols-2 gap-2">
              <label class="radio-card"><input type="radio" name="scope" value="all" class="check" checked><span class="text-sm font-semibold">The entire order</span></label>
              <label class="radio-card"><input type="radio" name="scope" value="partial" class="check"><span class="text-sm font-semibold">Only some items</span></label>
            </div>
          </div>
          <div data-wd-items hidden>
            <label class="field-label" for="wd-items">Which items? *</label>
            <textarea id="wd-items" name="items" rows="2" class="field" maxlength="500" placeholder="e.g. 1 × Walnut Charcuterie Paddle"></textarea>
            <p class="field-error" data-error-for="items"></p>
          </div>
          <div>
            <label class="field-label" for="wd-comment">Comment <span class="font-normal text-walnut/50">(optional — you do not need to give a reason)</span></label>
            <textarea id="wd-comment" name="comment" rows="2" class="field" maxlength="500"></textarea>
          </div>
          <button type="submit" class="btn btn-primary w-full">Continue to confirmation</button>
        </form>
      </div>
      <div data-wd-step="2" hidden></div>
      <div data-wd-step="3" hidden></div>`, { title: 'Withdraw from contract here', size: 'md' });

    const form = $('[data-wd-form]', body);
    let pending = null;

    form.addEventListener('change', (e) => {
      if (e.target.name === 'scope') $('[data-wd-items]', body).hidden = e.target.value !== 'partial';
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (n) => String(form.elements[n].value || '').trim();
      const errors = {};
      if (v('name').length < 3) errors.name = 'Please enter your full name.';
      if (!/^CH-\d{6}-[A-Z0-9]{4,6}$/i.test(v('orderId'))) errors.orderId = 'Please enter your order number (e.g. CH-010126-ABCDE).';
      if (!CH.isEmail(v('email'))) errors.email = 'Please enter a valid email address.';
      if (v('received') && !CH.parseDMY(v('received'))) errors.received = 'Use the format dd/mm/yyyy.';
      const scope = form.elements.scope.value;
      if (scope === 'partial' && v('items').length < 3) errors.items = 'Please list the items you are returning.';
      ['name', 'orderId', 'email', 'received', 'items'].forEach((n) => setFieldError(form, n, errors[n]));
      if (Object.keys(errors).length) return;

      pending = {
        name: v('name'), orderId: v('orderId').toUpperCase(), email: v('email').toLowerCase(),
        receivedOn: v('received') ? CH.parseDMY(v('received')) : '', scope, items: scope === 'partial' ? v('items') : 'Entire order',
        comment: v('comment'),
      };
      const step2 = $('[data-wd-step="2"]', body);
      step2.innerHTML = `
        <p class="text-sm text-walnut/75">Please review your withdrawal statement and confirm it.</p>
        <div class="legal-form-box mt-4 text-sm">
          <p>To: ${esc(Store.settings().merchant.name)}, ${esc(Store.settings().merchant.address)}</p>
          <p>I hereby give notice that I withdraw from my contract of sale of the following goods: <strong>${esc(pending.items)}</strong></p>
          <p>Order number: <strong>${esc(pending.orderId)}</strong></p>
          ${pending.receivedOn ? `<p>Received on: ${fmtDate(pending.receivedOn)}</p>` : ''}
          <p>Name of consumer: ${esc(pending.name)}</p>
          <p>Email: ${esc(pending.email)}</p>
          ${pending.comment ? `<p>Comment: ${esc(pending.comment)}</p>` : ''}
          <p>Date: ${fmtDate(new Date())}</p>
        </div>
        <div class="flex flex-wrap gap-2 justify-end mt-5">
          <button type="button" class="btn btn-ghost" data-wd-back>Edit</button>
          <button type="button" class="btn btn-primary" data-wd-confirm>Confirm withdrawal</button>
        </div>`;
      $('[data-wd-step="1"]', body).hidden = true;
      step2.hidden = false;
      $('[data-wd-confirm]', step2).focus();
    });

    body.addEventListener('click', (e) => {
      if (e.target.closest('[data-wd-back]')) {
        $('[data-wd-step="2"]', body).hidden = true;
        $('[data-wd-step="1"]', body).hidden = false;
        return;
      }
      if (e.target.closest('[data-wd-confirm]') && pending) {
        const now = new Date().toISOString();
        const order = Store.get('orders', pending.orderId);
        const matched = !!(order && order.customer.email === pending.email);
        const record = { id: `WD-${CH.randomCode(6)}`, submittedAt: now, ...pending, orderMatched: matched, status: 'Received' };
        if (!Store.upsert('withdrawals', record)) return;
        if (matched) {
          order.withdrawal = { id: record.id, at: now, scope: record.scope, items: record.items };
          order.history = [...(order.history || []), { at: now, status: order.status, note: `Customer withdrawal ${record.id} received (${record.items})` }];
          Store.upsert('orders', order);
        }
        Store.log('Withdrawal received', `${record.id} for order ${record.orderId}${matched ? '' : ' (order not matched)'}`);
        const step3 = $('[data-wd-step="3"]', body);
        step3.innerHTML = `
          <div class="text-center">
            <div class="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-amberwood to-accent text-cream flex items-center justify-center text-3xl" aria-hidden="true">✓</div>
            <h3 class="font-display text-2xl font-bold mt-3">Withdrawal received</h3>
          </div>
          <div class="glass-card p-4 mt-4 text-sm space-y-1">
            <p><strong>Acknowledgement of receipt</strong></p>
            <p>Reference: <strong class="font-mono">${esc(record.id)}</strong></p>
            <p>Received on: <strong>${fmtDateTime(record.submittedAt)}</strong></p>
            <p>Order: ${esc(record.orderId)} · Goods: ${esc(record.items)}</p>
            ${matched ? '' : '<p class="text-xs text-walnut/60 mt-2">We could not automatically match this order number and email. Your withdrawal is still validly recorded; we will contact you to confirm the details.</p>'}
          </div>
          <p class="text-sm text-walnut/75 mt-4 leading-relaxed">Please send the goods back to ${esc(Store.settings().merchant.address)} within 14 days. We will refund all payments received, including standard delivery costs, within 14 days of today (we may wait until we receive the goods back or proof of dispatch). Please save or print this acknowledgement.</p>
          <div class="flex flex-wrap gap-2 justify-end mt-5">
            <button type="button" class="btn btn-ghost" data-wd-print>Print / save PDF</button>
            <button type="button" class="btn btn-primary" data-close-modal>Done</button>
          </div>`;
        $('[data-wd-step="2"]', body).hidden = true;
        step3.hidden = false;
        step3.dataset.recordId = record.id;
        pending = null;
        return;
      }
      if (e.target.closest('[data-wd-print]')) {
        const r = Store.get('withdrawals', $('[data-wd-step="3"]', body).dataset.recordId);
        if (!r) return;
        const m = Store.settings().merchant;
        CH.printDocument(`Withdrawal ${r.id}`, `
          <h1>Acknowledgement of receipt — withdrawal</h1>
          <p class="muted">Reference ${esc(r.id)} · Received on ${fmtDateTime(r.submittedAt)}</p>
          <h2>Trader</h2><p>${esc(m.name)}<br>${esc(m.address)}<br>${esc(m.phone)} · ${esc(m.email)}</p>
          <h2>Consumer</h2><p>${esc(r.name)}<br>${esc(r.email)}</p>
          <h2>Withdrawal statement</h2>
          <p>I hereby give notice that I withdraw from my contract of sale of the following goods: ${esc(r.items)}.</p>
          <p>Order number: ${esc(r.orderId)}${r.receivedOn ? `<br>Received on: ${fmtDate(r.receivedOn)}` : ''}</p>
          ${r.comment ? `<p>Comment: ${esc(r.comment)}</p>` : ''}
          <h2>Next steps</h2>
          <p>Return the goods to ${esc(m.address)} within 14 days. The refund of all payments received, including standard delivery costs, will be made within 14 days of the date above.</p>`);
      }
    });
  }

  /* ====================================================================
   * Contact form
   * ==================================================================== */
  function initContactForm() {
    const form = $('#contact-form');
    form.addEventListener('input', (e) => {
      if (e.target.name) setFieldError(form, e.target.name, '');
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (n) => String(form.elements[n].value || '').trim();
      const errors = {};
      if (v('name').length < 2) errors.name = 'Please enter your name.';
      if (!CH.isEmail(v('email'))) errors.email = 'Please enter a valid email address.';
      if (v('message').length < 10) errors.message = 'Please write at least 10 characters.';
      if (!form.elements.consent.checked) errors.consent = 'Please confirm you have read the Privacy Policy.';
      ['name', 'email', 'message', 'consent'].forEach((n) => setFieldError(form, n, errors[n]));
      if (Object.keys(errors).length) return;
      const msg = {
        id: CH.uid('msg'), createdAt: new Date().toISOString(), name: v('name'), email: v('email').toLowerCase(),
        subject: v('subject'), message: v('message'), read: false,
      };
      if (!Store.upsert('messages', msg)) return;
      Store.log('Contact message received', `${msg.name} · ${msg.subject}`);
      form.reset();
      toast('Thank you! Your message has been sent. We will reply within one working day.');
    });
  }

  /* ====================================================================
   * Admin login
   * ==================================================================== */
  function openAdminLogin() {
    if (CH.Admin && CH.Admin.isLoggedIn()) {
      CH.Admin.open();
      return;
    }
    const body = openModal(`
      <form data-admin-login class="space-y-4" novalidate>
        <p class="text-sm text-walnut/70">Staff access only. Enter the admin password to manage products, orders, stories and promotions.</p>
        <div>
          <label class="field-label" for="admin-pass">Password</label>
          <input id="admin-pass" name="password" type="password" class="field" autocomplete="current-password" required autofocus>
          <p class="field-error" data-error-for="password"></p>
        </div>
        <button type="submit" class="btn btn-primary w-full">Log in</button>
      </form>`, { title: 'Admin login', size: 'sm' });
    const form = $('[data-admin-login]', body);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (CH.Admin.login(form.elements.password.value)) {
        closeModal(body);
        CH.Admin.open();
      } else {
        setFieldError(form, 'password', 'Incorrect password.');
        form.elements.password.select();
      }
    });
  }

  /* ====================================================================
   * Scroll effects & navigation
   * ==================================================================== */
  let revealObserver = null;
  function observeReveals() {
    const els = $$('.reveal:not(.visible)');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('visible'));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    }
    els.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i % 6, 5) * 60}ms`;
      revealObserver.observe(el);
    });
  }

  function initNav() {
    const header = $('#site-header');
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const toggle = $('#menu-toggle');
    const mobileNav = $('#mobile-nav');
    toggle.addEventListener('click', () => {
      const open = !mobileNav.classList.contains('open');
      mobileNav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    $$('a', mobileNav).forEach((a) => a.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));

    if ('IntersectionObserver' in window) {
      const links = $$('[data-nav]');
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            links.forEach((l) => l.classList.toggle('active', l.dataset.nav === entry.target.id));
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      ['home', 'shop', 'stories', 'legal', 'contact'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) io.observe(el);
      });
    }
  }

  /* ====================================================================
   * Global event delegation
   * ==================================================================== */
  function initEvents() {
    document.addEventListener('click', async (e) => {
      const legal = e.target.closest('[data-legal]');
      if (legal) {
        e.preventDefault();
        openLegal(legal.dataset.legal);
        return;
      }
      const consentBtn = e.target.closest('[data-consent]');
      if (consentBtn) {
        const c = consentBtn.dataset.consent;
        if (c === 'accept') { Consent.save(true, true); toast('Thanks! All storage categories enabled.'); }
        else if (c === 'decline') { Consent.save(false, false); toast('Only strictly necessary storage will be used.', 'info'); }
        else openCookieSettings();
        return;
      }
      const cat = e.target.closest('[data-category]');
      if (cat) {
        state.category = cat.dataset.category;
        savePrefs();
        renderProducts();
        return;
      }
      const filterLink = e.target.closest('[data-filter-link]');
      if (filterLink) {
        state.category = filterLink.dataset.filterLink;
        savePrefs();
        renderProducts();
        return;
      }
      const act = e.target.closest('[data-action]');
      if (!act) return;
      const id = act.dataset.id;
      switch (act.dataset.action) {
        case 'quick-view': openQuickView(id); break;
        case 'add-to-cart': if (addToCart(id, 1)) openDrawer(); break;
        case 'open-story': openStory(id); break;
        case 'remove-line': removeFromCart(id); break;
        case 'remove-code': {
          const cart = getCart();
          cart.code = '';
          saveCart(cart);
          break;
        }
        case 'go-checkout':
          if (sanitizeCart()) { toast('Your cart was updated to reflect current stock.', 'info'); renderDrawer(); break; }
          state.drawerView = 'checkout';
          renderDrawer();
          $('#drawer-body').scrollTop = 0;
          break;
        case 'close-drawer': closeDrawer(); break;
        case 'shop-now':
          closeDrawer();
          document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
          break;
        case 'reset-filters':
          state.category = 'all';
          state.search = '';
          $('#shop-search').value = '';
          savePrefs();
          renderProducts();
          break;
        case 'cookie-settings': openCookieSettings(); break;
        case 'open-withdrawal': openWithdrawal(); break;
        case 'print-order': {
          const o = Store.get('orders', id);
          if (o) CH.printDocument(`Order ${o.id}`, orderReceiptHtml(o));
          break;
        }
        case 'copy-order-id':
          try {
            await navigator.clipboard.writeText(id);
            toast('Order number copied');
          } catch (err) {
            toast(`Your order number is ${id}`, 'info');
          }
          break;
        case 'copy-model-form':
          try {
            await navigator.clipboard.writeText(modelFormText());
            toast('Model withdrawal form copied to clipboard');
          } catch (err) {
            toast('Copy failed — please select the text manually.', 'error');
          }
          break;
        case 'print-model-form':
          CH.printDocument('Model withdrawal form', `<h1>Model withdrawal form</h1>${modelFormText().split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('')}`);
          break;
        default: break;
      }
    });

    // Cart drawer: quantity steppers & promo code
    const drawer = $('#cart-drawer');
    drawer.addEventListener('click', (e) => {
      const step = e.target.closest('[data-line-step]');
      if (step) {
        const wrap = step.closest('[data-line]');
        setQty(wrap.dataset.line, cartQty(wrap.dataset.line) + Number(step.dataset.lineStep));
      }
    });
    drawer.addEventListener('change', (e) => {
      const wrap = e.target.closest('[data-line]');
      if (wrap && e.target.matches('input')) {
        const v = parseInt(e.target.value, 10);
        setQty(wrap.dataset.line, Number.isNaN(v) ? 1 : v);
      }
    });
    drawer.addEventListener('submit', (e) => {
      const promo = e.target.closest('[data-promo-form]');
      if (!promo) return;
      e.preventDefault();
      const input = $('#promo-code');
      const code = findCode(input.value);
      if (!code) {
        input.classList.add('invalid');
        toast('This discount code is not valid.', 'error');
        return;
      }
      const cart = getCart();
      cart.code = code.code;
      saveCart(cart);
      toast(`Code ${code.code} applied — ${code.percent}% off`);
    });

    $('#cart-button').addEventListener('click', () => openDrawer('cart'));
    $('#drawer-close').addEventListener('click', closeDrawer);
    $('#drawer-overlay').addEventListener('click', closeDrawer);
    $('#drawer-back').addEventListener('click', () => {
      captureDraft();
      state.drawerView = 'cart';
      renderDrawer();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.querySelector('.modal-wrap') && $('#cart-drawer').classList.contains('open')) closeDrawer();
    });

    $('#announce-close').addEventListener('click', () => {
      sessionStorage.setItem('chopaholic_announce_dismissed', Store.settings().announcement.text);
      $('#announce').classList.add('hidden');
    });

    $('#promo-cta').addEventListener('click', (e) => {
      const pid = e.currentTarget.dataset.productId;
      if (pid) openQuickView(pid);
      else document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    });

    $('#shop-search').addEventListener('input', CH.debounce((e) => {
      state.search = e.target.value;
      renderProducts();
    }, 180));
    $('#shop-sort').addEventListener('change', (e) => {
      state.sort = e.target.value;
      if (state.sort === 'popular' && !Consent.has('analytics')) {
        toast('"Most viewed" uses on-device statistics. Enable Statistics in Cookie settings to personalise it.', 'info');
      }
      savePrefs();
      renderProducts();
    });

    $('#admin-trigger').addEventListener('click', openAdminLogin);

    // React to data changes (admin edits in this or another tab)
    Store.on((name) => {
      if (['products', 'settings', 'all'].includes(name)) {
        sanitizeCart();
        renderSiteContent();
        renderProducts();
        renderCartBadge();
        if ($('#cart-drawer').classList.contains('open') && state.drawerView !== 'done') renderDrawer();
      }
      if (['posts', 'all'].includes(name)) renderStories();
      if (name === 'cart') {
        renderCartBadge();
        if ($('#cart-drawer').classList.contains('open') && state.drawerView === 'cart') renderDrawer();
      }
    });
  }

  /* ====================================================================
   * Boot
   * ==================================================================== */
  function init() {
    $('#year').textContent = new Date().getFullYear();
    loadPrefs();
    sanitizeCart();
    renderSiteContent();
    renderProducts();
    renderStories();
    renderCartBadge();
    initNav();
    initEvents();
    initContactForm();
    observeReveals();
    if (!Consent.get()) setTimeout(showCookieBanner, 700);
  }

  CH.Shop = { openQuickView, openLegal, openDrawer, closeDrawer, renderProducts, orderReceiptHtml, Consent };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
