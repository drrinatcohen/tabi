import { icon } from './icons.js';
import { h, R, rich, btn, linkBtn, chip, callout, toast, copyText, openOverlay, overlayShell, closeOverlay, heDate, shortDate } from './ui.js';
import { store } from './store.js';

// ---------- image helpers ----------
export function lazyImg(app, id, alt = '') {
  const a = app.asset(id) || {};
  const img = h('img', { alt, width: a.w, height: a.h, decoding: 'async', style: a.w ? `aspect-ratio:${a.w}/${a.h}` : null });
  app.assetURL(id).then(u => { img.src = u; }).catch(() => { img.alt = 'הקובץ עוד לא נשמר בטלפון'; });
  return img;
}

// ---------- QR full screen ----------
let wakeLock = null;
async function keepAwake() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* ignore */ } }
function releaseAwake() { try { wakeLock?.release(); } catch { /* ignore */ } wakeLock = null; }

export function openQR(app, { title, sub, images, info, hint }) {
  let who = images[app.who] ? app.who : Object.keys(images)[0];
  const { node, body } = overlayShell({ title, sub, cls: 'qr-screen' });
  body.className = 'qr-wrap';
  const draw = () => {
    const sw = Object.keys(images).length > 1
      ? h('div.qr-switch', Object.keys(images).map(p =>
        h('button.btn.sm', { type: 'button', 'aria-pressed': String(p === who), onclick: () => { who = p; draw(); } }, (p === app.who ? 'שלי · ' : '') + app.name(p))))
      : null;
    body.replaceChildren(
      sw,
      info?.[who] ? h('div', { style: 'font-weight:800;font-size:20px;text-align:center', html: rich(info[who]) }) : null,
      lazyImg(app, images[who], 'ברקוד'),
      h('div.qr-hint', hint || 'להגביר את בהירות המסך עד הסוף ולהחזיק את הטלפון יציב מעל הסורק'),
    );
  };
  draw();
  keepAwake();
  openOverlay(node, { onClose: releaseAwake });
}

// ---------- documents (rendered pages, tap to zoom) ----------
export function openDoc(app, { title, sub, pages, fields }) {
  const { node, body } = overlayShell({
    title, sub,
    actions: [h('button.icon-btn', { type: 'button', 'aria-label': 'הגדלה', html: icon('zoom'), onclick: () => body.classList.toggle('zoom') })],
  });
  body.classList.add('pages');
  if (fields?.length) body.append(fieldsCard(fields));
  for (const id of pages) body.append(h('div.page-img', lazyImg(app, id, title)));
  openOverlay(node);
}

export function fieldsCard(fields) {
  return h('div.card', { style: 'margin:0 0 10px' }, h('dl.kv', { style: 'margin:0' },
    fields.flatMap(([k, v]) => [h('dt', k), h('dd', h('span.copy', { dir: /[֐-׿]/.test(v) ? null : 'ltr', onclick: () => copyText(v, 'הועתק: ' + v) }, v))])));
}

// ---------- Dor's book pages with clickable map links ----------
export function openBook(app, from, to, title = 'מהספר של דור') {
  const { node, body } = overlayShell({
    title, sub: `עמודים ${from}${to && to !== from ? '-' + to : ''} · הקישורים לחיצים`,
    actions: [h('button.icon-btn', { type: 'button', 'aria-label': 'הגדלה', html: icon('zoom'), onclick: () => body.classList.toggle('zoom') })],
  });
  body.classList.add('pages');
  for (let p = from; p <= (to || from); p++) {
    const id = 'book_' + String(p).padStart(3, '0');
    const a = app.asset(id);
    if (!a) continue;
    const box = h('div.page-img', lazyImg(app, id, 'עמוד ' + p));
    for (const l of a.links || []) {
      box.append(h('a.hot', { href: l.uri, target: '_blank', rel: 'noopener', 'aria-label': 'קישור',
        style: `left:${l.x}%;top:${l.y}%;width:${l.w}%;height:${l.h}%` }));
    }
    body.append(box);
  }
  openOverlay(node);
}

// ---------- taxi / address card ----------
export function openTaxi(hotel) {
  const { node, body } = overlayShell({ title: 'להראות לנהג', sub: hotel.name, cls: 'taxi' });
  body.append(
    h('div.please.jp', { lang: 'ja' }, 'この住所までお願いします'),
    h('div.hname.jp', { lang: 'ja' }, hotel.nameJp),
    h('div.addr.jp', { lang: 'ja' }, hotel.addrJp),
    hotel.phone ? h('div.jp', { lang: 'ja', style: 'font-size:22px' }, '☎ ' + hotel.phone) : null,
    h('div.en', hotel.name + ' · ' + hotel.addrEn),
  );
  keepAwake();
  openOverlay(node, { onClose: releaseAwake });
}

// ---------- train card: the heart of the "no stress" part ----------
export function trainQrBtn(app, t, cls = 'primary') {
  const me = app.who, other = app.partner();
  return btn('הברקוד שלי', 'qr', () => openQR(app, {
    title: `${t.nameHe} · ${t.dep}`, sub: `${t.from.he} ← ${t.to.he}`,
    images: t.qr, info: { [me]: `קרון ${t.car} · מושב {ltr:${t.seats[me]}}`, [other]: `קרון ${t.car} · מושב {ltr:${t.seats[other]}}` },
    hint: 'בשער עם הסימון QR: להחזיק את הברקוד מעל הסורק, לקחת את הפתק שיוצא, ולהשאיר את הברקוד פתוח גם ליציאה בתחנת היעד',
  }), cls);
}

export function trainCard(app, t, { open = false } = {}) {
  const me = app.who, other = app.partner();
  const stepsBox = h('div', { hidden: !open },
    h('h3', { style: 'margin-top:6px' }, 'צעד אחר צעד'),
    h('ol.steps', t.steps.map(s => R('li', s))),
    t.missed ? callout('gold', 'info', 'אם פספסנו את הרכבת', t.missed) : null,
    t.note ? callout('ai', 'info', null, t.note) : null);
  const toggle = btn(open ? 'להסתיר את הצעדים' : 'צעד אחר צעד', 'compass', () => {
    stepsBox.hidden = !stepsBox.hidden;
    toggle.querySelector('span').textContent = stepsBox.hidden ? 'צעד אחר צעד' : 'להסתיר את הצעדים';
  });
  return h('div.train',
    h('div.top',
      h('div.row.between', h('span.name', t.nameHe, ' · ', h('bdi', t.name)), h('span.name', heDate(t.date))),
      h('div.route',
        h('div.stn', h('div.time', t.dep), h('div.place', t.from.he, h('span.en', t.from.en))),
        h('div.arrow', { html: icon('arrow') }),
        h('div.stn.to', h('div.time', t.arr), h('div.place', t.to.he, h('span.en', t.to.en))))),
    h('div.seats',
      h('div.seat.me', h('div.who', app.name(me) + ' · שלי'), h('div.val', h('div', `קרון ${t.car}`), h('div.nw', 'מושב ', h('bdi', t.seats[me])))),
      h('div.seat', h('div.who', app.name(other)), h('div.val', h('div', `קרון ${t.car}`), h('div.nw', 'מושב ', h('bdi', t.seats[other]))))),
    h('div.body',
      t.platform ? h('div.row.wrap', { style: 'gap:6px;margin-bottom:6px' }, chip(t.platform, 'ai', 'train'), t.gate ? chip(t.gate, 'shu', 'qr') : null) : null,
      h('div.btns',
        trainQrBtn(app, t),
        toggle),
      stepsBox));
}

// ---------- hotel card ----------
export function hotelCard(app, ho, { compact = false } = {}) {
  const nights = Math.round((Date.parse(ho.out) - Date.parse(ho.in)) / 864e5);
  return h('div.card.hotel',
    h('div.row.between', { style: 'align-items:flex-start' },
      h('div', h('div.name', ho.name), h('div.jpname.jp', { lang: 'ja' }, ho.nameJp)),
      chip(`${nights} ${nights === 1 ? 'לילה' : 'לילות'}`, 'shu', 'bed')),
    h('dl.kv',
      h('dt', 'תאריכים'), h('dd', `${shortDate(ho.in)} עד ${shortDate(ho.out)}`),
      h('dt', 'צ\'ק-אין'), h('dd', ho.checkin),
      h('dt', 'צ\'ק-אאוט'), h('dd', ho.checkout),
      ho.breakfast ? [h('dt', 'ארוחות'), R('dd', ho.breakfast)] : null,
      ho.station ? [h('dt', 'תחנה קרובה'), R('dd', ho.station)] : null),
    h('div.btns',
      btn('כתובת לנהג', 'car', () => openTaxi(ho), 'primary'),
      linkBtn('ניווט', 'pin', ho.map),
      ho.docs?.length ? btn('השובר', 'ticket', () => openDoc(app, { title: ho.name, sub: 'אישור הזמנה', pages: ho.docs.flatMap(d => app.data.docPages[d] || []), fields: ho.fields })) : null,
      ho.phone ? linkBtn('חיוג', 'phone', 'tel:' + ho.tel) : null),
    compact ? null : [
      ho.cancel ? R('div.faint', '🗓️ ' + ho.cancel) : null,
      ho.payment ? R('div.faint', '💳 ' + ho.payment) : null,
      ho.tips?.length ? h('div', { style: 'margin-top:10px' }, h('h3', 'טיפים למלון'), h('ul', { style: 'margin:0;padding-inline-start:20px' }, ho.tips.map(t => R('li', t)))) : null,
      ho.book ? h('div.btns', btn('העמוד של המלון בספר של דור', 'book', () => openBook(app, ho.book, ho.book, ho.name), 'ghost')) : null,
    ]);
}

// ---------- timeline ----------
// minutes of the day from "09:30" / "~08:45"; an evening item without an hour counts as 18:00
export function itemMinutes(app, it) {
  const t = it.train ? app.data.trains[it.train]?.dep : it.t;
  if (t === 'ערב') return 18 * 60;
  const m = /(\d{1,2}):(\d{2})/.exec(t || '');
  return m ? +m[1] * 60 + +m[2] : null;
}

// Rinat 20.10 (design upgrade): a recommendation shows 3 lines, the rest under "עוד פרטים"; a booking always shows everything.
const LONG = 170;
function moreToggle(d) {
  const b = h('button.more', { type: 'button', 'aria-expanded': 'false' }, 'עוד פרטים');
  b.addEventListener('click', e => {
    e.stopPropagation();
    const open = d.classList.toggle('open');
    b.textContent = open ? 'פחות' : 'עוד פרטים';
    b.setAttribute('aria-expanded', String(open));
  });
  // if the text fits in 3 lines anyway, no button
  requestAnimationFrame(() => { if (d.isConnected && d.scrollHeight <= d.clientHeight + 2) { d.classList.remove('clamp'); b.remove(); } });
  return b;
}

export function timeline(app, items) {
  return h('ol.timeline', items.map(it => {
    const m = itemMinutes(app, it);
    if (it.train) return h('li.tl-train', { style: 'list-style:none;margin-bottom:12px', 'data-m': m ?? '' }, trainCard(app, app.data.trains[it.train]));
    // Rinat 19.10: an item with a time looks like a booking, so every item says which it is.
    const tag = it.booked ? chip('מוזמן', 'moss', 'check')
      : it.buy ? chip(it.buy, 'shu', 'ticket')
        : it.rec === 'dor' ? chip('המלצה של דור, אין הזמנה', 'gold')
          : it.rec ? chip('המלצה, אין הזמנה') : null;
    const long = it.text && !it.booked && !it.key && it.text.replace(/\*\*|\[|\]\([^)]*\)/g, '').length > LONG;
    const d = it.text ? R('div.d' + (long ? '.clamp' : ''), it.text) : null;
    const li = h('li.tl-item' + (it.key ? '.key' : '') + (it.booked ? '.booked' : ''), { 'data-m': m ?? '' },
      h('div.tl-time', h('div.dot', { html: icon(it.ic || 'clock') }), it.t || ''),
      h('div.tl-body',
        R('div.t', it.title),
        tag ? h('div.tl-tag', tag) : null,
        d,
        long ? moreToggle(d) : null,
        it.actions?.length ? h('div.btns', it.actions.map(a => actionBtn(app, a))) : null));
    // a past item is folded to its title; a tap opens it again
    li.querySelector('.tl-body').addEventListener('click', e => {
      if (li.classList.contains('past') && !e.target.closest('a,button')) li.classList.toggle('open');
    });
    return li;
  }));
}

// ---------- food: one place per row (name opens Dor's map pin, then what it is, hours, price, booking) ----------
export function foodList(items) {
  const row = p => h('div.place',
    h('a.pn', { href: 'https://maps.app.goo.gl/' + p.c, target: '_blank', rel: 'noopener', html: icon('pin') }, h('span', p.n)),
    p.d ? h('div.pd', p.d) : null,
    h('div.pc',
      p.h ? chip(p.h, '', 'clock') : null,
      p.p ? chip(p.p, '', 'yen') : null,
      p.b ? chip(p.b, /חובה/.test(p.b) && !/לא חובה/.test(p.b) ? 'shu' : /מומלץ/.test(p.b) ? 'gold' : '') : null));
  const plain = items.filter(x => typeof x === 'string');
  return h('div',
    plain.length ? h('div.card', h('ul', { style: 'margin:0;padding-inline-start:20px' }, plain.map(t => R('li', t)))) : null,
    items.filter(x => typeof x !== 'string').map(g => h('div.card.food',
      g.group ? h('div.fg', g.group) : null,
      g.places.map(row))));
}

export function actionBtn(app, a) {
  const d = app.data;
  switch (a.type) {
    case 'qr': {
      const q = d.qrs[a.id];
      return btn(a.label || 'הברקוד שלי', 'qr', () => openQR(app, q), 'sm primary');
    }
    case 'doc': {
      const doc = d.docs[a.id];
      return btn(a.label || 'השובר', 'ticket', () => openDoc(app, { title: doc.title, sub: doc.sub, pages: doc.pages, fields: doc.fields }), 'sm');
    }
    case 'map': return linkBtn(a.label || 'מפה', 'pin', a.url, 'sm');
    case 'link': return linkBtn(a.label, 'ext', a.url, 'sm');
    case 'call': return linkBtn(a.label, 'phone', 'tel:' + a.tel, 'sm');
    case 'guide': return btn(a.label || 'המדריך', 'compass', () => app.go('guide/' + a.id), 'sm');
    case 'book': return btn(a.label || 'בספר של דור', 'book', () => openBook(app, a.from, a.to), 'sm ghost');
    case 'taxi': return btn(a.label || 'כתובת לנהג', 'car', () => openTaxi(d.hotels[a.id]), 'sm');
    default: return null;
  }
}

// ---------- journal: one line per day, per phone ----------
export function journal(app, day) {
  const key = 'journal:' + day.date;
  const ta = h('textarea.journal', { placeholder: 'שורה אחת על היום הזה: רגע, טעם, משפט שאמרנו...', 'aria-label': 'יומן' });
  ta.value = store.get(key, '');
  ta.addEventListener('input', () => store.set(key, ta.value));
  const share = async () => {
    const text = `${heDate(day.date)} · ${day.city}\n${ta.value}`;
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelled */ } }
    else copyText(text, 'הועתק. אפשר להדביק בוואטסאפ');
  };
  return h('div.card.tint-gold',
    h('div.row.between', h('h3', { style: 'margin:0' }, 'הרגע של היום'), chip('נשמר רק בטלפון הזה', '', 'lock')),
    h('div.faint', { style: 'margin:4px 0 8px' }, 'בסוף הטיול יהיה לכל אחד מכם יומן של 17 שורות.'),
    ta,
    h('div.btns', btn('לשלוח ל' + app.name(app.partner()), 'share', share, 'sm')));
}

export { rich };
