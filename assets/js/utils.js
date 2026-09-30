/* Chopaholic — shared helpers (formatting, escaping, DOM, toasts, modals). */
(function () {
  'use strict';

  const CH = (window.CH = window.CH || {});

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESC_MAP[c]);

  const pad = (n) => String(n).padStart(2, '0');

  /** Strict dd/mm/yyyy formatting for every date shown anywhere in the system. */
  function fmtDate(input) {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  /** dd/mm/yyyy HH:mm — used for order timestamps and logs. */
  function fmtDateTime(input) {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** Parses a dd/mm/yyyy string into an ISO string (local midnight). Returns null when invalid. */
  function parseDMY(str) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(str || '').trim());
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const d = new Date(year, month - 1, day, 12, 0, 0);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d.toISOString();
  }

  const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
  const fmtMoney = (n) => money.format(Math.round((Number(n) || 0) * 100) / 100);
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  function uid(prefix = 'id') {
    const rnd = (window.crypto && crypto.getRandomValues)
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')
      : Math.random().toString(16).slice(2, 14);
    return `${prefix}_${Date.now().toString(36)}${rnd}`;
  }

  function randomCode(len) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = (window.crypto && crypto.getRandomValues)
      ? crypto.getRandomValues(new Uint8Array(len))
      : Array.from({ length: len }, () => Math.floor(Math.random() * 256));
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
  const isPhone = (v) => /^\+?[0-9 ()\-]{7,20}$/.test(String(v || '').trim()) && String(v).replace(/\D/g, '').length >= 7;

  /**
   * Renders plain text written in the admin panel into safe HTML.
   * Supports: blank-line separated paragraphs, "## " headings, "- " bullet lists, **bold**.
   */
  function richText(text) {
    const blocks = String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return blocks
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('## ')) return `<h3>${inline(trimmed.slice(3))}</h3>`;
        const lines = trimmed.split('\n');
        if (lines.every((l) => l.trim().startsWith('- '))) {
          return `<ul>${lines.map((l) => `<li>${inline(l.trim().slice(2))}</li>`).join('')}</ul>`;
        }
        if (lines.every((l) => /^\d+\.\s/.test(l.trim()))) {
          return `<ol>${lines.map((l) => `<li>${inline(l.trim().replace(/^\d+\.\s/, ''))}</li>`).join('')}</ol>`;
        }
        return `<p>${lines.map(inline).join('<br>')}</p>`;
      })
      .join('');
  }

  /* ---------- Toasts ---------- */
  function toast(message, type = 'success') {
    const host = $('#toasts');
    if (!host) return;
    const el = document.createElement('div');
    const icon = type === 'error' ? '⚠' : type === 'info' ? 'ℹ' : '✓';
    el.className = `toast toast-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `<span class="toast-icon" aria-hidden="true">${icon}</span><span>${esc(message)}</span>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 350);
    }, 3200);
  }

  /* ---------- Modal stack ---------- */
  const modalStack = [];
  let lastFocused = [];

  /**
   * Opens a modal. Returns the modal's content element.
   * opts: { size: 'sm'|'md'|'lg'|'xl', title, onClose, labelledBy, dismissible }
   */
  function openModal(html, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    const titleId = uid('mt');
    if (opts.title) wrap.setAttribute('aria-labelledby', titleId);
    const size = opts.size || 'md';
    wrap.innerHTML = `
      <div class="modal-backdrop" data-close-modal></div>
      <div class="modal-panel glass-panel modal-${size}">
        <div class="modal-head">
          ${opts.title ? `<h2 id="${titleId}" class="font-display text-xl sm:text-2xl text-walnut">${esc(opts.title)}</h2>` : '<span></span>'}
          ${opts.dismissible === false ? '' : '<button type="button" class="icon-btn" data-close-modal aria-label="Close dialog">✕</button>'}
        </div>
        <div class="modal-body">${html}</div>
      </div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('no-scroll');
    lastFocused.push(document.activeElement);
    modalStack.push({ el: wrap, onClose: opts.onClose, dismissible: opts.dismissible !== false });
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('[data-close-modal]') && opts.dismissible !== false) closeModal(wrap);
    });
    requestAnimationFrame(() => {
      wrap.classList.add('open');
      const focusable = wrap.querySelector('[autofocus], input, select, textarea, button:not([data-close-modal])') || wrap.querySelector('button');
      if (focusable) focusable.focus({ preventScroll: true });
    });
    return wrap.querySelector('.modal-body');
  }

  function closeModal(target) {
    const idx = target ? modalStack.findIndex((m) => m.el === target || m.el.contains(target)) : modalStack.length - 1;
    if (idx < 0) return;
    const [entry] = modalStack.splice(idx, 1);
    const prevFocus = lastFocused.splice(idx, 1)[0];
    entry.el.classList.remove('open');
    setTimeout(() => entry.el.remove(), 250);
    if (!modalStack.length && !document.body.classList.contains('drawer-open') && !document.body.classList.contains('admin-open')) {
      document.body.classList.remove('no-scroll');
    }
    if (typeof entry.onClose === 'function') entry.onClose();
    if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus({ preventScroll: true });
  }

  const topModal = () => modalStack[modalStack.length - 1];

  function confirmDialog(message, { title = 'Please confirm', okText = 'Confirm', danger = false } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      const body = openModal(
        `<p class="text-walnut/80 leading-relaxed">${esc(message)}</p>
         <div class="flex flex-wrap gap-3 justify-end mt-6">
           <button type="button" class="btn btn-ghost" data-answer="no">Cancel</button>
           <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-answer="yes">${esc(okText)}</button>
         </div>`,
        { title, size: 'sm', onClose: () => { if (!answered) resolve(false); } }
      );
      body.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-answer]');
        if (!btn) return;
        answered = true;
        resolve(btn.dataset.answer === 'yes');
        closeModal(body);
      });
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const top = topModal();
      if (top && top.dismissible) {
        e.preventDefault();
        closeModal(top.el);
      }
    }
    if (e.key === 'Tab') {
      const top = topModal();
      if (!top) return;
      const focusables = $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', top.el)
        .filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /** Reads an uploaded image file, downsizes it and returns a compressed JPEG data URL. */
  function readImageFile(file, maxSize = 1000) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Please choose an image file.')); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the file.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('The file is not a valid image.'));
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FAEDCD';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function downloadFile(filename, content, mime = 'text/plain') {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Opens a print window with the supplied HTML (used for order receipts & withdrawal acknowledgements). */
  function printDocument(title, innerHtml) {
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) { toast('Please allow pop-ups to print or save this document.', 'error'); return; }
    w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>
        body{font-family:Georgia,'Times New Roman',serif;color:#2C1A0E;margin:40px;line-height:1.5}
        h1{font-size:26px;margin:0 0 4px} h2{font-size:18px;margin:24px 0 8px;border-bottom:1px solid #D4A373;padding-bottom:4px}
        table{width:100%;border-collapse:collapse;margin-top:8px} th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eadcc0;font-size:14px}
        th{background:#FAEDCD} .right{text-align:right} .muted{color:#6b5443;font-size:13px} .total td{font-weight:bold;border-top:2px solid #8B5A2B}
      </style></head><body>${innerHtml}<script>window.onload=function(){window.print();}<\/script></body></html>`);
    w.document.close();
  }

  Object.assign(CH, {
    $, $$, esc, pad, fmtDate, fmtDateTime, parseDMY, fmtMoney, round2, uid, randomCode, debounce,
    isEmail, isPhone, richText, toast, openModal, closeModal, confirmDialog, readImageFile, downloadFile, printDocument,
  });
})();
