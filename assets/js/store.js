/* Chopaholic — data layer (localStorage repository, Firebase-ready) + seed data + product artwork generator. */
(function () {
  'use strict';

  const CH = (window.CH = window.CH || {});

  const PREFIX = 'chopaholic_';
  const SEED_VERSION = 'v1';

  /**
   * Storage keys. Each collection maps 1:1 to a future Firestore collection
   * (products, orders, posts, messages, withdrawals, logs) and each document
   * key maps to a single Firestore document (settings/site, carts/{uid}, …).
   */
  const KEYS = {
    seed: `${PREFIX}seed`,
    products: `${PREFIX}products`,
    orders: `${PREFIX}orders`,
    posts: `${PREFIX}posts`,
    messages: `${PREFIX}messages`,
    withdrawals: `${PREFIX}withdrawals`,
    logs: `${PREFIX}logs`,
    settings: `${PREFIX}settings`,
    cart: `${PREFIX}cart`,
    consent: `${PREFIX}consent`,
    prefs: `${PREFIX}prefs`,
    analytics: `${PREFIX}analytics`,
  };

  const COLLECTIONS = ['products', 'orders', 'posts', 'messages', 'withdrawals', 'logs'];
  const listeners = new Set();

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      if (CH.toast) CH.toast('Browser storage is full. Remove large images or old records and try again.', 'error');
      return false;
    }
  }

  function emit(name) {
    listeners.forEach((fn) => {
      try { fn(name); } catch (err) { console.error(err); }
    });
  }

  const Store = {
    KEYS,

    /* ----- collections ----- */
    all(col) {
      return read(KEYS[col], []);
    },
    get(col, id) {
      return this.all(col).find((x) => x.id === id) || null;
    },
    saveAll(col, list) {
      const ok = write(KEYS[col], list);
      if (ok) emit(col);
      return ok;
    },
    upsert(col, item) {
      const list = this.all(col);
      const idx = list.findIndex((x) => x.id === item.id);
      if (idx >= 0) list[idx] = item;
      else list.unshift(item);
      return this.saveAll(col, list) ? item : null;
    },
    remove(col, id) {
      return this.saveAll(col, this.all(col).filter((x) => x.id !== id));
    },

    /* ----- single documents ----- */
    getDoc(name, fallback) {
      return read(KEYS[name], fallback);
    },
    setDoc(name, value) {
      const ok = write(KEYS[name], value);
      if (ok) emit(name);
      return ok;
    },
    removeDoc(name) {
      try { localStorage.removeItem(KEYS[name]); } catch (err) { /* ignore */ }
      emit(name);
    },

    settings() {
      const saved = read(KEYS.settings, {});
      const defaults = defaultSettings();
      return {
        ...defaults,
        ...saved,
        announcement: { ...defaults.announcement, ...(saved.announcement || {}) },
        hero: { ...defaults.hero, ...(saved.hero || {}) },
        promo: { ...defaults.promo, ...(saved.promo || {}) },
        shipping: { ...defaults.shipping, ...(saved.shipping || {}) },
        merchant: { ...defaults.merchant, ...(saved.merchant || {}) },
        codes: Array.isArray(saved.codes) ? saved.codes : defaults.codes,
      };
    },
    saveSettings(next) {
      return this.setDoc('settings', next);
    },

    log(action, detail = '') {
      const list = this.all('logs');
      list.unshift({ id: CH.uid('log'), at: new Date().toISOString(), action, detail });
      this.saveAll('logs', list.slice(0, 300));
    },

    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    seed(force = false) {
      if (!force && read(KEYS.seed, null) === SEED_VERSION) return;
      write(KEYS.products, seedProducts());
      write(KEYS.posts, seedPosts());
      write(KEYS.settings, defaultSettings());
      if (force || read(KEYS.orders, null) == null) write(KEYS.orders, []);
      if (force || read(KEYS.messages, null) == null) write(KEYS.messages, []);
      if (force || read(KEYS.withdrawals, null) == null) write(KEYS.withdrawals, []);
      write(KEYS.logs, [{ id: CH.uid('log'), at: new Date().toISOString(), action: 'Store initialised', detail: 'Demo catalogue, stories and settings loaded' }]);
      write(KEYS.seed, SEED_VERSION);
      if (force) emit('all');
    },
  };

  /* Cross-tab realtime: an order placed in one tab appears instantly in an admin panel open in another. */
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith(PREFIX)) return;
    const name = Object.keys(KEYS).find((k) => KEYS[k] === e.key);
    if (name) emit(name);
  });

  /* ================= Product artwork (SVG, generated — no external image hosting required) ================= */

  const WOODS = {
    walnut: { light: '#7a4e2f', mid: '#5b3820', dark: '#3a2213', grain: '#26150a' },
    oak: { light: '#d9b27c', mid: '#c19a6b', dark: '#9d7648', grain: '#7a5630' },
    ash: { light: '#ecd9b6', mid: '#dcc39a', dark: '#c3a57a', grain: '#a68559' },
    cherry: { light: '#b86f48', mid: '#9e5b3c', dark: '#7c4128', grain: '#5c2c18' },
    maple: { light: '#f1dfbb', mid: '#e5cc9c', dark: '#d1b27e', grain: '#b6925c' },
    olive: { light: '#d7bd8a', mid: '#bf9f68', dark: '#98774a', grain: '#5e4424' },
    acacia: { light: '#b27a45', mid: '#9a6232', dark: '#744521', grain: '#4d2b12' },
    beech: { light: '#e6c9a0', mid: '#d6b07f', dark: '#b88f5d', grain: '#946c3f' },
  };

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    let a = seed || 1;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function woodFor(name, index = 0) {
    const keys = Object.keys(WOODS);
    const found = String(name || '').toLowerCase().match(new RegExp(keys.join('|'), 'g')) || [];
    return WOODS[found[index] || found[0] || 'oak'];
  }

  function grainPaths(r, x, y, w, h, color, count) {
    let out = '';
    for (let i = 0; i < count; i++) {
      const baseY = y + (h / count) * i + r() * (h / count);
      const amp = 4 + r() * 14;
      const seg = w / 4;
      let d = `M${x - 20} ${baseY.toFixed(1)}`;
      for (let s = 0; s < 5; s++) {
        const cx = x - 20 + seg * s + seg / 2;
        const cy = baseY + (r() > 0.5 ? amp : -amp);
        const ex = x - 20 + seg * (s + 1);
        const ey = baseY + (r() - 0.5) * amp;
        d += ` Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
      }
      out += `<path d="${d}" stroke="${color}" stroke-opacity="${(0.12 + r() * 0.28).toFixed(2)}" stroke-width="${(0.8 + r() * 2.6).toFixed(1)}" fill="none"/>`;
    }
    if (r() > 0.35) {
      const kx = x + w * (0.2 + r() * 0.6);
      const ky = y + h * (0.25 + r() * 0.5);
      out += `<ellipse cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" rx="${(10 + r() * 14).toFixed(1)}" ry="${(5 + r() * 6).toFixed(1)}" fill="${color}" fill-opacity="0.35"/>`;
      out += `<ellipse cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" rx="${(22 + r() * 16).toFixed(1)}" ry="${(10 + r() * 6).toFixed(1)}" stroke="${color}" stroke-opacity="0.22" stroke-width="1.5" fill="none"/>`;
    }
    return out;
  }

  function gradient(id, wood, angle = 0) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="${angle}">
      <stop offset="0" stop-color="${wood.light}"/><stop offset="0.55" stop-color="${wood.mid}"/><stop offset="1" stop-color="${wood.dark}"/></linearGradient>`;
  }

  function cuttingBoard(r, wood, id, x, y, w, h, opts = {}) {
    const clip = `clip-${id}`;
    let inner = '';
    if (opts.endGrain) {
      const cols = 9;
      const rows = 6;
      const cw = w / cols;
      const rh = h / rows;
      for (let c = 0; c < cols; c++) {
        for (let rr = 0; rr < rows; rr++) {
          const alt = (c + rr) % 2 === 0;
          const shade = alt ? wood.mid : opts.altWood ? opts.altWood.mid : wood.light;
          inner += `<rect x="${(x + c * cw).toFixed(1)}" y="${(y + rr * rh).toFixed(1)}" width="${(cw + 0.5).toFixed(1)}" height="${(rh + 0.5).toFixed(1)}" fill="${shade}"/>`;
          const cx = x + c * cw + cw * (0.3 + r() * 0.4);
          const cy = y + rr * rh + rh * (0.3 + r() * 0.4);
          for (let k = 1; k <= 3; k++) {
            inner += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(k * cw * 0.14).toFixed(1)}" stroke="${wood.grain}" stroke-opacity="0.18" fill="none"/>`;
          }
        }
      }
    } else {
      inner = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#g-${id})"/>` + grainPaths(r, x, y, w, h, wood.grain, 16);
    }
    const groove = opts.groove
      ? `<rect x="${x + 22}" y="${y + 22}" width="${w - 44}" height="${h - 44}" rx="${opts.rx ? opts.rx - 8 : 16}" fill="none" stroke="${wood.grain}" stroke-opacity="0.35" stroke-width="7"/>
         <rect x="${x + 22}" y="${y + 24}" width="${w - 44}" height="${h - 44}" rx="${opts.rx ? opts.rx - 8 : 16}" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="2"/>`
      : '';
    const rx = opts.rx || 24;
    return `
      <defs>${gradient(`g-${id}`, wood, 0.4)}<clipPath id="${clip}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/></clipPath></defs>
      <rect x="${x}" y="${y + 12}" width="${w}" height="${h}" rx="${rx}" fill="${wood.dark}" filter="url(#shadow)"/>
      <g clip-path="url(#${clip})">${inner}
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sheen)"/>
      </g>
      ${groove}
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${wood.grain}" stroke-opacity="0.35" stroke-width="2"/>`;
  }

  function paddlePath(x, y, w, h) {
    const bodyW = w * 0.74;
    const hx = x + bodyW;
    const hh = h * 0.28;
    const hy = y + (h - hh) / 2;
    return `M${x + 30} ${y} H${hx - 30} Q${hx} ${y} ${hx} ${y + 30} V${hy - 10} Q${hx} ${hy} ${hx + 20} ${hy} H${x + w - hh / 2} A${hh / 2} ${hh / 2} 0 0 1 ${x + w - hh / 2} ${hy + hh} H${hx + 20} Q${hx} ${hy + hh} ${hx} ${hy + hh + 10} V${y + h - 30} Q${hx} ${y + h} ${hx - 30} ${y + h} H${x + 30} Q${x} ${y + h} ${x} ${y + h - 30} V${y + 30} Q${x} ${y} ${x + 30} ${y} Z`;
  }

  function servingBoard(r, wood, id, x, y, w, h, opts = {}) {
    const d = opts.organic
      ? `M${x + 40} ${y + 20} C${x + w * 0.3} ${y - 18}, ${x + w * 0.7} ${y + 24}, ${x + w - 60} ${y + 10} C${x + w + 10} ${y + h * 0.3}, ${x + w - 10} ${y + h * 0.75}, ${x + w - 70} ${y + h - 6} C${x + w * 0.6} ${y + h + 18}, ${x + w * 0.3} ${y + h - 16}, ${x + 30} ${y + h - 10} C${x - 16} ${y + h * 0.7}, ${x - 8} ${y + h * 0.3}, ${x + 40} ${y + 20} Z`
      : paddlePath(x, y, w, h);
    const clip = `clip-${id}`;
    const hh = h * 0.28;
    const hole = opts.organic ? '' : `<circle cx="${x + w - hh / 2 - 4}" cy="${y + h / 2}" r="${hh * 0.2}" fill="#f3e2bf" stroke="${wood.grain}" stroke-opacity="0.4" stroke-width="2"/>`;
    return `
      <defs>${gradient(`g-${id}`, wood, 0.3)}<clipPath id="${clip}"><path d="${d}"/></clipPath></defs>
      <path d="${d}" transform="translate(0 12)" fill="${wood.dark}" filter="url(#shadow)"/>
      <g clip-path="url(#${clip})">
        <rect x="${x - 20}" y="${y - 30}" width="${w + 40}" height="${h + 60}" fill="url(#g-${id})"/>
        ${grainPaths(r, x - 10, y - 20, w + 20, h + 40, wood.grain, 18)}
        <rect x="${x - 20}" y="${y - 30}" width="${w + 40}" height="${h + 60}" fill="url(#sheen)"/>
      </g>
      <path d="${d}" fill="none" stroke="${wood.grain}" stroke-opacity="0.35" stroke-width="2"/>
      ${hole}`;
  }

  function oilBottle(x, y) {
    return `
      <g filter="url(#shadow)">
        <rect x="${x + 22}" y="${y - 38}" width="26" height="30" rx="4" fill="#6b4226"/>
        <rect x="${x + 16}" y="${y - 12}" width="38" height="16" rx="5" fill="#caa46a"/>
        <rect x="${x}" y="${y}" width="70" height="150" rx="16" fill="#c9a24a" fill-opacity="0.85"/>
        <rect x="${x + 6}" y="${y + 10}" width="12" height="120" rx="6" fill="#fff" fill-opacity="0.25"/>
        <rect x="${x + 8}" y="${y + 52}" width="54" height="56" rx="6" fill="#FAEDCD"/>
        <text x="${x + 35}" y="${y + 76}" font-family="Georgia,serif" font-size="11" text-anchor="middle" fill="#2C1A0E">BOARD</text>
        <text x="${x + 35}" y="${y + 92}" font-family="Georgia,serif" font-size="11" text-anchor="middle" fill="#2C1A0E">OIL</text>
      </g>`;
  }

  function butterTin(x, y) {
    return `
      <g filter="url(#shadow)">
        <ellipse cx="${x + 50}" cy="${y + 44}" rx="50" ry="16" fill="#8c8c8c"/>
        <rect x="${x}" y="${y + 14}" width="100" height="30" fill="#a9a9a9"/>
        <ellipse cx="${x + 50}" cy="${y + 14}" rx="50" ry="16" fill="#d4a373"/>
        <text x="${x + 50}" y="${y + 18}" font-family="Georgia,serif" font-size="11" text-anchor="middle" fill="#2C1A0E">BOARD BUTTER</text>
      </g>`;
  }

  /**
   * Generates a product illustration as an SVG data URI based on category and wood type.
   * Deterministic per product (same seed → same grain).
   */
  function boardImage(product, opts = {}) {
    const seedStr = `${product.id || ''}${product.name || ''}${product.wood || ''}`;
    const r = rng(hash(seedStr));
    const wood = woodFor(product.wood, 0);
    const wood2 = woodFor(product.wood, 1);
    const name = String(product.name || '').toLowerCase();
    const cat = product.category;
    let art = '';
    if (cat === 'gift-sets') {
      if (name.includes('essential') || name.includes('care')) {
        art += cuttingBoard(r, wood, 'b2', 90, 170, 460, 300, { groove: true });
        art += oilBottle(600, 250) + butterTin(565, 430);
      } else {
        art += servingBoard(r, wood, 'b1', 150, 120, 520, 210);
        art += cuttingBoard(r, wood2, 'b2', 110, 260, 420, 260, { groove: true });
        art += oilBottle(590, 330);
      }
    } else if (cat === 'serving-boards') {
      art += servingBoard(r, wood, 'b1', 80, 170, 650, 280, { organic: wood === WOODS.olive || name.includes('rustic') || name.includes('live edge') });
    } else {
      const small = name.includes('bar') || name.includes('mini');
      const endGrain = name.includes('end-grain') || name.includes('end grain') || name.includes('butcher');
      art += small
        ? cuttingBoard(r, wood, 'b1', 210, 170, 380, 270, { groove: false, rx: 30 })
        : cuttingBoard(r, wood, 'b1', 120, 130, 560, 350, { groove: !endGrain, endGrain, altWood: WOODS.maple, rx: endGrain ? 14 : 26 });
    }
    const bgR = rng(hash(`${seedStr}bg`));
    const tint = ['#f6e5c3', '#f3dfbb', '#f5e7ca', '#efdcb6'][Math.floor(bgR() * 4)];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FAEDCD"/><stop offset="1" stop-color="${tint}"/></linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.12"/></linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#2C1A0E" flood-opacity="0.32"/></filter>
      </defs>
      ${opts.transparent ? '' : '<rect width="800" height="600" fill="url(#bg)"/><rect width="800" height="600" fill="url(#glow)"/>'}
      ${art}
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const imageCache = new Map();
  function productImage(p, opts = {}) {
    if (p.image) return p.image;
    const key = `${p.id}|${p.name}|${p.wood}|${p.category}|${opts.transparent ? 't' : ''}`;
    if (!imageCache.has(key)) imageCache.set(key, boardImage(p, opts));
    return imageCache.get(key);
  }

  /** Cover artwork for stories without an uploaded image. */
  function storyImage(post) {
    const r = rng(hash(`${post.id}${post.title}`));
    const wood = [WOODS.walnut, WOODS.oak, WOODS.cherry, WOODS.ash, WOODS.acacia][Math.floor(r() * 5)];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
      <defs>${gradient('sg', wood, 0.6)}
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.15"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></linearGradient></defs>
      <rect width="800" height="450" fill="url(#sg)"/>
      ${grainPaths(r, 0, 0, 800, 450, wood.grain, 22)}
      <rect width="800" height="450" fill="url(#sheen)"/>
      <circle cx="${600 + r() * 120}" cy="${80 + r() * 80}" r="${60 + r() * 40}" fill="#FAEDCD" fill-opacity="0.08"/>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  /* ================= Seed data ================= */

  const CATEGORIES = [
    { id: 'cutting-boards', label: 'Cutting Boards' },
    { id: 'serving-boards', label: 'Serving Boards' },
    { id: 'gift-sets', label: 'Gift Sets' },
  ];

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  }

  function seedProducts() {
    const now = new Date().toISOString();
    return [
      {
        id: 'p_butchers_block', name: "The Butcher's Block", wood: 'Walnut & Maple (end-grain)', dimensions: '45 × 30 × 4 cm', price: 149,
        category: 'cutting-boards', stock: 8, featured: true, image: '',
        description: 'Our flagship end-grain chopping block, hand-assembled from 54 walnut and maple blocks in a checkerboard pattern. End-grain fibres part under the knife and close again, keeping your edges sharp and the surface looking new for decades. Finished with food-safe mineral oil and beeswax, with non-slip rubber feet.',
        createdAt: now,
      },
      {
        id: 'p_everyday_oak', name: 'Everyday Oak Chopper', wood: 'European Oak', dimensions: '40 × 25 × 2.5 cm', price: 69,
        category: 'cutting-boards', stock: 15, featured: false, image: '',
        description: 'A dependable edge-grain board in solid European oak with a deep juice groove on one side and a flat serving face on the other. Heavy enough to stay put, light enough to lift to the sink.',
        createdAt: now,
      },
      {
        id: 'p_ash_prep', name: 'Ash Prep Board with Juice Groove', wood: 'Ash', dimensions: '38 × 26 × 2 cm', price: 59,
        category: 'cutting-boards', stock: 12, featured: false, image: '',
        description: 'Pale, tight-grained ash that brightens any countertop. The routed groove catches juices when carving roasts or slicing tomatoes. Rounded edges and finger-grip bevel for easy lifting.',
        createdAt: now,
      },
      {
        id: 'p_maple_bar', name: 'Maple Bar Board', wood: 'Hard Maple', dimensions: '25 × 18 × 2 cm', price: 39,
        category: 'cutting-boards', stock: 20, featured: false, image: '',
        description: 'The small board you will reach for every day — citrus for cocktails, garlic, herbs and a quick cheese plate. Dense hard maple resists knife scoring and odours.',
        createdAt: now,
      },
      {
        id: 'p_walnut_paddle', name: 'Walnut Charcuterie Paddle', wood: 'American Walnut', dimensions: '55 × 22 × 2 cm', price: 89,
        category: 'serving-boards', stock: 10, featured: true, image: '',
        description: 'A long serving paddle with a sculpted handle and hanging hole, designed to carry charcuterie, cheeses and bread straight to the table. Deep chocolate walnut tones that only grow richer with oiling.',
        createdAt: now,
      },
      {
        id: 'p_olive_rustic', name: 'Olive Wood Rustic Server', wood: 'Olive', dimensions: '40 × 18 × 2 cm', price: 79,
        category: 'serving-boards', stock: 6, featured: false, image: '',
        description: 'Each piece follows the natural outline of the olive log, so no two are alike. Swirling, marbled grain makes it a centrepiece for antipasti, olives and fresh bread.',
        createdAt: now,
      },
      {
        id: 'p_cherry_cheese', name: 'Cherry Cheese Board', wood: 'Cherry', dimensions: '35 × 25 × 1.8 cm', price: 65,
        category: 'serving-boards', stock: 9, featured: false, image: '',
        description: 'Warm cherry wood with a satin finish and an integrated handle. The perfect size for a cheese course for four. Cherry naturally deepens to a rich reddish-amber over time.',
        createdAt: now,
      },
      {
        id: 'p_hosts_gift', name: "The Host's Gift Set", wood: 'Walnut & Oak', dimensions: 'Paddle 55 × 22 cm · Board 40 × 25 cm', price: 179,
        category: 'gift-sets', stock: 5, featured: true, image: '',
        description: 'Everything a generous host needs: our Walnut Charcuterie Paddle, the Everyday Oak Chopper and a 100 ml bottle of Chopaholic board oil, packed in a kraft gift box with a handwritten card.',
        createdAt: now,
      },
      {
        id: 'p_care_set', name: 'Care Essentials Set', wood: 'Oak & Beech', dimensions: 'Board 38 × 26 cm · Oil 100 ml · Butter 60 g', price: 95,
        category: 'gift-sets', stock: 11, featured: false, image: '',
        description: 'An oak prep board together with our food-safe mineral board oil and beeswax board butter — the complete kit to start (and keep) a wooden board in perfect condition.',
        createdAt: now,
      },
    ];
  }

  function seedPosts() {
    return [
      {
        id: 'post_oiling', title: 'How to Properly Oil Your Wooden Board', category: 'Care Guide', author: 'Bozhidar Zafirov',
        date: daysAgo(6), image: '',
        excerpt: 'Five minutes a month is all it takes to keep a wooden board beautiful, hygienic and crack-free for decades.',
        content: `A well-oiled board repels water, resists stains and will not warp or crack. Dry, pale patches are your board asking for a drink.

## What you need
- Food-safe mineral oil (or our Chopaholic board oil)
- A clean, lint-free cloth
- Optional: beeswax board butter for a protective top coat

## Step by step
1. Wash the board with warm water and mild soap, then dry it upright for a few hours.
2. Pour a generous amount of oil onto the surface and spread it with the cloth, following the grain.
3. Do not forget the edges and the underside — uneven oiling is a common cause of warping.
4. Leave the oil to soak in for at least 4 hours, ideally overnight.
5. Wipe off any excess and buff with a thin layer of board butter.

## How often?
Oil a new board once a day for the first week, then once a month — or whenever water stops beading on the surface.

**Never** use olive, sunflower or other cooking oils: they turn rancid and leave a sticky, smelly film.`,
      },
      {
        id: 'post_walnut_oak', title: 'Walnut vs. Oak: Which Wood is Best?', category: 'Wood Guide', author: 'Bozhidar Zafirov',
        date: daysAgo(14), image: '',
        excerpt: 'Two of our most loved woods compared — hardness, knife friendliness, looks and the tasks each one excels at.',
        content: `Both walnut and oak make superb boards, but they have very different personalities.

## Walnut
- Hardness (Janka): about 4,500 N — firm but gentle on knife edges
- Deep chocolate colour that hides stains well
- Closed grain that absorbs little water
- Best for: everyday chopping, serving and statement pieces

## Oak
- Hardness (Janka): about 5,400 N — very durable
- Light golden tones with a distinctive ray-fleck pattern
- More open grain, so regular oiling matters
- Best for: heavy-duty prep, bread and rustic serving

## Our verdict
If you want one board that does everything and looks stunning doing it, choose walnut. If you love a bright, classic kitchen look and do a lot of heavy prep, oak is a fantastic, great-value choice.`,
      },
      {
        id: 'post_end_grain', title: 'End Grain vs. Edge Grain: What Is the Difference?', category: 'Craftsmanship', author: 'Bozhidar Zafirov',
        date: daysAgo(27), image: '',
        excerpt: 'Why our Butcher\'s Block takes three times longer to make — and why your knives will thank you for it.',
        content: `The way wood fibres are oriented changes how a board behaves under the knife.

## Edge grain
The long sides of the planks face up. Edge-grain boards are stable, lighter and more affordable. The knife cuts across the fibres, so they show marks a little sooner.

## End grain
Short blocks are glued so that the ends of the fibres face up, like the bristles of a brush. The knife slips between the fibres instead of cutting them, which keeps your edge sharp and lets small cuts "self-heal".

## Which to choose?
End grain is the professional choice for heavy daily chopping. Edge grain is perfect for lighter prep, serving and anyone who wants a thinner, lighter board.`,
      },
      {
        id: 'post_mistakes', title: '5 Mistakes That Ruin Wooden Boards', category: 'Care Guide', author: 'Bozhidar Zafirov',
        date: daysAgo(41), image: '',
        excerpt: 'Avoid these common habits and your board will easily outlive your kitchen.',
        content: `Wooden boards are remarkably tough, but a few habits can shorten their life dramatically.

1. Putting them in the dishwasher — heat and prolonged soaking cause cracks and warping.
2. Leaving them to soak in the sink — wood swells unevenly and splits along the glue lines.
3. Drying them flat — always stand a wet board on its edge so air reaches both sides.
4. Using cooking oils — they go rancid; stick to food-safe mineral oil and beeswax.
5. Skipping maintenance — a monthly oiling takes five minutes and prevents most problems.

## Bonus tip
To remove odours from garlic or fish, scrub the board with coarse salt and half a lemon, rinse and dry upright.`,
      },
    ];
  }

  function defaultSettings() {
    return {
      vatRate: 20,
      announcement: {
        enabled: true,
        text: 'Autumn Harvest Sale — use code CHOP10 for 10% off every board. Free shipping on orders over €120.',
        linkText: 'Shop now',
        linkTarget: '#shop',
      },
      hero: {
        eyebrow: 'Handcrafted in Bulgaria',
        title: 'Craftsmanship Met in Wood',
        subtitle: 'Heirloom cutting and serving boards, shaped by hand from walnut, oak, ash and olive — finished with food-safe oils and made to last a lifetime.',
        ctaText: 'Explore Boards',
      },
      promo: {
        enabled: true,
        badge: 'Limited edition',
        title: "The Host's Gift Set is back",
        text: 'A walnut charcuterie paddle, an oak chopping board and our signature board oil — gift-boxed with a handwritten card. Only a few sets left this season.',
        ctaText: 'View the gift set',
        productId: 'p_hosts_gift',
      },
      shipping: {
        courierOffice: 4.9,
        address: 6.9,
        freeThreshold: 120,
        dispatchDays: '2–5 working days',
      },
      codes: [
        { code: 'CHOP10', percent: 10, active: true },
        { code: 'WELCOME5', percent: 5, active: true },
      ],
      merchant: {
        name: 'Bozhidar Zafirov',
        address: '3 Yazovirska Str., Bulgaria',
        phone: '+359 87 716 8204',
        email: 'bozhidarzafirov@smartmenukj.com',
        companyId: '',
        vatNumber: '',
      },
    };
  }

  Object.assign(CH, { Store, CATEGORIES, productImage, storyImage, defaultSettings });
})();
