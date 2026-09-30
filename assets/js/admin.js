/* Chopaholic — Admin panel: dashboard, orders, products (CRUD), stories (CRUD), promotions, inbox, activity log, settings. */
(function () {
  'use strict';

  const CH = window.CH;
  const { $, $$, esc, fmtMoney, fmtDate, fmtDateTime, round2, Store, toast, openModal, closeModal, confirmDialog } = CH;

  /*
   * NOTE: this is a client-side only store. The password check below keeps casual visitors out of the
   * admin UI, but anything in the browser can be inspected. When migrating to Firebase, replace
   * login() with Firebase Authentication and protect writes with Firestore security rules.
   */
  const ADMIN_PASSWORD = 'admin123';
  const SESSION_KEY = 'chopaholic_admin';
  const STATUSES = ['New', 'Processing', 'Dispatched'];

  const SECTIONS = [
    { id: 'dashboard', label: 'Dashboard', icon: '▦', subtitle: 'Overview of your store' },
    { id: 'orders', label: 'Orders', icon: '🧾', subtitle: 'Customer orders — updates live as they come in' },
    { id: 'products', label: 'Products', icon: '🪵', subtitle: 'Add, edit and remove boards' },
    { id: 'stories', label: 'Stories / Blog', icon: '📖', subtitle: 'Care guides and news articles' },
    { id: 'promotions', label: 'Ads & Promotions', icon: '📣', subtitle: 'Announcement bar, hero, homepage promotion, discount codes & shipping' },
    { id: 'inbox', label: 'Inbox', icon: '✉️', subtitle: 'Contact messages and withdrawal requests' },
    { id: 'logs', label: 'Activity log', icon: '🕘', subtitle: 'Every change made in the store' },
    { id: 'settings', label: 'Settings & Data', icon: '⚙️', subtitle: 'Merchant details, VAT, backups' },
  ];

  const ui = { section: 'dashboard', orderFilter: 'all', orderSearch: '', productSearch: '' };

  const isLoggedIn = () => sessionStorage.getItem(SESSION_KEY) === '1';

  function login(password) {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      Store.log('Admin login', 'Successful login to admin panel');
      return true;
    }
    Store.log('Admin login failed', 'Incorrect password entered');
    return false;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    Store.log('Admin logout', '');
    close();
    toast('You have been logged out.', 'info');
  }

  function open(section) {
    if (!isLoggedIn()) return;
    if (section) ui.section = section;
    const panel = $('#admin-panel');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('admin-open', 'no-scroll');
    render();
  }

  function close() {
    const panel = $('#admin-panel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('admin-open');
    if (!document.querySelector('.modal-wrap') && !document.body.classList.contains('drawer-open')) document.body.classList.remove('no-scroll');
  }

  const isOpen = () => $('#admin-panel').classList.contains('open');
  const categoryLabel = (id) => (CH.CATEGORIES.find((c) => c.id === id) || { label: id }).label;

  /* ====================================================================
   * Shell
   * ==================================================================== */
  function renderNav() {
    const newOrders = Store.all('orders').filter((o) => o.status === 'New').length;
    const unread = Store.all('messages').filter((m) => !m.read).length + Store.all('withdrawals').filter((w) => w.status === 'Received').length;
    $('#admin-nav').innerHTML = SECTIONS.map((s) => {
      const count = s.id === 'orders' ? newOrders : s.id === 'inbox' ? unread : 0;
      return `<button type="button" class="admin-nav-btn ${ui.section === s.id ? 'active' : ''}" data-admin-section="${s.id}" ${ui.section === s.id ? 'aria-current="page"' : ''}>
        <span aria-hidden="true">${s.icon}</span><span>${s.label}</span>${count ? `<span class="count">${count}</span>` : ''}
      </button>`;
    }).join('');
  }

  function render() {
    if (!isOpen()) return;
    renderNav();
    const meta = SECTIONS.find((s) => s.id === ui.section) || SECTIONS[0];
    $('#admin-title').textContent = meta.label;
    $('#admin-subtitle').textContent = `${meta.subtitle} · ${fmtDate(new Date())}`;
    const content = $('#admin-content');
    const renderers = { dashboard, orders, products, stories, promotions, inbox, logs, settings };
    content.innerHTML = renderers[meta.id]();
    bindSection(meta.id, content);
  }

  /* ====================================================================
   * Dashboard
   * ==================================================================== */
  function dashboard() {
    const orders = Store.all('orders');
    const products = Store.all('products');
    const revenue = round2(orders.reduce((sum, o) => sum + o.total, 0));
    const today = fmtDate(new Date());
    const todayOrders = orders.filter((o) => fmtDate(o.createdAt) === today);
    const lowStock = products.filter((p) => Number(p.stock) <= 3).sort((a, b) => a.stock - b.stock);
    const views = Store.getDoc('analytics', {});
    const popular = products.filter((p) => views[p.id]).sort((a, b) => views[b.id] - views[a.id]).slice(0, 5);
    const unread = Store.all('messages').filter((m) => !m.read).length;
    const openWithdrawals = Store.all('withdrawals').filter((w) => w.status === 'Received').length;
    const byStatus = STATUSES.map((s) => ({ s, n: orders.filter((o) => o.status === s).length }));

    const stat = (label, value, hint) => `
      <div class="admin-card stat-card p-5">
        <p class="text-xs uppercase tracking-widest text-amberwood font-semibold">${label}</p>
        <p class="font-display text-3xl font-bold mt-2">${value}</p>
        <p class="text-xs text-walnut/55 mt-1">${hint}</p>
      </div>`;

    return `
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
        ${stat('Revenue', fmtMoney(revenue), `${orders.length} orders in total (incl. VAT)`)}
        ${stat('Orders today', todayOrders.length, `${fmtMoney(todayOrders.reduce((s, o) => s + o.total, 0))} on ${today}`)}
        ${stat('Awaiting action', byStatus[0].n, `${byStatus[1].n} processing · ${byStatus[2].n} dispatched`)}
        ${stat('Inbox', unread + openWithdrawals, `${unread} unread messages · ${openWithdrawals} withdrawals`)}
      </div>
      <div class="grid lg:grid-cols-3 gap-5 mt-6">
        <div class="admin-card p-5 lg:col-span-2">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-display text-xl font-semibold">Latest orders</h3>
            <button type="button" class="btn btn-ghost btn-sm" data-admin-section="orders">All orders</button>
          </div>
          ${orders.length ? `<div class="overflow-x-auto scroll-thin"><table class="admin-table">
            <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>${orders.slice(0, 6).map((o) => `
              <tr class="cursor-pointer" data-view-order="${esc(o.id)}">
                <td class="font-mono font-semibold">${esc(o.id)}</td>
                <td>${fmtDateTime(o.createdAt)}</td>
                <td>${esc(o.customer.name)}</td>
                <td class="font-semibold">${fmtMoney(o.total)}</td>
                <td><span class="status-pill status-${esc(o.status)}">${esc(o.status)}</span>${o.withdrawal ? ' <span class="status-pill status-Withdrawn">Withdrawal</span>' : ''}</td>
              </tr>`).join('')}</tbody></table></div>` : emptyState('No orders yet', 'Orders placed in the store appear here instantly.')}
        </div>
        <div class="space-y-5">
          <div class="admin-card p-5">
            <h3 class="font-display text-xl font-semibold mb-3">Low stock</h3>
            ${lowStock.length ? `<ul class="space-y-2 text-sm">${lowStock.map((p) => `
              <li class="flex justify-between gap-2 items-center">
                <button type="button" class="text-left hover:text-amberwood" data-edit-product="${esc(p.id)}">${esc(p.name)}</button>
                <span class="status-pill ${Number(p.stock) === 0 ? 'status-Cancelled' : 'status-New'}">${Number(p.stock) === 0 ? 'Sold out' : `${p.stock} left`}</span>
              </li>`).join('')}</ul>` : '<p class="text-sm text-walnut/60">All products are well stocked.</p>'}
          </div>
          <div class="admin-card p-5">
            <h3 class="font-display text-xl font-semibold mb-1">Most viewed</h3>
            <p class="text-xs text-walnut/50 mb-3">Quick-view opens on this device (only with statistics consent).</p>
            ${popular.length ? `<ol class="space-y-2 text-sm list-decimal pl-5">${popular.map((p) => `<li><span class="flex justify-between gap-2"><span>${esc(p.name)}</span><span class="font-semibold">${views[p.id]}</span></span></li>`).join('')}</ol>` : '<p class="text-sm text-walnut/60">No statistics recorded yet.</p>'}
          </div>
        </div>
      </div>`;
  }

  function emptyState(title, text) {
    return `<div class="text-center py-10"><p class="text-4xl" aria-hidden="true">🪵</p><p class="font-display text-xl mt-2">${esc(title)}</p><p class="text-sm text-walnut/60 mt-1">${esc(text)}</p></div>`;
  }

  /* ====================================================================
   * Orders
   * ==================================================================== */
  function filteredOrders() {
    const q = ui.orderSearch.trim().toLowerCase();
    return Store.all('orders').filter((o) => {
      if (ui.orderFilter !== 'all' && o.status !== ui.orderFilter) return false;
      if (!q) return true;
      return [o.id, o.customer.name, o.customer.email, o.customer.phone, o.delivery.city].join(' ').toLowerCase().includes(q);
    });
  }

  function orders() {
    const all = Store.all('orders');
    const list = filteredOrders();
    return `
      <div class="admin-card p-4 sm:p-5">
        <div class="flex flex-col md:flex-row gap-3 md:items-center justify-between mb-4">
          <div class="flex gap-1 overflow-x-auto scroll-thin">
            ${['all', ...STATUSES].map((s) => {
              const n = s === 'all' ? all.length : all.filter((o) => o.status === s).length;
              return `<button type="button" class="tab-btn ${ui.orderFilter === s ? 'active' : ''}" data-order-filter="${s}">${s === 'all' ? 'All' : s} (${n})</button>`;
            }).join('')}
          </div>
          <div class="flex gap-2">
            <input type="search" class="field !py-2" placeholder="Search ID, name, email…" value="${esc(ui.orderSearch)}" data-order-search aria-label="Search orders">
            <button type="button" class="btn btn-ghost btn-sm" data-export-orders ${all.length ? '' : 'disabled'}>Export CSV</button>
          </div>
        </div>
        ${list.length ? `<div class="overflow-x-auto scroll-thin"><table class="admin-table">
          <thead><tr><th>Order ID</th><th>Date</th><th>Customer</th><th>Delivery</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>${list.map((o) => `
            <tr>
              <td class="font-mono font-semibold whitespace-nowrap">${esc(o.id)}${o.withdrawal ? '<br><span class="status-pill status-Withdrawn mt-1">Withdrawal</span>' : ''}</td>
              <td class="whitespace-nowrap">${fmtDateTime(o.createdAt)}</td>
              <td><p class="font-medium">${esc(o.customer.name)}</p><p class="text-xs text-walnut/60">${esc(o.customer.phone)}<br>${esc(o.customer.email)}</p></td>
              <td class="text-xs"><p>${esc(o.delivery.methodLabel)}</p><p class="text-walnut/60">${esc(o.delivery.city)}</p></td>
              <td class="text-xs">${o.items.map((i) => `${i.qty} × ${esc(i.name)}`).join('<br>')}</td>
              <td class="font-semibold whitespace-nowrap">${fmtMoney(o.total)}</td>
              <td>
                <label class="sr-only" for="st-${esc(o.id)}">Status of ${esc(o.id)}</label>
                <select id="st-${esc(o.id)}" class="field !py-1.5 !text-sm !w-36" data-order-status="${esc(o.id)}">
                  ${STATUSES.map((s) => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </td>
              <td class="whitespace-nowrap"><button type="button" class="btn btn-ghost btn-sm" data-view-order="${esc(o.id)}">Details</button></td>
            </tr>`).join('')}</tbody></table></div>`
          : emptyState(all.length ? 'No matching orders' : 'No orders yet', all.length ? 'Try a different filter or search.' : 'Orders placed in the store appear here in real time.')}
      </div>`;
  }

  function setOrderStatus(id, status) {
    const o = Store.get('orders', id);
    if (!o || !STATUSES.includes(status) || o.status === status) return;
    const now = new Date().toISOString();
    o.history = [...(o.history || []), { at: now, status, note: `Status changed from ${o.status} to ${status}` }];
    o.status = status;
    o.updatedAt = now;
    Store.upsert('orders', o);
    Store.log('Order status changed', `${id} → ${status}`);
    toast(`Order ${id} marked as ${status}`);
  }

  function viewOrder(id) {
    const o = Store.get('orders', id);
    if (!o) return;
    const body = openModal(`
      <div class="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <p class="font-mono text-lg font-bold">${esc(o.id)}</p>
          <p class="text-xs text-walnut/60">Placed on ${fmtDateTime(o.createdAt)} · Terms accepted ${fmtDateTime(o.termsAcceptedAt)}</p>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm font-semibold" for="od-status">Status</label>
          <select id="od-status" class="field !py-2 !w-40">${STATUSES.map((s) => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      ${o.withdrawal ? `<div class="legal-callout text-sm"><strong>Withdrawal received</strong> on ${fmtDateTime(o.withdrawal.at)} (${esc(o.withdrawal.id)}): ${esc(o.withdrawal.items)}. Refund due within 14 days of this date.</div>` : ''}
      <div class="grid md:grid-cols-2 gap-4 mt-4">
        <div class="glass-card p-4 text-sm">
          <p class="font-semibold mb-2">Customer</p>
          <p>${esc(o.customer.name)}</p>
          <p><a class="underline" href="tel:${esc(o.customer.phone.replace(/\s/g, ''))}">${esc(o.customer.phone)}</a></p>
          <p><a class="underline break-all" href="mailto:${esc(o.customer.email)}?subject=${encodeURIComponent(`Your Chopaholic order ${o.id}`)}">${esc(o.customer.email)}</a></p>
        </div>
        <div class="glass-card p-4 text-sm">
          <p class="font-semibold mb-2">Delivery & payment</p>
          <p>${esc(o.delivery.methodLabel)}</p>
          <p>${esc(o.delivery.address)}</p>
          <p>${esc(o.delivery.postcode ? `${o.delivery.postcode} ` : '')}${esc(o.delivery.city)}</p>
          <p class="mt-2">${esc(o.payment)}</p>
        </div>
      </div>
      ${o.notes ? `<div class="glass-card p-4 text-sm mt-4"><p class="font-semibold mb-1">Customer notes</p><p class="whitespace-pre-line">${esc(o.notes)}</p></div>` : ''}
      <div class="overflow-x-auto scroll-thin mt-4"><table class="admin-table">
        <thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
        <tbody>
          ${o.items.map((i) => `<tr><td><p class="font-medium">${esc(i.name)}</p><p class="text-xs text-walnut/60">${esc(i.wood)} · ${esc(i.dimensions)}</p></td><td>${i.qty}</td><td>${fmtMoney(i.price)}</td><td class="font-semibold">${fmtMoney(i.lineTotal)}</td></tr>`).join('')}
          <tr><td colspan="3">Subtotal</td><td>${fmtMoney(o.subtotal)}</td></tr>
          ${o.discount ? `<tr><td colspan="3">Discount ${esc(o.discountCode)} (−${o.discountPercent}%)</td><td>−${fmtMoney(o.discount)}</td></tr>` : ''}
          <tr><td colspan="3">Shipping</td><td>${o.shipping ? fmtMoney(o.shipping) : 'Free'}</td></tr>
          <tr><td colspan="3" class="font-bold">Total (COD)</td><td class="font-bold">${fmtMoney(o.total)}</td></tr>
          <tr><td colspan="3" class="text-xs text-walnut/60">incl. VAT ${o.vatRate}%</td><td class="text-xs text-walnut/60">${fmtMoney(o.vat)}</td></tr>
        </tbody></table></div>
      <div class="mt-4">
        <p class="font-semibold text-sm mb-2">History</p>
        <ul class="text-xs space-y-1 text-walnut/75">${(o.history || []).map((h) => `<li><span class="font-mono">${fmtDateTime(h.at)}</span> — ${esc(h.note || h.status)}</li>`).join('')}</ul>
      </div>
      <div class="flex flex-wrap gap-2 justify-between mt-6">
        <button type="button" class="btn btn-danger btn-sm" data-od-delete>Delete order</button>
        <div class="flex gap-2">
          <button type="button" class="btn btn-ghost btn-sm" data-od-print>Print receipt</button>
          <button type="button" class="btn btn-primary btn-sm" data-close-modal>Close</button>
        </div>
      </div>`, { title: 'Order details', size: 'lg' });

    $('#od-status', body).addEventListener('change', (e) => setOrderStatus(id, e.target.value));
    body.addEventListener('click', async (e) => {
      if (e.target.closest('[data-od-print]')) {
        CH.printDocument(`Order ${o.id}`, CH.Shop.orderReceiptHtml(Store.get('orders', id) || o));
      }
      if (e.target.closest('[data-od-delete]')) {
        const ok = await confirmDialog(`Delete order ${id}? Stock will not be restored automatically. Remember that invoicing records may need to be kept by law.`, { title: 'Delete order', okText: 'Delete', danger: true });
        if (!ok) return;
        Store.remove('orders', id);
        Store.log('Order deleted', id);
        closeModal(body);
        toast(`Order ${id} deleted`, 'info');
      }
    });
  }

  function exportOrdersCsv() {
    const rows = [['Order ID', 'Date', 'Status', 'Customer', 'Phone', 'Email', 'Delivery', 'City', 'Postcode', 'Address', 'Items', 'Subtotal', 'Discount', 'Shipping', 'Total', 'VAT', 'Notes', 'Withdrawal']];
    Store.all('orders').forEach((o) => rows.push([
      o.id, fmtDateTime(o.createdAt), o.status, o.customer.name, o.customer.phone, o.customer.email, o.delivery.methodLabel,
      o.delivery.city, o.delivery.postcode, o.delivery.address, o.items.map((i) => `${i.qty} x ${i.name}`).join('; '),
      o.subtotal.toFixed(2), o.discount.toFixed(2), o.shipping.toFixed(2), o.total.toFixed(2), o.vat.toFixed(2), o.notes,
      o.withdrawal ? `${o.withdrawal.id} (${fmtDate(o.withdrawal.at)})` : '',
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    CH.downloadFile(`chopaholic-orders-${fmtDate(new Date()).replace(/\//g, '-')}.csv`, `﻿${csv}`, 'text/csv');
    Store.log('Orders exported', `${rows.length - 1} orders to CSV`);
  }

  /* ====================================================================
   * Products
   * ==================================================================== */
  function products() {
    const q = ui.productSearch.trim().toLowerCase();
    const list = Store.all('products').filter((p) => !q || [p.name, p.wood, categoryLabel(p.category)].join(' ').toLowerCase().includes(q));
    return `
      <div class="flex flex-col sm:flex-row gap-3 justify-between mb-5">
        <input type="search" class="field sm:max-w-xs" placeholder="Search products…" value="${esc(ui.productSearch)}" data-product-search aria-label="Search products">
        <button type="button" class="btn btn-primary" data-new-product>+ Add product</button>
      </div>
      ${list.length ? `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${list.map((p) => `
        <div class="admin-card overflow-hidden flex flex-col">
          <img src="${esc(CH.productImage(p))}" alt="" class="w-full aspect-[4/3] object-cover">
          <div class="p-4 flex flex-col flex-1">
            <div class="flex items-start justify-between gap-2">
              <h3 class="font-display text-lg font-semibold leading-snug">${esc(p.name)}</h3>
              <p class="font-bold whitespace-nowrap">${fmtMoney(p.price)}</p>
            </div>
            <p class="text-xs text-walnut/60 mt-1">${esc(p.wood)} · ${esc(p.dimensions)}</p>
            <div class="flex flex-wrap gap-2 mt-2">
              <span class="badge badge-wood">${esc(categoryLabel(p.category))}</span>
              <span class="badge ${Number(p.stock) === 0 ? 'badge-out' : Number(p.stock) <= 3 ? 'badge-warn' : 'badge-wood'}">Stock: ${Number(p.stock)}</span>
              ${p.featured ? '<span class="badge badge-dark">Bestseller</span>' : ''}
            </div>
            <div class="flex gap-2 mt-auto pt-4">
              <button type="button" class="btn btn-ghost btn-sm flex-1" data-edit-product="${esc(p.id)}">Edit</button>
              <button type="button" class="btn btn-danger btn-sm" data-delete-product="${esc(p.id)}" aria-label="Delete ${esc(p.name)}">Delete</button>
            </div>
          </div>
        </div>`).join('')}</div>` : `<div class="admin-card">${emptyState('No products', q ? 'No products match your search.' : 'Add your first board to start selling.')}</div>`}`;
  }

  function imageFieldHtml(prefix, current) {
    return `
      <div>
        <span class="field-label">Image</span>
        <div class="flex gap-4 items-start">
          <img data-${prefix}-preview src="${esc(current)}" alt="Image preview" class="w-28 h-24 rounded-xl object-cover ring-1 ring-accent/50 flex-shrink-0 bg-cream">
          <div class="flex-1 space-y-2">
            <input name="imageUrl" class="field !py-2 !text-sm" placeholder="https://… image URL (optional)" data-${prefix}-url maxlength="2000">
            <div class="flex flex-wrap gap-2">
              <label class="btn btn-ghost btn-sm cursor-pointer">Upload image<input type="file" accept="image/*" class="sr-only" data-${prefix}-file></label>
              <button type="button" class="btn btn-ghost btn-sm" data-${prefix}-clear>Use generated artwork</button>
            </div>
            <p class="text-[11px] text-walnut/55">Uploads are resized and stored as Base64. Leave empty to use Chopaholic's generated board artwork.</p>
          </div>
        </div>
      </div>`;
  }

  function bindImageField(root, prefix, state, fallback) {
    const preview = $(`[data-${prefix}-preview]`, root);
    const urlInput = $(`[data-${prefix}-url]`, root);
    const refresh = () => { preview.src = state.image || fallback(); };
    if (state.image && !state.image.startsWith('data:')) urlInput.value = state.image;
    urlInput.addEventListener('change', () => {
      const v = urlInput.value.trim();
      if (v && !/^https?:\/\//i.test(v)) {
        toast('Image URL must start with http:// or https://', 'error');
        return;
      }
      state.image = v;
      refresh();
    });
    $(`[data-${prefix}-file]`, root).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        state.image = await CH.readImageFile(file);
        urlInput.value = '';
        refresh();
        toast('Image ready — save to apply.', 'info');
      } catch (err) {
        toast(err.message, 'error');
      }
      e.target.value = '';
    });
    $(`[data-${prefix}-clear]`, root).addEventListener('click', () => {
      state.image = '';
      urlInput.value = '';
      refresh();
    });
    preview.addEventListener('error', () => {
      if (state.image) {
        toast('That image could not be loaded — check the URL.', 'error');
        state.image = '';
        urlInput.value = '';
        refresh();
      }
    });
  }

  function editProduct(id) {
    const existing = id ? Store.get('products', id) : null;
    const p = existing || { id: CH.uid('p'), name: '', wood: '', dimensions: '', price: '', category: 'cutting-boards', stock: 10, featured: false, description: '', image: '', createdAt: new Date().toISOString() };
    const draft = { image: p.image || '' };
    const body = openModal(`
      <form data-product-form class="space-y-4" novalidate>
        <div class="grid sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2">
            <label class="field-label" for="pf-name">Product name *</label>
            <input id="pf-name" name="name" class="field" value="${esc(p.name)}" maxlength="80" required>
            <p class="field-error" data-error-for="name"></p>
          </div>
          <div>
            <label class="field-label" for="pf-wood">Wood type *</label>
            <input id="pf-wood" name="wood" class="field" value="${esc(p.wood)}" list="wood-list" maxlength="60" required>
            <datalist id="wood-list"><option>Walnut</option><option>American Walnut</option><option>European Oak</option><option>Ash</option><option>Cherry</option><option>Hard Maple</option><option>Olive</option><option>Acacia</option><option>Beech</option></datalist>
            <p class="field-error" data-error-for="wood"></p>
          </div>
          <div>
            <label class="field-label" for="pf-dim">Dimensions *</label>
            <input id="pf-dim" name="dimensions" class="field" value="${esc(p.dimensions)}" placeholder="40 × 25 × 2.5 cm" maxlength="80" required>
            <p class="field-error" data-error-for="dimensions"></p>
          </div>
          <div>
            <label class="field-label" for="pf-price">Price (EUR, incl. VAT) *</label>
            <input id="pf-price" name="price" type="number" step="0.01" min="0.01" class="field" value="${esc(p.price)}" required>
            <p class="field-error" data-error-for="price"></p>
          </div>
          <div>
            <label class="field-label" for="pf-cat">Category *</label>
            <select id="pf-cat" name="category" class="field">${CH.CATEGORIES.map((c) => `<option value="${c.id}" ${p.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}</select>
          </div>
          <div>
            <label class="field-label" for="pf-stock">Stock quantity *</label>
            <input id="pf-stock" name="stock" type="number" min="0" step="1" class="field" value="${esc(p.stock)}" required>
            <p class="field-error" data-error-for="stock"></p>
          </div>
          <label class="flex items-center gap-3 self-end pb-3">
            <input type="checkbox" name="featured" class="check" ${p.featured ? 'checked' : ''}>
            <span class="text-sm font-semibold">Mark as bestseller (featured)</span>
          </label>
          <div class="sm:col-span-2">
            <label class="field-label" for="pf-desc">Description *</label>
            <textarea id="pf-desc" name="description" rows="4" class="field" maxlength="1500" required>${esc(p.description)}</textarea>
            <p class="field-error" data-error-for="description"></p>
          </div>
          <div class="sm:col-span-2">${imageFieldHtml('pimg', CH.productImage(p))}</div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Add product'}</button>
        </div>
      </form>`, { title: existing ? `Edit: ${p.name}` : 'Add product', size: 'lg' });

    const form = $('[data-product-form]', body);
    const current = () => ({ ...p, name: form.elements.name.value, wood: form.elements.wood.value, category: form.elements.category.value, image: '' });
    bindImageField(body, 'pimg', draft, () => CH.productImage(current()));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (n) => String(form.elements[n].value || '').trim();
      const errors = {};
      if (v('name').length < 2) errors.name = 'Name is required.';
      if (v('wood').length < 2) errors.wood = 'Wood type is required.';
      if (v('dimensions').length < 2) errors.dimensions = 'Dimensions are required.';
      const price = Number(v('price'));
      if (!(price > 0)) errors.price = 'Enter a price greater than 0.';
      const stock = Number(v('stock'));
      if (!Number.isInteger(stock) || stock < 0) errors.stock = 'Enter a whole number (0 or more).';
      if (v('description').length < 10) errors.description = 'Please write at least 10 characters.';
      Object.keys({ name: 1, wood: 1, dimensions: 1, price: 1, stock: 1, description: 1 }).forEach((n) => {
        const err = $(`[data-error-for="${n}"]`, form);
        if (err) err.textContent = errors[n] || '';
        form.elements[n].classList.toggle('invalid', !!errors[n]);
      });
      if (Object.keys(errors).length) return;
      const saved = {
        ...p,
        name: v('name'), wood: v('wood'), dimensions: v('dimensions'), price: round2(price), category: v('category'),
        stock, featured: form.elements.featured.checked, description: v('description'), image: draft.image,
        updatedAt: new Date().toISOString(),
      };
      if (!Store.upsert('products', saved)) return;
      Store.log(existing ? 'Product updated' : 'Product added', `${saved.name} · ${fmtMoney(saved.price)} · stock ${saved.stock}`);
      closeModal(body);
      toast(existing ? 'Product updated' : 'Product added to the shop');
    });
  }

  async function deleteProduct(id) {
    const p = Store.get('products', id);
    if (!p) return;
    const ok = await confirmDialog(`Delete "${p.name}" from the shop? It will also be removed from customers' carts. Existing orders keep their copy of the product details.`, { title: 'Delete product', okText: 'Delete', danger: true });
    if (!ok) return;
    Store.remove('products', id);
    Store.log('Product deleted', p.name);
    toast(`"${p.name}" deleted`, 'info');
  }

  /* ====================================================================
   * Stories
   * ==================================================================== */
  function stories() {
    const list = Store.all('posts').slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    return `
      <div class="flex justify-end mb-5"><button type="button" class="btn btn-primary" data-new-post>+ New story</button></div>
      ${list.length ? `<div class="space-y-3">${list.map((p) => `
        <div class="admin-card p-3 sm:p-4 flex gap-4 items-center">
          <img src="${esc(p.image || CH.storyImage(p))}" alt="" class="w-24 h-16 sm:w-32 sm:h-20 rounded-xl object-cover flex-shrink-0">
          <div class="flex-1 min-w-0">
            <p class="text-xs text-walnut/55"><span class="badge badge-wood mr-2">${esc(p.category)}</span>${fmtDate(p.date)} · ${esc(p.author)}</p>
            <h3 class="font-display text-lg font-semibold mt-1 truncate">${esc(p.title)}</h3>
            <p class="text-sm text-walnut/65 line-clamp-1 hidden sm:block">${esc(p.excerpt)}</p>
          </div>
          <div class="flex flex-col sm:flex-row gap-2">
            <button type="button" class="btn btn-ghost btn-sm" data-edit-post="${esc(p.id)}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-post="${esc(p.id)}">Delete</button>
          </div>
        </div>`).join('')}</div>` : `<div class="admin-card">${emptyState('No stories yet', 'Write your first care guide or news article.')}</div>`}`;
  }

  function editPost(id) {
    const existing = id ? Store.get('posts', id) : null;
    const p = existing || { id: CH.uid('post'), title: '', category: 'Care Guide', author: Store.settings().merchant.name, date: new Date().toISOString(), excerpt: '', content: '', image: '' };
    const draft = { image: p.image || '' };
    const body = openModal(`
      <form data-post-form class="space-y-4" novalidate>
        <div>
          <label class="field-label" for="bf-title">Title *</label>
          <input id="bf-title" name="title" class="field" value="${esc(p.title)}" maxlength="120" required>
          <p class="field-error" data-error-for="title"></p>
        </div>
        <div class="grid sm:grid-cols-3 gap-4">
          <div>
            <label class="field-label" for="bf-cat">Category *</label>
            <input id="bf-cat" name="category" class="field" value="${esc(p.category)}" list="post-cats" maxlength="40" required>
            <datalist id="post-cats"><option>Care Guide</option><option>Wood Guide</option><option>Craftsmanship</option><option>News</option><option>Recipes</option></datalist>
            <p class="field-error" data-error-for="category"></p>
          </div>
          <div>
            <label class="field-label" for="bf-author">Author *</label>
            <input id="bf-author" name="author" class="field" value="${esc(p.author)}" maxlength="60" required>
            <p class="field-error" data-error-for="author"></p>
          </div>
          <div>
            <label class="field-label" for="bf-date">Date (dd/mm/yyyy) *</label>
            <input id="bf-date" name="date" class="field" value="${fmtDate(p.date)}" placeholder="dd/mm/yyyy" inputmode="numeric" maxlength="10" required>
            <p class="field-error" data-error-for="date"></p>
          </div>
        </div>
        <div>
          <label class="field-label" for="bf-excerpt">Short summary *</label>
          <textarea id="bf-excerpt" name="excerpt" rows="2" class="field" maxlength="300" required>${esc(p.excerpt)}</textarea>
          <p class="field-error" data-error-for="excerpt"></p>
        </div>
        <div>
          <label class="field-label" for="bf-content">Content *</label>
          <textarea id="bf-content" name="content" rows="12" class="field font-mono !text-sm" required>${esc(p.content)}</textarea>
          <p class="text-[11px] text-walnut/55 mt-1">Formatting: blank line = new paragraph · "## " = heading · "- " = bullet list · "1. " = numbered list · **bold**</p>
          <p class="field-error" data-error-for="content"></p>
        </div>
        ${imageFieldHtml('bimg', p.image || CH.storyImage(p))}
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Publish story'}</button>
        </div>
      </form>`, { title: existing ? 'Edit story' : 'New story', size: 'lg' });

    const form = $('[data-post-form]', body);
    bindImageField(body, 'bimg', draft, () => CH.storyImage({ ...p, title: form.elements.title.value || p.title }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (n) => String(form.elements[n].value || '').trim();
      const errors = {};
      if (v('title').length < 3) errors.title = 'Title is required.';
      if (v('category').length < 2) errors.category = 'Category is required.';
      if (v('author').length < 2) errors.author = 'Author is required.';
      const iso = CH.parseDMY(v('date'));
      if (!iso) errors.date = 'Enter a valid date as dd/mm/yyyy.';
      if (v('excerpt').length < 10) errors.excerpt = 'Please write a short summary.';
      if (v('content').length < 20) errors.content = 'Please write the article content.';
      ['title', 'category', 'author', 'date', 'excerpt', 'content'].forEach((n) => {
        const err = $(`[data-error-for="${n}"]`, form);
        if (err) err.textContent = errors[n] || '';
        form.elements[n].classList.toggle('invalid', !!errors[n]);
      });
      if (Object.keys(errors).length) return;
      const saved = { ...p, title: v('title'), category: v('category'), author: v('author'), date: iso, excerpt: v('excerpt'), content: v('content'), image: draft.image, updatedAt: new Date().toISOString() };
      if (!Store.upsert('posts', saved)) return;
      Store.log(existing ? 'Story updated' : 'Story published', `${saved.title} (${fmtDate(saved.date)})`);
      closeModal(body);
      toast(existing ? 'Story updated' : 'Story published');
    });
  }

  async function deletePost(id) {
    const p = Store.get('posts', id);
    if (!p) return;
    const ok = await confirmDialog(`Delete the story "${p.title}"?`, { title: 'Delete story', okText: 'Delete', danger: true });
    if (!ok) return;
    Store.remove('posts', id);
    Store.log('Story deleted', p.title);
    toast('Story deleted', 'info');
  }

  /* ====================================================================
   * Ads & promotions
   * ==================================================================== */
  function toggle(name, checked, label) {
    return `<label class="flex items-center gap-3"><span class="switch"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span></span></span><span class="text-sm font-semibold">${label}</span></label>`;
  }

  function promotions() {
    const s = Store.settings();
    const productsList = Store.all('products');
    const targets = [['#shop', 'Shop'], ['#stories', 'Stories'], ['#legal', 'Legal info'], ['#contact', 'Contact'], ['#promo', 'Homepage promotion']];
    return `
      <div class="grid xl:grid-cols-2 gap-5">
        <form class="admin-card p-5 space-y-4" data-settings-form="announcement">
          <div class="flex items-center justify-between gap-3"><h3 class="font-display text-xl font-semibold">Announcement bar</h3>${toggle('enabled', s.announcement.enabled, 'Visible')}</div>
          <div>
            <label class="field-label" for="an-text">Announcement text</label>
            <textarea id="an-text" name="text" rows="2" class="field" maxlength="200">${esc(s.announcement.text)}</textarea>
          </div>
          <div class="grid sm:grid-cols-2 gap-3">
            <div><label class="field-label" for="an-link">Link text</label><input id="an-link" name="linkText" class="field" value="${esc(s.announcement.linkText)}" maxlength="30"></div>
            <div><label class="field-label" for="an-target">Link target</label><select id="an-target" name="linkTarget" class="field">${targets.map(([v, l]) => `<option value="${v}" ${s.announcement.linkTarget === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          </div>
          <div class="rounded-xl wood-amber text-cream text-sm px-4 py-2 text-center" data-announce-preview>${esc(s.announcement.text)} <u>${esc(s.announcement.linkText)}</u></div>
          <button type="submit" class="btn btn-primary btn-sm">Save announcement</button>
        </form>

        <form class="admin-card p-5 space-y-4" data-settings-form="hero">
          <h3 class="font-display text-xl font-semibold">Hero banner</h3>
          <div><label class="field-label" for="he-eyebrow">Small heading</label><input id="he-eyebrow" name="eyebrow" class="field" value="${esc(s.hero.eyebrow)}" maxlength="50"></div>
          <div><label class="field-label" for="he-title">Main headline *</label><input id="he-title" name="title" class="field" value="${esc(s.hero.title)}" maxlength="70" required></div>
          <div><label class="field-label" for="he-sub">Subtitle</label><textarea id="he-sub" name="subtitle" rows="3" class="field" maxlength="300">${esc(s.hero.subtitle)}</textarea></div>
          <div><label class="field-label" for="he-cta">Button text *</label><input id="he-cta" name="ctaText" class="field" value="${esc(s.hero.ctaText)}" maxlength="30" required></div>
          <button type="submit" class="btn btn-primary btn-sm">Save hero</button>
        </form>

        <form class="admin-card p-5 space-y-4" data-settings-form="promo">
          <div class="flex items-center justify-between gap-3"><h3 class="font-display text-xl font-semibold">Homepage promotion</h3>${toggle('enabled', s.promo.enabled, 'Visible')}</div>
          <div class="grid sm:grid-cols-2 gap-3">
            <div><label class="field-label" for="pr-badge">Badge</label><input id="pr-badge" name="badge" class="field" value="${esc(s.promo.badge)}" maxlength="30"></div>
            <div><label class="field-label" for="pr-product">Featured product</label><select id="pr-product" name="productId" class="field"><option value="">— Link to shop —</option>${productsList.map((p) => `<option value="${esc(p.id)}" ${s.promo.productId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
          </div>
          <div><label class="field-label" for="pr-title">Title *</label><input id="pr-title" name="title" class="field" value="${esc(s.promo.title)}" maxlength="80" required></div>
          <div><label class="field-label" for="pr-text">Text</label><textarea id="pr-text" name="text" rows="3" class="field" maxlength="400">${esc(s.promo.text)}</textarea></div>
          <div><label class="field-label" for="pr-cta">Button text</label><input id="pr-cta" name="ctaText" class="field" value="${esc(s.promo.ctaText)}" maxlength="30"></div>
          <button type="submit" class="btn btn-primary btn-sm">Save promotion</button>
        </form>

        <div class="space-y-5">
          <div class="admin-card p-5">
            <h3 class="font-display text-xl font-semibold mb-3">Discount codes</h3>
            ${s.codes.length ? `<ul class="space-y-2 mb-4">${s.codes.map((c, i) => `
              <li class="flex items-center gap-3 p-2 rounded-xl bg-white/60 ring-1 ring-accent/30">
                <span class="font-mono font-bold flex-1">${esc(c.code)}</span>
                <span class="text-sm font-semibold">−${esc(c.percent)}%</span>
                <label class="switch" title="Active"><input type="checkbox" data-code-toggle="${i}" ${c.active ? 'checked' : ''} aria-label="Code ${esc(c.code)} active"><span></span></label>
                <button type="button" class="icon-btn !w-8 !h-8" data-code-delete="${i}" aria-label="Delete code ${esc(c.code)}">✕</button>
              </li>`).join('')}</ul>` : '<p class="text-sm text-walnut/60 mb-4">No discount codes yet.</p>'}
            <form class="flex flex-wrap gap-2" data-code-form novalidate>
              <label class="sr-only" for="nc-code">New code</label>
              <input id="nc-code" name="code" class="field !py-2 uppercase flex-1 min-w-[120px]" placeholder="CODE" maxlength="20" pattern="[A-Za-z0-9]+">
              <label class="sr-only" for="nc-pct">Percent</label>
              <input id="nc-pct" name="percent" type="number" min="1" max="90" class="field !py-2 !w-24" placeholder="%">
              <button type="submit" class="btn btn-primary btn-sm">Add code</button>
            </form>
          </div>

          <form class="admin-card p-5 space-y-4" data-settings-form="shipping">
            <h3 class="font-display text-xl font-semibold">Shipping (incl. VAT)</h3>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="field-label" for="sh-office">Courier office (€)</label><input id="sh-office" name="courierOffice" type="number" min="0" step="0.01" class="field" value="${esc(s.shipping.courierOffice)}"></div>
              <div><label class="field-label" for="sh-addr">Personal address (€)</label><input id="sh-addr" name="address" type="number" min="0" step="0.01" class="field" value="${esc(s.shipping.address)}"></div>
              <div><label class="field-label" for="sh-free">Free shipping from (€)</label><input id="sh-free" name="freeThreshold" type="number" min="0" step="0.01" class="field" value="${esc(s.shipping.freeThreshold)}"></div>
              <div><label class="field-label" for="sh-days">Dispatch time</label><input id="sh-days" name="dispatchDays" class="field" value="${esc(s.shipping.dispatchDays)}" maxlength="30"></div>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Save shipping</button>
          </form>
        </div>
      </div>`;
  }

  function saveSettingsSection(section, form) {
    const s = Store.settings();
    const v = (n) => String(form.elements[n].value || '').trim();
    const checked = (n) => !!(form.elements[n] && form.elements[n].checked);
    if (section === 'announcement') {
      if (checked('enabled') && v('text').length < 3) { toast('Please enter the announcement text.', 'error'); return; }
      s.announcement = { enabled: checked('enabled'), text: v('text'), linkText: v('linkText'), linkTarget: v('linkTarget') };
      sessionStorage.removeItem('chopaholic_announce_dismissed');
    } else if (section === 'hero') {
      if (v('title').length < 3 || v('ctaText').length < 2) { toast('Headline and button text are required.', 'error'); return; }
      s.hero = { eyebrow: v('eyebrow'), title: v('title'), subtitle: v('subtitle'), ctaText: v('ctaText') };
    } else if (section === 'promo') {
      if (checked('enabled') && v('title').length < 3) { toast('Please enter a promotion title.', 'error'); return; }
      s.promo = { enabled: checked('enabled'), badge: v('badge'), title: v('title'), text: v('text'), ctaText: v('ctaText'), productId: v('productId') };
    } else if (section === 'shipping') {
      const nums = ['courierOffice', 'address', 'freeThreshold'].map((n) => Number(v(n)));
      if (nums.some((n) => !(n >= 0) || Number.isNaN(n))) { toast('Shipping amounts must be 0 or more.', 'error'); return; }
      s.shipping = { courierOffice: round2(nums[0]), address: round2(nums[1]), freeThreshold: round2(nums[2]), dispatchDays: v('dispatchDays') || '2–5 working days' };
    } else if (section === 'merchant') {
      if (v('name').length < 3 || v('address').length < 5 || !CH.isPhone(v('phone')) || !CH.isEmail(v('email'))) {
        toast('Merchant name, address, a valid phone and email are required by law.', 'error');
        return;
      }
      const vat = Number(v('vatRate'));
      if (!(vat >= 0 && vat <= 50)) { toast('VAT rate must be between 0 and 50.', 'error'); return; }
      s.merchant = { name: v('name'), address: v('address'), phone: v('phone'), email: v('email'), companyId: v('companyId'), vatNumber: v('vatNumber') };
      s.vatRate = vat;
    }
    if (Store.saveSettings(s)) {
      Store.log('Settings updated', section.charAt(0).toUpperCase() + section.slice(1));
      toast('Saved — the storefront has been updated.');
    }
  }

  /* ====================================================================
   * Inbox (contact messages & withdrawals)
   * ==================================================================== */
  function inbox() {
    const messages = Store.all('messages');
    const withdrawals = Store.all('withdrawals');
    return `
      <div class="grid xl:grid-cols-2 gap-5">
        <div class="admin-card p-5">
          <h3 class="font-display text-xl font-semibold mb-1">Withdrawal requests</h3>
          <p class="text-xs text-walnut/55 mb-4">Refunds are due within 14 days of the date received (Art. 13 Directive 2011/83/EU).</p>
          ${withdrawals.length ? `<ul class="space-y-3">${withdrawals.map((w) => {
            const deadline = new Date(w.submittedAt);
            deadline.setDate(deadline.getDate() + 14);
            return `
            <li class="p-4 rounded-2xl bg-white/60 ring-1 ring-accent/30 text-sm">
              <div class="flex flex-wrap justify-between gap-2">
                <p class="font-mono font-bold">${esc(w.id)}</p>
                <span class="status-pill ${w.status === 'Received' ? 'status-New' : 'status-Dispatched'}">${esc(w.status)}</span>
              </div>
              <p class="mt-1"><strong>${esc(w.name)}</strong> · <a class="underline" href="mailto:${esc(w.email)}">${esc(w.email)}</a></p>
              <p>Order <span class="font-mono">${esc(w.orderId)}</span> ${w.orderMatched ? '<span class="text-green-800">(matched)</span>' : '<span class="text-red-700">(not matched — verify)</span>'}</p>
              <p>Goods: ${esc(w.items)}</p>
              ${w.receivedOn ? `<p>Goods received by customer on ${fmtDate(w.receivedOn)}</p>` : ''}
              ${w.comment ? `<p class="text-walnut/70 italic">"${esc(w.comment)}"</p>` : ''}
              <p class="text-xs text-walnut/60 mt-1">Submitted ${fmtDateTime(w.submittedAt)} · Refund deadline ${fmtDate(deadline)}</p>
              <div class="flex flex-wrap gap-2 mt-3">
                ${w.status === 'Received' ? `<button type="button" class="btn btn-primary btn-sm" data-wd-complete="${esc(w.id)}">Mark refunded</button>` : ''}
                ${w.orderMatched ? `<button type="button" class="btn btn-ghost btn-sm" data-view-order="${esc(w.orderId)}">View order</button>` : ''}
                <button type="button" class="btn btn-ghost btn-sm" data-wd-delete="${esc(w.id)}">Delete</button>
              </div>
            </li>`;
          }).join('')}</ul>` : '<p class="text-sm text-walnut/60">No withdrawal requests.</p>'}
        </div>
        <div class="admin-card p-5">
          <h3 class="font-display text-xl font-semibold mb-4">Contact messages</h3>
          ${messages.length ? `<ul class="space-y-3">${messages.map((m) => `
            <li class="p-4 rounded-2xl ${m.read ? 'bg-white/40' : 'bg-accent/15 ring-2 ring-accent/50'} ring-1 ring-accent/30 text-sm">
              <div class="flex flex-wrap justify-between gap-2">
                <p><strong>${esc(m.name)}</strong> · <span class="text-walnut/70">${esc(m.subject)}</span></p>
                <span class="text-xs text-walnut/60">${fmtDateTime(m.createdAt)}</span>
              </div>
              <p class="mt-2 whitespace-pre-line text-walnut/85">${esc(m.message)}</p>
              <div class="flex flex-wrap gap-2 mt-3">
                <a class="btn btn-primary btn-sm" href="mailto:${esc(m.email)}?subject=${encodeURIComponent(`Re: ${m.subject}`)}" data-msg-reply="${esc(m.id)}">Reply by email</a>
                <button type="button" class="btn btn-ghost btn-sm" data-msg-read="${esc(m.id)}">${m.read ? 'Mark unread' : 'Mark read'}</button>
                <button type="button" class="btn btn-ghost btn-sm" data-msg-delete="${esc(m.id)}">Delete</button>
              </div>
            </li>`).join('')}</ul>` : '<p class="text-sm text-walnut/60">No messages yet.</p>'}
        </div>
      </div>`;
  }

  /* ====================================================================
   * Activity log
   * ==================================================================== */
  function logs() {
    const list = Store.all('logs');
    return `
      <div class="admin-card p-5">
        <div class="flex justify-between items-center mb-4">
          <p class="text-sm text-walnut/60">${list.length} entries (latest 300 kept)</p>
          <button type="button" class="btn btn-ghost btn-sm" data-clear-logs ${list.length ? '' : 'disabled'}>Clear log</button>
        </div>
        ${list.length ? `<div class="overflow-x-auto scroll-thin"><table class="admin-table">
          <thead><tr><th>Date & time</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>${list.map((l) => `<tr><td class="font-mono whitespace-nowrap">${fmtDateTime(l.at)}</td><td class="font-semibold whitespace-nowrap">${esc(l.action)}</td><td>${esc(l.detail)}</td></tr>`).join('')}</tbody>
        </table></div>` : emptyState('Log is empty', 'Actions will be recorded here.')}
      </div>`;
  }

  /* ====================================================================
   * Settings & data
   * ==================================================================== */
  function settings() {
    const s = Store.settings();
    const m = s.merchant;
    return `
      <div class="grid xl:grid-cols-2 gap-5">
        <form class="admin-card p-5 space-y-4" data-settings-form="merchant">
          <h3 class="font-display text-xl font-semibold">Merchant information</h3>
          <p class="text-xs text-walnut/60">Shown in the footer, contact section, legal documents and receipts (E-Commerce Directive Art. 5).</p>
          <div class="grid sm:grid-cols-2 gap-3">
            <div><label class="field-label" for="mf-name">Business owner / Merchant *</label><input id="mf-name" name="name" class="field" value="${esc(m.name)}" maxlength="80"></div>
            <div><label class="field-label" for="mf-address">Address *</label><input id="mf-address" name="address" class="field" value="${esc(m.address)}" maxlength="120"></div>
            <div><label class="field-label" for="mf-phone">Phone *</label><input id="mf-phone" name="phone" class="field" value="${esc(m.phone)}" maxlength="25"></div>
            <div><label class="field-label" for="mf-email">Email *</label><input id="mf-email" name="email" type="email" class="field" value="${esc(m.email)}" maxlength="120"></div>
            <div><label class="field-label" for="mf-uic">Company ID / UIC (if registered)</label><input id="mf-uic" name="companyId" class="field" value="${esc(m.companyId)}" maxlength="20"></div>
            <div><label class="field-label" for="mf-vat">VAT number (if registered)</label><input id="mf-vat" name="vatNumber" class="field" value="${esc(m.vatNumber)}" maxlength="20" placeholder="BG…"></div>
            <div><label class="field-label" for="mf-vatrate">VAT rate (%) *</label><input id="mf-vatrate" name="vatRate" type="number" min="0" max="50" step="0.1" class="field" value="${esc(s.vatRate)}"></div>
          </div>
          <button type="submit" class="btn btn-primary btn-sm">Save merchant details</button>
        </form>

        <div class="space-y-5">
          <div class="admin-card p-5 space-y-3">
            <h3 class="font-display text-xl font-semibold">Backup & restore</h3>
            <p class="text-sm text-walnut/70">Download a JSON backup of products, orders, stories, messages, withdrawals and settings — ready for import into Firebase/Firestore.</p>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn btn-primary btn-sm" data-export-json>Download backup</button>
              <label class="btn btn-ghost btn-sm cursor-pointer">Restore from backup<input type="file" accept="application/json,.json" class="sr-only" data-import-json></label>
            </div>
          </div>
          <div class="admin-card p-5 space-y-3">
            <h3 class="font-display text-xl font-semibold">Storage usage</h3>
            ${storageUsage()}
          </div>
          <div class="admin-card p-5 space-y-3 ring-1 ring-red-800/30">
            <h3 class="font-display text-xl font-semibold text-red-900">Danger zone</h3>
            <p class="text-sm text-walnut/70">Reset the catalogue, stories and settings to the original demo data and delete all orders, messages and withdrawals.</p>
            <button type="button" class="btn btn-danger btn-sm" data-reset-store>Reset store data</button>
          </div>
        </div>
      </div>`;
  }

  function storageUsage() {
    let bytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith('chopaholic_')) bytes += (k.length + (localStorage.getItem(k) || '').length) * 2;
      }
    } catch (err) { /* ignore */ }
    const limit = 5 * 1024 * 1024;
    const pct = Math.min(100, Math.round((bytes / limit) * 100));
    return `<p class="text-sm">${(bytes / 1024).toFixed(1)} KB used of ~5 MB browser storage (${pct}%).</p>
      <div class="h-2 rounded-full bg-accent/25 overflow-hidden"><div class="h-full bg-gradient-to-r from-amberwood to-accent" style="width:${Math.max(2, pct)}%"></div></div>
      <p class="text-[11px] text-walnut/55">Tip: uploaded images take the most space — prefer image URLs for large catalogues.</p>`;
  }

  function exportJson() {
    const data = {
      exportedAt: new Date().toISOString(),
      exportedOn: fmtDateTime(new Date()),
      products: Store.all('products'),
      orders: Store.all('orders'),
      posts: Store.all('posts'),
      messages: Store.all('messages'),
      withdrawals: Store.all('withdrawals'),
      logs: Store.all('logs'),
      settings: Store.settings(),
    };
    CH.downloadFile(`chopaholic-backup-${fmtDate(new Date()).replace(/\//g, '-')}.json`, JSON.stringify(data, null, 2), 'application/json');
    Store.log('Backup downloaded', '');
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch (err) {
        toast('This file is not valid JSON.', 'error');
        return;
      }
      const cols = ['products', 'orders', 'posts', 'messages', 'withdrawals', 'logs'];
      if (!data || typeof data !== 'object' || !Array.isArray(data.products) || !data.settings) {
        toast('This does not look like a Chopaholic backup.', 'error');
        return;
      }
      const ok = await confirmDialog('Restoring replaces all current products, orders, stories, messages and settings with the backup. Continue?', { title: 'Restore backup', okText: 'Restore', danger: true });
      if (!ok) return;
      cols.forEach((c) => { if (Array.isArray(data[c])) Store.saveAll(c, data[c]); });
      Store.saveSettings(data.settings);
      Store.log('Backup restored', data.exportedOn || '');
      toast('Backup restored.');
    };
    reader.readAsText(file);
  }

  /* ====================================================================
   * Section event binding
   * ==================================================================== */
  function bindSection(id, root) {
    if (id === 'orders') {
      const search = $('[data-order-search]', root);
      search.addEventListener('input', CH.debounce(() => {
        ui.orderSearch = search.value;
        render();
        const again = $('[data-order-search]');
        again.focus();
        again.setSelectionRange(again.value.length, again.value.length);
      }, 250));
      $$('[data-order-status]', root).forEach((sel) => sel.addEventListener('change', () => setOrderStatus(sel.dataset.orderStatus, sel.value)));
    }
    if (id === 'products') {
      const search = $('[data-product-search]', root);
      search.addEventListener('input', CH.debounce(() => {
        ui.productSearch = search.value;
        render();
        const again = $('[data-product-search]');
        again.focus();
        again.setSelectionRange(again.value.length, again.value.length);
      }, 250));
    }
    if (id === 'promotions' || id === 'settings') {
      $$('[data-settings-form]', root).forEach((form) => {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          saveSettingsSection(form.dataset.settingsForm, form);
        });
      });
      const announceForm = $('[data-settings-form="announcement"]', root);
      if (announceForm) {
        announceForm.addEventListener('input', () => {
          $('[data-announce-preview]', root).innerHTML = `${esc(announceForm.elements.text.value)} <u>${esc(announceForm.elements.linkText.value)}</u>`;
        });
      }
      const codeForm = $('[data-code-form]', root);
      if (codeForm) {
        codeForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const code = codeForm.elements.code.value.trim().toUpperCase();
          const pct = Number(codeForm.elements.percent.value);
          if (!/^[A-Z0-9]{3,20}$/.test(code)) { toast('Code must be 3–20 letters or digits.', 'error'); return; }
          if (!(pct >= 1 && pct <= 90)) { toast('Discount must be between 1% and 90%.', 'error'); return; }
          const s = Store.settings();
          if (s.codes.some((c) => c.code.toUpperCase() === code)) { toast('That code already exists.', 'error'); return; }
          s.codes.push({ code, percent: pct, active: true });
          Store.saveSettings(s);
          Store.log('Discount code added', `${code} (−${pct}%)`);
          toast(`Code ${code} created`);
        });
        $$('[data-code-toggle]', root).forEach((cb) => cb.addEventListener('change', () => {
          const s = Store.settings();
          const c = s.codes[Number(cb.dataset.codeToggle)];
          if (!c) return;
          c.active = cb.checked;
          Store.saveSettings(s);
          Store.log('Discount code updated', `${c.code} ${c.active ? 'activated' : 'deactivated'}`);
        }));
      }
      const importInput = $('[data-import-json]', root);
      if (importInput) importInput.addEventListener('change', (e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });
    }
  }

  /* Delegated clicks inside the admin panel */
  function initEvents() {
    const panel = $('#admin-panel');
    panel.addEventListener('click', async (e) => {
      const t = (sel) => e.target.closest(sel);
      let el;
      if ((el = t('[data-admin-section]'))) { ui.section = el.dataset.adminSection; render(); $('#admin-content').scrollTop = 0; return; }
      if ((el = t('[data-admin-action]'))) {
        if (el.dataset.adminAction === 'logout') logout();
        else close();
        return;
      }
      if ((el = t('[data-order-filter]'))) { ui.orderFilter = el.dataset.orderFilter; render(); return; }
      if ((el = t('[data-view-order]'))) { viewOrder(el.dataset.viewOrder); return; }
      if (t('[data-export-orders]')) { exportOrdersCsv(); return; }
      if (t('[data-new-product]')) { editProduct(null); return; }
      if ((el = t('[data-edit-product]'))) { editProduct(el.dataset.editProduct); return; }
      if ((el = t('[data-delete-product]'))) { deleteProduct(el.dataset.deleteProduct); return; }
      if (t('[data-new-post]')) { editPost(null); return; }
      if ((el = t('[data-edit-post]'))) { editPost(el.dataset.editPost); return; }
      if ((el = t('[data-delete-post]'))) { deletePost(el.dataset.deletePost); return; }
      if ((el = t('[data-code-delete]'))) {
        const s = Store.settings();
        const c = s.codes[Number(el.dataset.codeDelete)];
        if (!c) return;
        if (!(await confirmDialog(`Delete discount code ${c.code}?`, { title: 'Delete code', okText: 'Delete', danger: true }))) return;
        s.codes.splice(Number(el.dataset.codeDelete), 1);
        Store.saveSettings(s);
        Store.log('Discount code deleted', c.code);
        return;
      }
      if ((el = t('[data-msg-read]')) || (el = t('[data-msg-reply]'))) {
        const msgId = el.dataset.msgRead || el.dataset.msgReply;
        const m = Store.get('messages', msgId);
        if (!m) return;
        m.read = el.dataset.msgReply ? true : !m.read;
        Store.upsert('messages', m);
        return;
      }
      if ((el = t('[data-msg-delete]'))) {
        if (!(await confirmDialog('Delete this message?', { title: 'Delete message', okText: 'Delete', danger: true }))) return;
        Store.remove('messages', el.dataset.msgDelete);
        Store.log('Message deleted', '');
        return;
      }
      if ((el = t('[data-wd-complete]'))) {
        const w = Store.get('withdrawals', el.dataset.wdComplete);
        if (!w) return;
        w.status = 'Refunded';
        w.completedAt = new Date().toISOString();
        Store.upsert('withdrawals', w);
        Store.log('Withdrawal refunded', `${w.id} · order ${w.orderId}`);
        toast(`${w.id} marked as refunded`);
        return;
      }
      if ((el = t('[data-wd-delete]'))) {
        if (!(await confirmDialog('Delete this withdrawal record?', { title: 'Delete record', okText: 'Delete', danger: true }))) return;
        Store.remove('withdrawals', el.dataset.wdDelete);
        Store.log('Withdrawal record deleted', el.dataset.wdDelete);
        return;
      }
      if (t('[data-clear-logs]')) {
        if (!(await confirmDialog('Clear the whole activity log?', { title: 'Clear log', okText: 'Clear', danger: true }))) return;
        Store.saveAll('logs', []);
        Store.log('Activity log cleared', '');
        return;
      }
      if (t('[data-export-json]')) { exportJson(); return; }
      if (t('[data-reset-store]')) {
        if (!(await confirmDialog('This permanently deletes all orders, messages and withdrawals and restores the demo catalogue. Continue?', { title: 'Reset store', okText: 'Reset everything', danger: true }))) return;
        Store.seed(true);
        Store.setDoc('cart', { items: [], code: '' });
        toast('Store data has been reset.', 'info');
      }
    });

    // Live refresh: re-render the relevant section whenever data changes (including from other tabs)
    const deps = {
      dashboard: ['orders', 'products', 'messages', 'withdrawals', 'analytics', 'all'],
      orders: ['orders', 'all'],
      products: ['products', 'settings', 'all'],
      stories: ['posts', 'all'],
      promotions: ['settings', 'products', 'all'],
      inbox: ['messages', 'withdrawals', 'all'],
      logs: ['logs', 'all'],
      settings: ['settings', 'all'],
    };
    Store.on((name) => {
      if (!isOpen()) return;
      if ((deps[ui.section] || []).includes(name)) {
        const content = $('#admin-content');
        const scroll = content.scrollTop;
        const active = document.activeElement;
        const typing = active && content.contains(active) && active.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea') && name !== 'settings';
        if (typing && ui.section !== 'dashboard') { renderNav(); return; }
        render();
        content.scrollTop = scroll;
      } else if (['orders', 'messages', 'withdrawals'].includes(name)) {
        renderNav();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initEvents);
  else initEvents();

  CH.Admin = { open, close, login, logout, isLoggedIn };
})();
