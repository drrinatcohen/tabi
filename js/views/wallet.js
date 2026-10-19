import { h, R, listItem, callout } from '../ui.js';
import { openQR, openDoc } from '../components.js';

export function walletView(app) {
  const d = app.data;
  const open = (e) => {
    if (e.qr) return openQR(app, d.qrs[e.qr]);
    const doc = d.docs[e.doc];
    openDoc(app, { title: doc.title, sub: doc.sub, pages: doc.pages, fields: doc.fields });
  };
  return h('div',
    h('div.screen-head', h('h1', 'כרטיסים ומסמכים'), h('div.sub', 'הכול שמור בטלפון ונפתח גם בלי אינטרנט')),
    callout('ai', 'qr', null, 'ברקוד נפתח על מסך לבן. כדאי להגביר בהירות. מספרים מודגשים אפשר להעתיק בלחיצה.'),
    d.wallet.map(sec => h('section',
      h('h2.section', sec.title),
      sec.entries.map(e => listItem({ ic: e.ic || sec.ic, tone: e.tone || sec.tone, t: e.title, d: e.sub, onclick: () => open(e) })))));
}
