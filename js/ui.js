import { icon } from './icons.js';

// h('div.card', {onclick}, child...)  — tiny DOM builder
export function h(sel, attrs, ...kids) {
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (attrs && (attrs.nodeType || typeof attrs !== 'object' || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Light markup used in the content: **bold**, [text](url), {jp:日本語}, {ltr:ABC 123}, line breaks
export function rich(s) {
  if (!s) return '';
  let out = esc(s);
  out = out.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+|tel:[^)\s]+|#[^)\s]*)\)/g, (m, t, u) =>
    `<a href="${u}"${u.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`);
  out = out.replace(/\{jp:([^}]+)\}/g, '<span class="jp" lang="ja">$1</span>');
  out = out.replace(/\{ltr:([^}]+)\}/g, '<span class="ltr">$1</span>');
  out = out.replace(/\n/g, '<br>');
  return out;
}

export function R(sel, s) { return h(sel, { html: rich(s) }); }

export function btn(label, ico, onclick, cls = '') {
  return h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { type: 'button', onclick, html: (ico ? icon(ico) : '') + `<span>${esc(label)}</span>` });
}

export function linkBtn(label, ico, href, cls = '') {
  return h('a.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { href, target: href.startsWith('http') ? '_blank' : null, rel: 'noopener', html: (ico ? icon(ico) : '') + `<span>${esc(label)}</span>` });
}

export function chip(label, tone = '', ico = '') {
  return h('span.chip' + (tone ? '.' + tone : ''), { html: (ico ? icon(ico) : '') + esc(label) });
}

export function callout(tone, ico, title, text) {
  return h('div.callout.' + tone, { html: icon(ico) },
    h('div', title ? h('b', title) : null, text ? R('div', text) : null));
}

let toastTimer;
export function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = h('div.toast', { role: 'status' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
}

export async function copyText(text, label = 'הועתק') {
  try { await navigator.clipboard.writeText(text); toast(label); }
  catch { toast(text); }
}

export function listItem({ ic, tone = '', t, d, onclick, href }) {
  const inner = [
    h('span.ic' + (tone ? '.' + tone : ''), { html: icon(ic) }),
    h('span.txt', R('span.t', t), d ? R('span.d', d) : null),
    h('span.chev', { html: icon('chev') }),
  ];
  if (href) return h('a.list-item', { href, target: '_blank', rel: 'noopener', style: 'text-decoration:none;color:inherit' }, inner);
  return h('button.list-item', { type: 'button', onclick }, inner);
}

// ---------- overlays (back button on Android / swipe closes the top one) ----------
const stack = [];
export function openOverlay(node, { onClose } = {}) {
  const root = document.getElementById('overlay-root');
  root.append(node);
  stack.push({ node, onClose });
  history.pushState({ ov: stack.length }, '');
  document.body.style.overflow = 'hidden';
}
export function closeOverlay(fromPop = false) {
  const top = stack.pop();
  if (!top) return;
  top.node.remove();
  top.onClose?.();
  if (!stack.length) document.body.style.overflow = '';
  if (!fromPop) history.back();
}
window.addEventListener('popstate', () => { if (stack.length) closeOverlay(true); });

export function overlayShell({ title, sub, cls = '', actions = [] }) {
  const body = h('div.ov-body');
  const node = h('div.ov' + (cls ? '.' + cls : ''), { role: 'dialog', 'aria-modal': 'true' },
    h('div.ov-bar',
      h('button.icon-btn', { type: 'button', 'aria-label': 'סגירה', onclick: () => closeOverlay(), html: icon('x') }),
      h('div.ttl', title, sub ? h('span.s', sub) : null),
      ...actions),
    body);
  return { node, body };
}

// Hebrew dates
const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HE_MONTHS = ['בינואר', 'בפברואר', 'במרץ', 'באפריל', 'במאי', 'ביוני', 'ביולי', 'באוגוסט', 'בספטמבר', 'באוקטובר', 'בנובמבר', 'בדצמבר'];
export function heDate(iso, withDay = true) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (withDay ? `יום ${HE_DAYS[dt.getUTCDay()]}, ` : '') + `${d} ${HE_MONTHS[m - 1]}`;
}
export function shortDate(iso) { const [, m, d] = iso.split('-').map(Number); return `${d}.${m}`; }
export function weekday(iso) { const [y, m, d] = iso.split('-').map(Number); return HE_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; }

// "now" in a time zone, with ?date=YYYY-MM-DD&time=HH:MM preview override
export function nowIn(tz) {
  const p = new URLSearchParams(location.search);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: p.get('date') || `${parts.year}-${parts.month}-${parts.day}`, time: p.get('time') || `${parts.hour}:${parts.minute}` };
}
