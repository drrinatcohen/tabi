import { h, listItem, btn } from '../ui.js';

const SHOP = 'קניות ואוכל';

export const isShop = (app, id) => app.data.guides.some(g => g.id === id && g.group === SHOP);

function list(app, guides) {
  const groups = {};
  for (const g of guides) (groups[g.group] ||= []).push(g);
  return Object.entries(groups).map(([name, items]) => h('section',
    h('h2.section', name),
    items.map(g => listItem({ ic: g.ic, tone: g.tone, t: g.title, d: g.sub, onclick: () => app.go('guide/' + g.id) }))));
}

export function guidesView(app) {
  return h('div',
    h('div.screen-head', h('h1', 'מדריכים'), h('div.sub', 'הסברים קצרים ומעשיים: רכבות, כסף, אוכל, אונסן ויפנית. בנויים על הספר של דור ועל בדיקה עדכנית')),
    list(app, app.data.guides.filter(g => g.group !== SHOP)));
}

export function shopView(app) {
  return h('div',
    h('div.screen-head', h('h1', 'קניות ואוכל'), h('div.sub', 'קודם ההמלצות של דור, ואחר כך הרשימה מהאקסל של החברה, עם הסבר לכל פריט')),
    app.data.guides.filter(g => g.group === SHOP).map(g =>
      listItem({ ic: g.ic, tone: g.tone, t: g.title, d: g.sub, onclick: () => app.go('guide/' + g.id) })));
}

export function guideView(app, id) {
  const g = app.data.guides.find(x => x.id === id);
  if (!g) return guidesView(app);
  const shop = g.group === SHOP;
  return h('div',
    h('div', { style: 'margin-bottom:6px' }, btn(shop ? 'קניות ואוכל' : 'כל המדריכים', 'arrow', () => app.go(shop ? 'shop' : 'guides'), 'sm ghost')),
    h('div.screen-head', h('h1', g.title), g.sub ? h('div.sub', g.sub) : null),
    h('div.prose', { html: g.html }));
}
