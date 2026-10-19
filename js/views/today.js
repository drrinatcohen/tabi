import { icon } from '../icons.js';
import { h, R, btn, chip, callout, heDate, shortDate, nowIn, listItem } from '../ui.js';
import { store } from '../store.js';
import { timeline, hotelCard, journal, openBook, actionBtn } from '../components.js';
import { weatherCard } from '../weather.js';

const START = '2026-10-24';
const LAND = '2026-10-26';

function currentDate() {
  const jp = nowIn('Asia/Tokyo').date;
  return jp >= LAND ? jp : nowIn('Asia/Jerusalem').date;
}

function clocks(day) {
  const fmt = tz => new Intl.DateTimeFormat('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const zones = day?.date === '2026-10-25' ? [['בבנגקוק', 'Asia/Bangkok'], ['בישראל', 'Asia/Jerusalem']]
    : day?.date === START ? [['בישראל', 'Asia/Jerusalem'], ['ביפן', 'Asia/Tokyo']]
      : [['ביפן', 'Asia/Tokyo'], ['בישראל', 'Asia/Jerusalem']];
  return h('div.clocks', zones.map(([l, tz]) => h('span.clock', l, h('b', fmt(tz)))));
}

function installCard(app) {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || store.get('installDismissed')) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return h('div.card.tint-ai',
    h('h3', 'להוסיף למסך הבית'),
    ios
      ? R('div', 'בספארי: לוחצים על כפתור השיתוף (ריבוע עם חץ למעלה) ← **הוספה למסך הבית**. מאותו רגע יש אייקון כמו של אפליקציה.')
      : R('div', 'בכרום: תפריט שלוש הנקודות ← **התקנת אפליקציה** (או "הוספה למסך הבית").'),
    h('div.btns',
      app.installPrompt ? btn('להתקין עכשיו', 'download', async () => { app.installPrompt.prompt(); app.installPrompt = null; }, 'ai') : null,
      btn('כבר עשיתי', 'check', () => { store.set('installDismissed', true); app.rerender(); }, 'ghost')));
}

function checklistCard(app) {
  const items = app.data.checklist;
  const done = store.get('checklist', {});
  const box = h('div.card', { style: 'padding:4px 0' });
  const draw = () => {
    const left = items.filter(i => !done[i.id]).length;
    box.replaceChildren(
      h('div', { style: 'padding:10px 14px 4px' }, h('h3', { style: 'margin:0' }, 'לפני שיוצאים'), h('div.faint', left ? `נשארו ${left} מתוך ${items.length}` : 'הכול מוכן')),
      ...items.map(i => h('div.check' + (done[i.id] ? '.done' : ''), {
        role: 'checkbox', 'aria-checked': String(!!done[i.id]), tabindex: '0',
        onclick: () => { done[i.id] = !done[i.id]; store.set('checklist', done); draw(); },
      }, h('span.box', { html: done[i.id] ? icon('check') : '' }), h('span.label', R('span', i.text), i.when ? h('div.faint', i.when) : null))));
  };
  draw();
  return box;
}

function preTrip(app) {
  const ilNow = new Date();
  const dep = new Date(app.data.trip.departure);
  const days = Math.max(0, Math.ceil((dep - ilNow) / 864e5));
  return h('div',
    h('div.hero',
      h('div.eyebrow', app.data.trip.tagline),
      h('div.row', { style: 'align-items:flex-end;gap:14px;margin-top:8px' },
        h('div.countdown', String(days)),
        h('div', h('div.big', days === 1 ? 'יום לטיסה' : 'ימים לטיסה'), h('div.muted', 'מוצאי שבת 24.10 · 23:30 · נתב"ג טרמינל 3'))),
      clocks(null)),
    installCard(app),
    h('div.card.flat', { 'data-offline': '' }),
    checklistCard(app),
    h('h2.section', 'הטיול במבט אחד'),
    h('div', app.data.days.filter(d => d.n > 0).reduce((acc, d) => {
      const last = acc[acc.length - 1];
      if (last && last.city === d.city) last.to = d.date; else acc.push({ city: d.city, cityJp: d.cityJp, from: d.date, to: d.date, id: d.id });
      return acc;
    }, []).map(s => listItem({ ic: 'pin', tone: 'shu', t: `${s.city} {jp:${s.cityJp || ''}}`, d: s.from === s.to ? shortDate(s.from) : `${shortDate(s.from)} עד ${shortDate(s.to)}`, onclick: () => app.go('day/' + s.id) }))),
    h('div.btns', btn('יום היציאה: מה עושים ב-24.10', 'plane', () => app.go('day/d00'), 'block'),
      btn('אודות יפן (מהספר של דור)', 'torii', () => app.go('guide/japan'), 'block ghost'),
      btn('הטיפים של דור לפני הטיול', 'book', () => app.go('guide/dorintro'), 'block ghost')));
}

function afterTrip(app) {
  const lines = app.data.days.map(d => ({ d, t: store.get('journal:' + d.date, '') })).filter(x => x.t);
  return h('div',
    h('div.hero', h('div.eyebrow', 'ברוכים השבים'), h('div.city', 'בבית'), h('div.title', '25 שנה, 17 ימים, חלום אחד שהתגשם.')),
    h('h2.section', 'היומן שלך', h('span.count', `${lines.length} שורות`)),
    lines.length ? lines.map(x => h('div.card', h('div.faint', heDate(x.d.date) + ' · ' + x.d.city), R('div', x.t))) : h('div.card.muted', 'לא נכתבו שורות ביומן בטלפון הזה.'));
}

export function dayContent(app, day, { isToday = false } = {}) {
  const d = app.data;
  const idx = d.days.findIndex(x => x.id === day.id);
  const prev = d.days[idx - 1], next = d.days[idx + 1];
  const ho = day.hotel ? d.hotels[day.hotel] : null;
  return h('div',
    h('div.dayswitch',
      prev ? h('button.btn.sm.ghost', { type: 'button', onclick: () => app.go('day/' + prev.id), html: icon('arrow') + `<span>${shortDate(prev.date)}</span>` }) : h('span'),
      isToday ? chip('היום', 'shu', 'sun') : h('button.btn.sm.ghost', { type: 'button', onclick: () => app.go('today') }, 'להיום'),
      next ? h('button.btn.sm.ghost.flip', { type: 'button', onclick: () => app.go('day/' + next.id), html: `<span>${shortDate(next.date)}</span>` + icon('arrow') }) : h('span')),
    h('div.hero',
      h('div.date', heDate(day.date) + (day.n > 0 ? ` · יום ${day.n} מתוך 17` : '')),
      h('div.city', day.city, day.cityJp ? h('span.jp', { lang: 'ja' }, day.cityJp) : null),
      R('div.title', day.title),
      clocks(day)),
    isToday ? h('div.card.flat', { 'data-offline': 'today' }) : null,
    weatherCard(app, day),
    (day.warn || []).map(w => callout('shu', 'alert', null, w)),
    day.intro ? R('div.card.tint-moss', day.intro) : null,
    ho ? h('div', h('h2.section', { html: icon('bed') + (day.hotelLabel || 'הלילה ישנים ב') }), hotelCard(app, ho, { compact: true })) : null,
    day.items?.length ? h('div', h('h2.section', { html: icon('clock') + 'התוכנית' }), timeline(app, day.items)) : null,
    day.ideas?.length ? h('div', h('h2.section', { html: icon('star') + (day.ideasTitle || 'מה עוד אפשר') }),
      h('div.card', h('ul', { style: 'margin:0;padding-inline-start:20px' }, day.ideas.map(t => R('li', t))))) : null,
    day.tips?.length ? h('div', h('h2.section', { html: icon('info') + 'שווה לדעת' }), day.tips.map(t => callout('gold', 'info', null, t))) : null,
    day.food?.length ? h('div', h('h2.section', { html: icon('food') + (day.foodTitle || 'אוכל') }), h('div.card', h('ul', { style: 'margin:0;padding-inline-start:20px' }, day.food.map(t => R('li', t))))) : null,
    day.actions?.length ? h('div.btns', day.actions.map(a => actionBtn(app, a))) : null,
    day.book ? h('div', h('h2.section', { html: icon('book') + 'מהספר של דור' }),
      h('div.card.tint-ai', R('div', `כל ההסברים, ההמלצות והקישורים למפה מהספר שדור כתב לכם, בעמודים ${day.book[0]}-${day.book[1]}.`),
        h('div.btns', btn('לפתוח את העמודים', 'book', () => openBook(app, day.book[0], day.book[1], heDate(day.date)), 'ai')))) : null,
    day.n >= 0 ? h('div', { style: 'margin-top:18px' }, journal(app, day)) : null);
}

export function todayView(app) {
  const date = currentDate();
  const days = app.data.days;
  if (date < START) return preTrip(app);
  if (date > days[days.length - 1].date) return afterTrip(app);
  const day = days.find(d => d.date === date) || days[0];
  return h('div', date === START ? [installCard(app), checklistCard(app)] : null, dayContent(app, day, { isToday: true }));
}

export function dayView(app, id) {
  const day = app.data.days.find(d => d.id === id);
  if (!day) return todayView(app);
  return dayContent(app, day, { isToday: day.date === currentDate() });
}
