// Rinat 23.10: "חלון המרת מטבע מין לשקל".
// Yen → shekel. The rate comes from the internet (ECB via Frankfurter, backup: open.er-api) and is kept on the phone,
// so the screen works offline with the last rate it saw. Before any rate arrives it uses the built-in one below.
import { icon } from './icons.js';
import { h, btn } from './ui.js';
import { store } from './store.js';

const KEY = 'fx';
const MAX_AGE = 6 * 36e5;
const BUILT_IN = { rate: 0.01979, day: '2026-10-22', at: 0 }; // ECB, 22.10.2026

const SOURCES = [
  ['https://api.frankfurter.dev/v1/latest?base=JPY&symbols=ILS', j => [j?.rates?.ILS, j?.date]],
  ['https://open.er-api.com/v6/latest/JPY', j => [j?.rates?.ILS, j?.time_last_update_unix ? new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10) : null]],
];

let pending = null;

async function refresh(force) {
  const cur = store.get(KEY, BUILT_IN);
  if (!force && Date.now() - cur.at < MAX_AGE) return cur;
  if (!navigator.onLine) return cur;
  for (const [url, read] of SOURCES) {
    try {
      const res = await fetch(url, { cache: 'no-store', referrerPolicy: 'no-referrer' });
      if (!res.ok) continue;
      const [rate, day] = read(await res.json());
      // a sane yen→shekel rate is around 0.02; anything far off is a broken answer
      if (!(rate > 0.005 && rate < 0.08)) continue;
      const out = { rate, day: day || new Date().toISOString().slice(0, 10), at: Date.now() };
      store.set(KEY, out);
      return out;
    } catch { /* try the next source */ }
  }
  return cur;
}

const load = () => {
  pending = pending || refresh(false).finally(() => { pending = null; });
  return pending;
};

const num = (n, d = 0) => n.toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d });
const ils = n => num(n, n < 1000 ? 2 : 0);
const dayLabel = iso => { const [, m, d] = iso.split('-'); return `${+d}.${+m}`; };

const AMOUNTS = [100, 500, 1000, 2000, 3000, 5000, 10000, 20000, 50000];

export function yenView() {
  let fx = store.get(KEY, BUILT_IN);
  const input = h('input.fx-input', {
    type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'done',
    placeholder: '0', 'aria-label': 'כמה ין', dir: 'ltr',
  });
  const out = h('div.fx-out');
  const rateLine = h('div.faint');
  const table = h('div.fx-table');
  const yenOf = () => parseFloat(input.value.replace(/[^\d.]/g, '')) || 0;
  const draw = () => {
    const y = yenOf();
    out.replaceChildren(h('bdi', { dir: 'ltr' }, `₪ ${ils(y * fx.rate)}`));
    rateLine.replaceChildren(`1,000 ין = ${ils(1000 * fx.rate)} ש"ח · `,
      fx.at ? `שער מ-${dayLabel(fx.day)}, מתעדכן לבד כשיש אינטרנט` : `שער מ-${dayLabel(fx.day)}. יתעדכן כשיהיה אינטרנט`);
    table.replaceChildren(...AMOUNTS.map(a => h('button.fx-row', {
      type: 'button', 'aria-pressed': String(a === y),
      onclick: () => { input.value = num(a); draw(); },
    }, h('bdi', { dir: 'ltr' }, `¥ ${num(a)}`), h('bdi', { dir: 'ltr' }, `₪ ${ils(a * fx.rate)}`))));
  };
  input.addEventListener('input', () => {
    // keep thousands separators while typing
    const raw = input.value.replace(/[^\d.]/g, '');
    const [int, dec] = raw.split('.');
    input.value = int ? num(+int) + (dec !== undefined ? '.' + dec.slice(0, 2) : '') : raw;
    draw();
  });
  draw();
  load().then(r => { fx = r; draw(); });
  return h('div',
    h('div.screen-head', h('h1', 'המרת מטבע'), h('div.sub', 'מקלידים כמה ין, ורואים כמה זה בשקלים')),
    h('div.card.fx',
      h('label.fx-label', { html: icon('yen') + '<span>כמה ין?</span>' }),
      h('div.fx-field', h('span.fx-cur', '¥'), input),
      h('div.fx-eq', 'בשקלים'),
      out,
      rateLine),
    h('div.btns', { style: 'margin:0 0 8px' },
      btn('לעדכן שער', 'refresh', async () => { fx = await refresh(true); draw(); }, 'sm ghost'),
      btn('לנקות', 'x', () => { input.value = ''; draw(); input.focus(); }, 'sm ghost')),
    h('h2.section', 'סכומים נפוצים'),
    table,
    h('div.faint', { style: 'margin:10px 2px' },
      'זה השער הרשמי. בתשלום בכרטיס אשראי ישראלי הבנק מוסיף עמלת המרה, לכן החיוב בפועל יוצא מעט גבוה יותר.'));
}

// The chip in the clocks row (home screen and every day), next to the weather
export function yenChip() {
  return h('a.clock.wxc', { href: '#/yen' }, h('span.wi', { html: icon('yen') }), h('span.wt', h('b', 'המרת ין לשקל')));
}
