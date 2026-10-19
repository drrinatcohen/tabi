// Weather forecast for each day's places (Open-Meteo: free, no key, up to 16 days ahead).
// Needs internet; every forecast that arrives is kept on the phone, so the last one still shows offline.
import { icon } from './icons.js';
import { h, btn, shortDate } from './ui.js';
import { store } from './store.js';

const KEY = 'wx';
const MAX_AGE = 3 * 36e5;
const AHEAD = 15;

// WMO weather codes → Hebrew text + icon
const CODES = [
  [[0], 'בהיר', 'sun'], [[1], 'בהיר ברובו', 'sun'], [[2], 'מעונן חלקית', 'partly'], [[3], 'מעונן', 'cloud'],
  [[45, 48], 'ערפל', 'fog'], [[51, 53, 55, 56, 57], 'טפטוף', 'rain'], [[61], 'גשם קל', 'rain'], [[63], 'גשם', 'rain'],
  [[65], 'גשם חזק', 'rain'], [[66, 67], 'גשם קפוא', 'rain'], [[71], 'שלג קל', 'snow'], [[73, 77], 'שלג', 'snow'],
  [[75], 'שלג כבד', 'snow'], [[80], 'ממטרים קלים', 'rain'], [[81], 'ממטרים', 'rain'], [[82], 'ממטרים חזקים', 'rain'],
  [[85, 86], 'ממטרי שלג', 'snow'], [[95], 'סופת רעמים', 'storm'], [[96, 99], 'סופת רעמים וברד', 'storm'],
];
const describe = code => CODES.find(([cs]) => cs.includes(code)) || [[], 'לא ידוע', 'cloud'];

const deg = t => h('bdi', { dir: 'ltr' }, `${t}°`);

let pending = null;

async function refresh(app, force) {
  const cur = store.get(KEY, { at: 0, p: {} });
  if (!force && Date.now() - cur.at < MAX_AGE) return cur;
  if (!navigator.onLine) return cur;
  const ids = Object.keys(app.data.wxPlaces || {});
  if (!ids.length) return cur;
  const pl = app.data.wxPlaces;
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + ids.map(i => pl[i][1]).join(',')
    + '&longitude=' + ids.map(i => pl[i][2]).join(',')
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=16';
  try {
    const res = await fetch(url, { cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!res.ok) return cur;
    const json = await res.json();
    const list = Array.isArray(json) ? json : [json];
    const out = { at: Date.now(), p: cur.p || {} };
    ids.forEach((id, n) => {
      const d = list[n]?.daily;
      if (!d) return;
      out.p[id] = out.p[id] || {};
      d.time.forEach((t, k) => {
        // the last forecast day sometimes comes back empty: keep only real numbers
        if (d.weather_code[k] == null || d.temperature_2m_max[k] == null || d.temperature_2m_min[k] == null) return;
        out.p[id][t] = [d.weather_code[k], Math.round(d.temperature_2m_max[k]), Math.round(d.temperature_2m_min[k]), d.precipitation_probability_max[k]];
      });
    });
    store.set(KEY, out);
    return out;
  } catch { return cur; }
}

function rows(app, day, data) {
  const opens = new Date(day.date + 'T00:00:00Z');
  opens.setUTCDate(opens.getUTCDate() - AHEAD);
  return day.wx.map(id => {
    const [name] = app.data.wxPlaces[id];
    const f = data.p?.[id]?.[day.date];
    if (!f) {
      return h('div.wx-row',
        h('span.wx-ic', { html: icon('cal') }),
        h('div', h('div.wx-name', name), h('div.faint', opens.getTime() <= Date.now()
          ? 'התחזית ליום הזה תגיע בימים הקרובים, כשיש אינטרנט'
          : `התחזית תופיע בערך מ-${shortDate(opens.toISOString().slice(0, 10))}, שבועיים לפני`)));
    }
    const [code, max, min, rain] = f;
    const [, text, ic] = describe(code);
    return h('div.wx-row',
      h('span.wx-ic', { html: icon(ic) }),
      h('div',
        h('div.wx-name', name, ' · ', text),
        h('div.wx-t', 'ביום ', deg(max), ' · בלילה ', deg(min), rain != null ? ` · סיכוי לגשם ${rain}%` : '')));
  });
}

export function weatherCard(app, day) {
  if (!day.wx?.length || !app.data.wxPlaces) return null;
  const box = h('div.card.wx');
  const draw = data => {
    const at = data.at ? new Date(data.at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : null;
    box.replaceChildren(
      h('div.wx-head', h('h3', { html: icon('sun') + '<span>תחזית מזג האוויר</span>' }),
        btn('לרענן', 'refresh', async () => { draw(await refresh(app, true)); }, 'sm ghost')),
      ...rows(app, day, data),
      h('div.faint.wx-foot', at ? `עודכן ${at}. מתעדכן לבד כשיש אינטרנט.` : 'התחזית מגיעה כשיש אינטרנט, ונשמרת בטלפון.',
        ' ', h('a', { href: '#/guide/weather' }, 'ממוצעים ומה ללבוש')));
  };
  draw(store.get(KEY, { at: 0, p: {} }));
  pending = pending || refresh(app, false).finally(() => { pending = null; });
  pending.then(draw);
  return box;
}

// Rinat 20.10 (design upgrade): the forecast as short chips in the clocks row. A tap opens "ממוצעים ומה ללבוש".
export function weatherChips(app, day) {
  if (!day.wx?.length || !app.data.wxPlaces) return null;
  const box = h('span.wxs');
  const draw = data => box.replaceChildren(...day.wx.map(id => {
    const [name] = app.data.wxPlaces[id];
    const f = data.p?.[id]?.[day.date];
    if (!f) return h('a.clock.wxc', { href: '#/guide/weather' }, h('span.wi', { html: icon('cal') }), h('span.wt', h('b', name), ' · התחזית תגיע קרוב לתאריך'));
    const [code, max, min, rain] = f;
    const [, text, ic] = describe(code);
    return h('a.clock.wxc', { href: '#/guide/weather', 'aria-label': `${name}: ${text}` },
      h('span.wi', { html: icon(ic) }),
      h('span.wt', h('b', name), ' ', text, ' · ביום ', deg(max), ' · בלילה ', deg(min), rain != null ? [' · ', h('span.nw', `גשם ${rain}%`)] : ''));
  }));
  draw(store.get(KEY, { at: 0, p: {} }));
  pending = pending || refresh(app, false).finally(() => { pending = null; });
  pending.then(draw);
  return box;
}
