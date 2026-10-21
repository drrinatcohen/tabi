import { icon } from '../icons.js';
import { h, shortDate, nowIn } from '../ui.js';
import { openBook } from '../components.js';
import { openEntry } from './wallet.js';
import { getFile } from '../offline.js';
import { decryptJSON } from '../crypto.js';

// Rinat 20.10: "אין באפליקציה אופציה של חיפוש". One search over everything in the app, also offline.

const SHOP = 'קניות ואוכל';
const GROUPS = [
  ['days', 'בתוכנית של הימים'], ['wallet', 'כרטיסים ומסמכים'], ['hotels', 'מלונות'], ['guides', 'מדריכים'],
  ['shop', 'קניות ואוכל'], ['help', 'עזרה'], ['check', 'רשימת ההכנה'], ['book', 'הספר של דור'],
];
const PER_GROUP = 5;
const SUGGEST = ['שינקנסן', 'מזוודות', 'פטור ממס', 'ICOCA', 'אונסן', 'ראמן', 'HOKA', 'Shibuya'];

// one char in, one char out, so a position in the folded text is the same position in the original
const FOLD = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ', '׳': "'", '’': "'", '‘': "'", '`': "'", '״': '"', '“': '"', '”': '"', '־': '-', '–': '-', '—': '-' };
export function fold(s) {
  let o = '';
  for (const c of String(s)) { const m = FOLD[c] ?? c.toLowerCase(); o += m.length === c.length ? m : c; }
  return o;
}
export const termsOf = q => fold(q).split(/\s+/).filter(Boolean);

// the text the content markup shows on screen (same as rich() without the tags)
const plain = s => String(s || '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)\s]*\)/g, '$1')
  .replace(/\{(?:jp|ltr):([^}]+)\}/g, '$1').replace(/\s*\n\s*/g, ' ').trim();
const htmlText = s => new DOMParser().parseFromString(s || '', 'text/html').body.textContent.replace(/\s+/g, ' ').trim();
const strings = v => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];

// "[**Name**](url): what it is" -> title "Name", body "what it is"
function split(s) {
  const p = plain(s), i = p.indexOf(': ');
  return i > 0 && i < 70 ? [p.slice(0, i), p.slice(i + 2)] : [p.length > 70 ? p.slice(0, 70) + '…' : p, p];
}

let INDEX = null, BOOK = null, bookLoad = null, bookFailed = false;

function buildIndex(app) {
  const d = app.data, out = [];
  const add = r => { r.ft = fold(r.title); r.fb = fold(r.body || ''); out.push(r); };

  for (const day of d.days) {
    const where = `${day.n > 0 ? `יום ${day.n} · ` : ''}${shortDate(day.date)} · ${day.city}`;
    const route = 'day/' + day.id;
    add({ g: 'days', ic: 'map', tone: 'shu', label: where, title: plain(day.title), body: [day.short, day.intro, ...(day.warn || [])].filter(Boolean).map(plain).join(' · '), route, key: plain(day.title) });
    for (const it of day.items || []) {
      if (it.train) {
        const t = d.trains[it.train];
        add({ g: 'days', ic: 'train', tone: 'ai', label: `${where} · ${t.dep || ''}`, title: plain(t.nameHe || t.name), body: strings(t).map(plain).join(' · '), route, key: plain(t.nameHe || t.name) });
        continue;
      }
      add({ g: 'days', ic: it.ic || 'clock', label: where + (it.t ? ' · ' + it.t : ''), title: plain(it.title), body: plain(it.text), route, key: plain(it.title) });
    }
    for (const s of day.ideas || []) { const [t, b] = split(s); add({ g: 'days', ic: 'star', tone: 'gold', label: where, title: t, body: b, route, key: t }); }
    for (const s of day.tips || []) { const [t, b] = split(s); add({ g: 'days', ic: 'info', tone: 'gold', label: where + ' · שווה לדעת', title: t, body: b, route, key: t }); }
    for (const f of [...(day.food || []), ...(day.more || [])]) {
      if (typeof f === 'string') { add({ g: 'days', ic: 'food', label: where + ' · אוכל', title: plain(f), body: '', route, key: plain(f) }); continue; }
      for (const p of f.places || []) add({ g: 'days', ic: 'food', label: where + (f.group ? ' · ' + f.group : ''), title: p.n, body: [p.d, p.h, p.p, p.b].filter(Boolean).join(' · '), route, key: p.n });
    }
  }

  for (const sec of d.wallet) for (const e of sec.entries) {
    const doc = e.doc ? d.docs[e.doc] : null;
    add({
      g: 'wallet', ic: e.ic || sec.ic, tone: e.tone || sec.tone, label: 'כרטיסים · ' + sec.title, title: plain(e.title),
      body: [e.sub, doc?.title, doc?.sub, ...(doc?.fields || []).map(f => f.join(' '))].filter(Boolean).map(plain).join(' · '),
      open: () => openEntry(app, e),
    });
  }

  for (const ho of Object.values(d.hotels)) {
    add({ g: 'hotels', ic: 'bed', tone: 'shu', label: `מלונות · ${shortDate(ho.in)} עד ${shortDate(ho.out)}`, title: ho.name, body: strings(ho).filter(s => s !== ho.name).map(plain).join(' · '), route: 'trip/hotels', key: ho.name });
  }

  for (const g of d.guides) {
    const grp = g.group === SHOP ? 'shop' : 'guides', route = 'guide/' + g.id;
    add({ g: grp, ic: g.ic, tone: g.tone, label: grp === 'shop' ? 'קניות ואוכל' : 'מדריכים · ' + g.group, title: g.title, body: g.sub || '', route, key: g.title });
    const body = new DOMParser().parseFromString(g.html, 'text/html').body;
    let head = '';
    for (const el of body.querySelectorAll('h2,h3,p,li,div,tr')) {
      if (el.tagName === 'H2') head = el.textContent.trim();
      const c = el.cloneNode(true);
      c.querySelectorAll('ul,ol').forEach(x => x.remove()); // a sub-list is its own result
      const text = c.textContent.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const isHead = /^H[23]$/.test(el.tagName);
      add({ g: grp, ic: g.ic, tone: g.tone, label: g.title + (head && !isHead ? ' · ' + head : ''), title: isHead ? text : (head || g.title), body: isHead ? '' : text, route, key: text.slice(0, 40), noTitle: !isHead });
    }
  }

  const hp = d.help;
  add({ g: 'help', ic: 'buoy', tone: 'moss', label: 'עזרה', title: 'נשימה', body: plain(hp.calm), route: 'help', key: plain(hp.calm).slice(0, 30) });
  for (const n of hp.numbers || []) add({ g: 'help', ic: 'phone', tone: 'shu', label: 'עזרה · מספרים חשובים', title: plain(n.label), body: [n.tel, n.note].filter(Boolean).map(plain).join(' · '), route: 'help', key: plain(n.label) });
  for (const s of hp.scenarios || []) add({ g: 'help', ic: 'alert', tone: 'shu', label: 'עזרה · אם קורה ש...', title: s.q, body: htmlText(s.html), route: 'help', key: s.q });
  if (hp.insurance) add({ g: 'help', ic: 'shield', label: 'עזרה · ביטוח', title: 'ביטוח', body: strings(hp.insurance).map(plain).join(' · '), route: 'help', key: plain(hp.insurance.text || '').slice(0, 30) });
  for (const c of [...(hp.cancel || []), ...(hp.charges || [])]) add({ g: 'help', ic: 'cal', label: 'עזרה · ' + (c.until ? 'ביטול בחינם עד' : 'חיובים שעוד יורדים'), title: plain(c.hotel), body: plain(c.until || c.when), route: 'help', key: plain(c.hotel) });
  for (const s of [hp.cancelNote, hp.chargesNote].filter(Boolean)) add({ g: 'help', ic: 'info', label: 'עזרה', title: split(s)[0], body: plain(s), route: 'help', key: plain(s).slice(0, 30), noTitle: true });

  // the checklist is on the home screen only until the day of the flight
  if (nowIn('Asia/Jerusalem').date <= '2026-10-24') {
    for (const c of d.checklist || []) add({ g: 'check', ic: 'check', tone: 'moss', label: 'רשימת ההכנה במסך הבית', title: plain(c.text), body: plain(c.when), route: 'today', key: plain(c.text).slice(0, 30) });
  }
  return out;
}

// Dor's book is a separate encrypted file, read only when someone searches
function loadBook(app, then) {
  if (BOOK || !app.data.bookText) return;
  bookLoad ||= getFile(app.data.bookText).then(buf => decryptJSON(app.key, buf)).then(pages => {
    const dayOf = p => app.data.days.find(d => d.book && d.book[0] <= p && p <= d.book[1]);
    BOOK = pages.map(({ p, t }) => {
      const day = dayOf(p);
      return { g: 'book', ic: 'book', tone: 'ai', label: `הספר של דור · עמוד ${p}` + (day ? ` · ${shortDate(day.date)} ${day.city}` : ''), title: `עמוד ${p}`, body: t, ft: '', fb: fold(t), page: p, lines: true, noTitle: true };
    });
  }).catch(e => { console.warn('book text', e); bookLoad = null; bookFailed = true; });
  bookLoad.then(() => { if (BOOK) then(); });
}

export function search(app, q) {
  INDEX ||= buildIndex(app);
  const terms = termsOf(q);
  if (!terms.length) return { terms, hits: [] };
  const phrase = terms.join(' ');
  const hits = [];
  for (const r of BOOK ? INDEX.concat(BOOK) : INDEX) {
    const all = r.ft + ' ' + r.fb;
    if (!terms.every(t => all.includes(t))) continue;
    let s = 0;
    for (const t of terms) { if (r.ft.includes(t)) s += 10; if (r.ft.startsWith(t)) s += 3; }
    if (terms.length > 1 && all.includes(phrase)) s += 6;
    hits.push({ r, s });
  }
  return { terms, hits };
}

// ---------- marking the words ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function ranges(text, terms) {
  const f = fold(text), rs = [];
  for (const t of terms) for (let i = f.indexOf(t); i !== -1; i = f.indexOf(t, i + t.length)) rs.push([i, i + t.length]);
  rs.sort((a, b) => a[0] - b[0]);
  const m = [];
  for (const r of rs) { const last = m[m.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else m.push([...r]); }
  return m;
}

export function marked(text, terms) {
  let out = '', at = 0;
  for (const [a, b] of ranges(text, terms)) { out += esc(text.slice(at, a)) + '<mark class="hl">' + esc(text.slice(a, b)) + '</mark>'; at = b; }
  return out + esc(text.slice(at));
}

// a short piece of the text around the first word found
function snippet(r, terms, n = 130) {
  let text = r.body || '';
  if (r.lines) { // the book: the line where the word is, and the next one
    const ls = text.split('\n'), fl = ls.map(fold);
    const i = Math.max(0, fl.findIndex(l => terms.some(t => l.includes(t))));
    text = ls.slice(i, i + 2).join(' ');
  }
  const f = fold(text);
  const first = Math.min(...terms.map(t => f.indexOf(t)).filter(i => i >= 0));
  if (!isFinite(first) || first < 60 || text.length <= n) return text.length > n ? text.slice(0, n).trimEnd() + '…' : text;
  let start = text.lastIndexOf(' ', first - 40);
  start = start < 0 ? 0 : start + 1;
  const end = Math.min(text.length, start + n);
  return '…' + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}

// ---------- after opening a result: find it on the screen, open it, mark it ----------
const SPOTS = '.tl-item, .place, .callout, .card li, .card.hotel, .list-item, details, .prose p, .prose li, .prose h2, .prose h3, .prose .note, .prose .warn, .prose .ok, .prose tr, .card';

export function showHit(root, { terms, key }) {
  const els = [...root.querySelectorAll(SPOTS)].filter(el => !el.closest('.nowbox, .search-box'));
  const txt = new Map(els.map(el => [el, fold(el.textContent)]));
  const fk = key ? fold(key) : null;
  const shortest = list => list.sort((a, b) => txt.get(a).length - txt.get(b).length)[0];
  const withTerms = els.filter(el => terms.every(t => txt.get(el).includes(t)));
  const target = (fk && shortest(withTerms.filter(el => txt.get(el).includes(fk)))) || (fk && shortest(els.filter(el => txt.get(el).includes(fk)))) || shortest(withTerms);
  if (!target) return null;
  target.closest('details')?.setAttribute('open', '');
  target.closest('.tl-item')?.classList.add('open');
  for (const c of [target.closest('.clamp'), ...target.querySelectorAll('.clamp')].filter(Boolean)) {
    c.classList.add('open');
    const b = c.nextElementSibling;
    if (b?.classList.contains('more')) { b.textContent = 'פחות'; b.setAttribute('aria-expanded', 'true'); }
  }
  markIn(target, terms);
  target.classList.add('hit');
  setTimeout(() => target.classList.remove('hit'), 2600);
  target.scrollIntoView({ block: 'center' });
  return target;
}

function markIn(el, terms) {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('svg, mark, button.more') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = [];
  while (walk.nextNode()) nodes.push(walk.currentNode);
  for (const n of nodes) {
    const rs = ranges(n.data, terms);
    if (!rs.length) continue;
    const frag = document.createDocumentFragment();
    let at = 0;
    for (const [a, b] of rs) {
      frag.append(n.data.slice(at, a), h('mark.hl', n.data.slice(a, b)));
      at = b;
    }
    frag.append(n.data.slice(at));
    n.replaceWith(frag);
  }
}

// ---------- the screen ----------
export function searchView(app, q0 = '') {
  const input = h('input.search-input', {
    type: 'search', enterkeyhint: 'search', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false',
    placeholder: 'מקום, מלון, רכבת, מספר הזמנה...', 'aria-label': 'חיפוש בכל האפליקציה',
  });
  input.value = q0;
  const clear = h('button.search-clear', { type: 'button', 'aria-label': 'ניקוי', html: icon('x'), hidden: !q0 });
  const results = h('div.search-results', { 'aria-live': 'polite' });
  const open = new Set(); // groups showing all their results

  const go = (r, terms) => {
    if (r.open) return r.open();
    if (r.page) return openBook(app, r.page, r.page, `הספר של דור · עמוד ${r.page}`);
    app.hit = { terms, key: r.key };
    app.go(r.route);
  };

  const row = (r, terms) => h('button.list-item.result', { type: 'button', onclick: () => go(r, terms) },
    h('span.ic' + (r.tone ? '.' + r.tone : ''), { html: icon(r.ic || 'info') }),
    h('span.txt',
      h('span.l', r.label),
      r.noTitle ? null : h('span.t', { html: marked(r.title, terms) }),
      r.body ? h('span.d', { html: marked(snippet(r, terms), terms) }) : null),
    h('span.chev', { html: icon('chev') }));

  const draw = () => {
    const q = input.value.trim();
    clear.hidden = !input.value;
    if (!q) {
      results.replaceChildren(
        h('div.card.tint-ai',
          h('b', 'מחפש בכל האפליקציה, גם בלי אינטרנט: '),
          'התוכנית של כל יום, כרטיסים ומספרי הזמנה, מלונות, מדריכים, קניות ואוכל, עזרה, והטקסט של הספר של דור.'),
        h('h2.section', 'אפשר לנסות'),
        h('div.suggest', SUGGEST.map(s => h('button.chip', { type: 'button', onclick: () => { input.value = s; update(); } }, s))));
      return;
    }
    const { terms, hits } = search(app, q);
    if (!hits.length) {
      results.replaceChildren(h('div.card',
        h('b', `לא נמצא "${q}".`),
        h('div.muted', { style: 'margin-top:4px' }, BOOK || bookFailed || !app.data.bookText ? 'אפשר לנסות מילה אחת, חלק ממילה, או באנגלית (למשל Kyoto).' : 'מחפש גם בספר של דור...')));
      return;
    }
    const by = {};
    for (const x of hits) (by[x.r.g] ||= []).push(x);
    results.replaceChildren(
      h('div.faint', { style: 'margin:2px 4px 6px' }, hits.length === 1 ? 'תוצאה אחת' : `${hits.length} תוצאות`),
      ...GROUPS.filter(([g]) => by[g]).map(([g, name]) => {
        const list = by[g].sort((a, b) => b.s - a.s).map(x => x.r);
        const shown = open.has(g) ? list : list.slice(0, PER_GROUP);
        return h('section',
          h('h2.section', name, h('span.count', String(list.length))),
          shown.map(r => row(r, terms)),
          list.length > shown.length
            ? h('button.btn.sm.ghost.block', { type: 'button', onclick: () => { open.add(g); draw(); } }, `עוד ${list.length - shown.length} ב${name}`) : null);
      }));
  };

  let timer;
  const update = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      open.clear();
      const q = input.value.trim();
      // the words stay in the address, so "back" from a result returns to the same results
      history.replaceState(history.state, '', '#/search' + (q ? '/' + encodeURIComponent(q) : ''));
      draw();
    }, 120);
  };
  input.addEventListener('input', update);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); }); // hide the keyboard to see the results
  clear.addEventListener('click', () => { input.value = ''; update(); input.focus(); });

  draw();
  loadBook(app, () => { if (results.isConnected && input.value.trim()) draw(); });

  return h('div',
    h('div.screen-head', h('h1', 'חיפוש'), h('div.sub', 'בכל האפליקציה, גם בלי אינטרנט')),
    h('div.search-box', h('label.search-field', { html: icon('search') }, input, clear)),
    results);
}

export function searchBar(app) {
  return h('button.searchbar', { type: 'button', onclick: () => app.openSearch(), html: icon('search') + '<span>חיפוש בכל האפליקציה</span>' });
}
