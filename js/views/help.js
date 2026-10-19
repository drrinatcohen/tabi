import { icon } from '../icons.js';
import { h, R, btn, linkBtn, callout, chip, toast } from '../ui.js';
import { store } from '../store.js';
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
      h('div.row.between',
        h('div', h('div', { style: 'font-weight:800' }, n.label), n.note ? R('div.faint', n.note) : null),
        h('div.row', { style: 'gap:6px;flex:none' },
          n.wa ? linkBtn('וואטסאפ', 'share', 'https://wa.me/' + n.wa.replace(/\D/g, ''), 'sm') : null,
          n.tel ? linkBtn(n.tel, 'phone', 'tel:' + n.tel.replace(/[^\d+]/g, ''), 'sm primary') : null)))),

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

    h('h2.section', { html: icon('sliders') + 'הגדרות' }),
    h('div.card',
      h('div.row.between', h('div', h('b', 'הטלפון הזה של: '), app.name(app.who)),
        btn('להחליף', 'refresh', () => { store.set('who', app.partner()); app.who = app.partner(); toast('עכשיו: ' + app.name(app.who)); app.rerender(); }, 'sm')),
      h('div.hr'),
      h('div.row.between', h('b', 'מראה'),
        h('div.seg', { style: 'margin:0;flex:0 0 auto' },
          ['auto', 'light', 'dark'].map(t => h('button', { type: 'button', 'aria-pressed': String(theme === t), onclick: () => setTheme(t), style: 'padding:0 12px' }, { auto: 'אוטומטי', light: 'יום', dark: 'לילה' }[t])))),
      h('div.hr'),
      h('div', { 'data-offline': '' }),
      h('div.btns', btn('לבדוק עדכונים', 'refresh', () => location.reload(), 'sm')),
      h('div.faint', { style: 'margin-top:8px' }, `גרסה ${app.ver.v.slice(0, 8)} · התוכן מוצפן ונפתח רק עם הקישור שלכם`)));
}

export function applyTheme() {
  const t = store.get('theme', 'auto');
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
applyTheme();
