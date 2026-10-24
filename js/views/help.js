import { icon } from '../icons.js';
import { h, R, btn, linkBtn, callout, chip, toast } from '../ui.js';
import { store, persist, wipeAll } from '../store.js';
import { openDoc } from '../components.js';

export function helpView(app) {
  const d = app.data.help;
  const theme = store.get('theme', 'auto');
  const setTheme = (t) => { store.set('theme', t); applyTheme(); app.rerender(); };

  return h('div',
    h('div.screen-head', h('h1', 'עזרה ורוגע'), h('div.sub', 'כל מה שצריך אם משהו לא הולך לפי התוכנית')),
    R('div.card.tint-moss', d.calm),

    h('h2.section', { html: icon('phone') + 'מספרים חשובים' }),
    d.numbers.map(n => h('div.card', { style: 'padding:12px 14px' },
      h('div.row.between', { style: 'flex-wrap:wrap;gap:8px' },
        h('div', h('div', { style: 'font-weight:800' }, n.label), n.note ? R('div.faint', n.note) : null),
        h('div.row', { style: 'gap:6px;flex-wrap:wrap' },
          n.wa ? linkBtn('וואטסאפ', 'share', 'https://wa.me/' + n.wa.replace(/\D/g, ''), 'sm') : null,
          n.tel ? linkBtn(n.tel, 'phone', 'tel:' + n.tel.replace(/[^\d+]/g, ''), 'sm primary num') : null)))),

    h('h2.section', { html: icon('alert') + 'אם קורה ש...' }),
    d.scenarios.map(s => h('details.card', { style: 'padding:0' },
      h('summary', { style: 'padding:14px 16px;font-weight:800;cursor:pointer' }, s.q),
      h('div.prose', { style: 'padding:0 16px 14px', html: s.html }))),

    h('h2.section', { html: icon('shield') + 'ביטוח' }),
    h('div.card',
      R('div', d.insurance.text),
      h('div.btns',
        btn('הפוליסה', 'shield', () => { const doc = app.data.docs.insurance; openDoc(app, { title: doc.title, sub: doc.sub, pages: doc.pages, fields: doc.fields }); }),
        linkBtn('מוקד הראל 24/7', 'phone', 'tel:+97237547030', 'primary'))),

    h('h2.section', { html: icon('cal') + 'ביטול מלונות בחינם עד' }),
    h('div.card', h('dl.kv', { style: 'margin:0' }, d.cancel.flatMap(c => [h('dt', c.hotel), R('dd', c.until)]))),
    R('div.faint', d.cancelNote),

    d.charges?.length ? [
      h('h2.section', { html: icon('ticket') + 'חיובים שעוד יורדים מהאשראי' }),
      h('div.card', h('dl.kv', { style: 'margin:0' }, d.charges.flatMap(c => [h('dt', c.hotel), R('dd', c.when)]))),
      R('div.faint', d.chargesNote),
    ] : null,

    h('h2.section', { html: icon('sliders') + 'הגדרות' }),
    h('div.card',
      h('div.row.between', h('div', h('b', 'הטלפון הזה של: '), app.name(app.who)),
        btn('להחליף', 'refresh', () => { persist('who', app.partner()); app.who = app.partner(); toast('עכשיו: ' + app.name(app.who)); app.rerender(); }, 'sm')),
      h('div.hr'),
      h('div.row.between', h('b', 'מראה'),
        h('div.seg', { style: 'margin:0;flex:0 0 auto' },
          ['auto', 'light', 'dark'].map(t => h('button', { type: 'button', 'aria-pressed': String(theme === t), onclick: () => setTheme(t), style: 'padding:0 12px' }, { auto: 'אוטומטי', light: 'יום', dark: 'לילה' }[t])))),
      h('div.hr'),
      h('div', { 'data-offline': '' }),
      h('div.btns', btn('לבדוק עדכונים', 'refresh', () => location.reload(), 'sm')),
      h('div.faint', { style: 'margin-top:8px' }, `גרסה ${app.ver.v.slice(0, 8)} · התוכן מוצפן ונפתח רק עם הקישור שלכם`),
      h('div.hr'),
      wipeRow(app)));
}

// Rinat 20.10: "בעזרה, בהגדרות, שבלחיצת כפתור ימחקו כל הקבצים שנשמרו מהאפליקציה". Two taps, with a clear warning.
function wipeRow(app) {
  const box = h('div');
  const wipe = async (e) => {
    e.currentTarget.disabled = true;
    await wipeAll();
    for (const u of app.urls.values()) URL.revokeObjectURL(u);
    app.urls.clear();
    app.data = null; app.key = null;
    document.getElementById('overlay-root').replaceChildren();
    document.body.style.overflow = '';
    history.replaceState(null, '', location.pathname);
    document.getElementById('app').replaceChildren(h('div.unlock',
      h('div.seal', { style: 'margin:0 auto' }, '旅'),
      h('h1.center', { style: 'margin:6px 0 0;font-size:28px' }, 'הכול נמחק מהטלפון הזה'),
      h('p.center.muted', 'אפשר גם להסיר את סמל האפליקציה ממסך הבית.'),
      h('p.center.muted', 'כדי לפתוח שוב: לפתוח את הקישור מהוואטסאפ, או ללחוץ כאן ולהקליד את מילת הקוד. צריך אינטרנט.'),
      h('button.btn.primary.block', { type: 'button', onclick: () => location.replace(location.pathname) }, 'לפתוח מחדש')));
    window.scrollTo(0, 0);
    setTimeout(wipeAll, 3000); // a file that was still downloading when the button was pressed
  };
  const confirm = () => { box.replaceChildren(h('div.wipe',
    R('div', '**למחוק את כל המידע של האפליקציה מהטלפון הזה?**\n'
      + 'יימחקו המסמכים, הברקודים, הצ\'קליסט **והיומן שנכתב בטלפון הזה**. אי אפשר לשחזר.\n'
      + `בטלפון של ${app.name(app.partner())} שום דבר לא משתנה.\n`
      + 'כדי לפתוח שוב צריך אינטרנט, ואת הקישור מהוואטסאפ או את מילת הקוד.'),
    h('div.btns', btn('כן, למחוק הכול', 'trash', wipe, 'danger'), btn('ביטול', null, closed, 'ghost'))));
    box.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  const closed = () => box.replaceChildren(h('div.row.between',
    h('div', h('b', 'מחיקת כל המידע מהטלפון הזה'), h('div.faint', 'מסמכים, ברקודים, צ\'קליסט ויומן')),
    btn('למחוק', 'trash', confirm, 'sm danger-ghost')));
  closed();
  return box;
}

export function applyTheme() {
  const t = store.get('theme', 'auto');
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
applyTheme();
