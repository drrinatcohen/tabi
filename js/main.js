import { icon } from './icons.js';
import { h, toast } from './ui.js';
import { store, persist, recall } from './store.js';
import { b64uToBytes, bytesToB64u, importKey, decryptBuf, decryptJSON, unwrapWithPassphrase } from './crypto.js';
import { loadVersion, getFile, syncOffline, offlineStatus } from './offline.js';
import { todayView, dayView } from './views/today.js';
import { tripView } from './views/trip.js';
import { walletView } from './views/wallet.js';
import { guidesView, guideView, shopView, isShop } from './views/guides.js';
import { helpView } from './views/help.js';
import { weatherView } from './weather.js';
import { yenView } from './yen.js';
import { searchView, searchBar, showHit } from './views/search.js';

const appEl = document.getElementById('app');

export const app = {
  data: null, key: null, ver: null,
  who: store.get('who'),
  offline: { have: 0, total: 0, syncing: false, done: false, known: false },
  urls: new Map(),
  installPrompt: null,
  partner() { return this.who === 'rinat' ? 'nessi' : 'rinat'; },
  name(p) { return this.data?.people?.[p]?.name || ''; },
  async assetURL(id) {
    if (this.urls.has(id)) return this.urls.get(id);
    const a = this.data.assets[id];
    if (!a) throw new Error('no asset ' + id);
    const buf = await decryptBuf(this.key, await getFile(a.f));
    const url = URL.createObjectURL(new Blob([buf], { type: a.t }));
    this.urls.set(id, url);
    return url;
  },
  asset(id) { return this.data.assets[id]; },
  go(route) { location.hash = '#/' + route; },
  rerender() { render(); },
  // opened inside the tap itself, so the phone's keyboard comes up (iPhone opens it only from a tap)
  openSearch() {
    history.pushState(null, '', '#/search');
    render();
    appEl.querySelector('.search-input')?.focus();
  },
  hit: null, // what to find and mark on the next screen, after a search result is opened
};
window.__app = app; // handy for debugging on the phone

// ---------- key handling ----------
async function readKey() {
  const m = location.hash.match(/k=([A-Za-z0-9_-]{40,})/);
  if (m) {
    const raw = b64uToBytes(m[1]);
    await persist('k', m[1]);
    history.replaceState(null, '', location.pathname + location.search + '#/today');
    return raw;
  }
  const saved = await recall('k');
  return saved ? b64uToBytes(saved) : null;
}

function unlockScreen(wrap) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'מילת הקוד', 'aria-label': 'מילת הקוד' });
    const err = h('div.faint.center');
    const go = async () => {
      err.textContent = 'בודק...';
      try {
        const raw = await unwrapWithPassphrase(input.value, wrap);
        const b = bytesToB64u(raw);
        await persist('k', b);
        resolve(raw);
      } catch { err.textContent = 'מילת הקוד לא נכונה. נסו שוב, או פתחו שוב את הקישור מהוואטסאפ.'; }
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    appEl.replaceChildren(h('div.unlock',
      h('div.seal', { style: 'margin:0 auto' }, '旅'),
      h('h1.center', { style: 'margin:6px 0 0;font-size:28px' }, 'המסע שלנו'),
      h('p.center.muted', 'כדי לפתוח, הקלידו את מילת הקוד ששלחנו לכם, או פתחו שוב את הקישור מהוואטסאפ.'),
      input,
      h('button.btn.primary.block', { type: 'button', onclick: go }, 'פתיחה'),
      err));
    setTimeout(() => input.focus(), 50);
  });
}

function whoScreen() {
  return new Promise((resolve) => {
    const pick = (w) => { persist('who', w); app.who = w; resolve(); };
    appEl.replaceChildren(h('div.unlock',
      h('div.seal', { style: 'margin:0 auto' }, '旅'),
      h('h1.center', { style: 'margin:6px 0 0;font-size:28px' }, 'מי משתמש בטלפון הזה?'),
      h('p.center.muted', 'כך יופיעו קודם הכרטיסים והברקודים שלך. אפשר לשנות בכל רגע במסך "עזרה".'),
      h('div.who',
        ['rinat', 'nessi'].map(p => h('button', { type: 'button', onclick: () => pick(p) }, app.name(p), h('span', app.data.people[p].device || ''))))));
  });
}

// ---------- offline sync ----------
async function startSync() {
  const files = app.ver.files;
  const st = await offlineStatus(files);
  Object.assign(app.offline, st, { done: st.have === st.total, known: true });
  if (app.offline.done) { renderOfflineBadge(); return; }
  if (!navigator.onLine) { renderOfflineBadge(); return; }
  app.offline.syncing = true;
  renderOfflineBadge();
  const { failed } = await syncOffline(files, (have, total) => {
    Object.assign(app.offline, { have, total });
    renderOfflineBadge();
  });
  app.offline.syncing = false;
  app.offline.done = !failed;
  renderOfflineBadge();
  if (!failed) toast('הכול שמור בטלפון. עובד גם בלי אינטרנט');
}

function renderOfflineBadge() {
  document.querySelectorAll('[data-offline]').forEach(el => {
    const { have, total, done, syncing, known } = app.offline;
    if (!known || (done && el.dataset.offline === 'today')) { el.replaceChildren(); el.hidden = true; return; }
    el.hidden = false;
    const pct = total ? Math.round(have / total * 100) : 0;
    el.replaceChildren(
      done
        ? h('div.row', { html: icon('check') + `<span><b>הכול שמור בטלפון</b> · ${total} קבצים · עובד גם בלי אינטרנט</span>` })
        : h('div.stack',
          h('div.row', { html: icon('download') + `<span><b>${syncing ? 'שומר את הכול בטלפון...' : 'עוד לא הכול שמור בטלפון'}</b> ${have}/${total}</span>` }),
          h('div.progress', h('i', { style: `width:${pct}%` })),
          !syncing ? h('div.faint', 'כשתהיה רשת, השמירה תמשיך לבד. כדאי להשאיר את האפליקציה פתוחה דקה-שתיים בוויי-פיי.') : null));
  });
}
export { renderOfflineBadge };

// ---------- router ----------
const NAV = [
  ['today', 'היום', 'sun'],
  ['trip', 'המסלול', 'map'],
  ['wallet', 'כרטיסים', 'ticket'],
  ['shop', 'קניות ואוכל', 'shop'],
  ['guides', 'מדריכים', 'compass'],
  ['help', 'עזרה', 'buoy'],
];

function nav(active) {
  return h('nav.nav', { 'aria-label': 'ניווט' }, h('div.inner', NAV.map(([r, label, ic]) =>
    h('button', { type: 'button', 'aria-current': active === r ? 'page' : null, onclick: () => app.go(r), html: icon(ic) + `<span>${label}</span>` }))));
}

function render() {
  if (!app.data) return;
  const route = (location.hash.replace(/^#\/?/, '') || 'today').split('/');
  let view, active = route[0];
  try {
    switch (route[0]) {
      case 'day': view = dayView(app, route[1]); active = 'trip'; break;
      case 'trip': view = tripView(app, route[1]); break;
      case 'wallet': view = walletView(app); break;
      case 'guides': view = guidesView(app); break;
      case 'shop': view = shopView(app); break;
      case 'guide': view = guideView(app, route[1]); active = isShop(app, route[1]) ? 'shop' : 'guides'; break;
      case 'help': view = helpView(app); break;
      case 'weather': view = weatherView(app); active = 'today'; break;
      case 'yen': view = yenView(); active = 'today'; break;
      case 'search': view = searchView(app, decodeURIComponent(route[1] || '')); active = ''; break;
      default: view = todayView(app); active = 'today';
    }
  } catch (e) {
    console.error(e);
    view = h('div.card', 'משהו השתבש בתצוגה. ', h('button.btn.sm', { onclick: () => app.go('today') }, 'חזרה להיום'));
  }
  // Rinat 20.10: search at the top of every screen
  appEl.replaceChildren(...(route[0] === 'search' ? [] : [searchBar(app)]), view, nav(active));
  renderOfflineBadge();
  window.scrollTo(0, 0);
  if (app.hit) {
    const hit = app.hit;
    app.hit = null;
    // after the screen settles (the timeline marks past items in the next frame)
    setTimeout(() => showHit(appEl, hit), 80);
  }
}
window.addEventListener('hashchange', () => { if (!/k=/.test(location.hash)) render(); });

// ---------- boot ----------
function needNetwork() {
  appEl.replaceChildren(h('div.unlock', h('div.seal', { style: 'margin:0 auto' }, '旅'),
    h('p.center', 'בפתיחה הראשונה צריך אינטרנט כדי לשמור את הכול בטלפון. התחברו לרשת ונסו שוב.'),
    h('button.btn.primary', { onclick: () => location.reload() }, 'לנסות שוב')));
}

async function boot() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }); } catch (e) { console.warn('sw', e); }
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); app.installPrompt = e; });

  let ver;
  try { ver = (await loadVersion()).v; }
  catch { needNetwork(); return; }
  app.ver = ver;

  // A missing file is a network problem, not a wrong key: never ask for the code because of it.
  let indexBuf;
  try { indexBuf = await getFile(ver.index); }
  catch { needNetwork(); return; }

  let raw = await readKey();
  let key = raw ? await importKey(raw) : null;
  let data = null;
  if (key) {
    try { data = await decryptJSON(key, indexBuf); } catch { key = null; }
  }
  while (!data) {
    raw = await unlockScreen(ver.wrap);
    key = await importKey(raw);
    try { data = await decryptJSON(key, indexBuf); } catch { /* wrong key: ask again */ }
  }
  app.key = key; app.data = data;

  app.who = app.who || await recall('who');
  if (!app.who) await whoScreen();
  if (!location.hash || /k=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search + '#/today');
  render();
  startSync();
  window.addEventListener('online', () => { if (!app.offline.done && !app.offline.syncing) startSync(); });
}

boot();
