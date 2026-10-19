import { h, listItem, btn } from '../ui.js';

export function guidesView(app) {
  const groups = {};
  for (const g of app.data.guides) (groups[g.group] ||= []).push(g);
  return h('div',
    h('div.screen-head', h('h1', 'איך עושים את זה'), h('div.sub', 'הסברים קצרים ומעשיים, בנויים על הספר של דור ועל בדיקה עדכנית')),
    Object.entries(groups).map(([name, list]) => h('section',
      h('h2.section', name),
      list.map(g => listItem({ ic: g.ic, tone: g.tone, t: g.title, d: g.sub, onclick: () => app.go('guide/' + g.id) })))));
}

export function guideView(app, id) {
  const g = app.data.guides.find(x => x.id === id);
  if (!g) return guidesView(app);
  return h('div',
    h('div', { style: 'margin-bottom:6px' }, btn('כל ההסברים', 'arrow', () => app.go('guides'), 'sm ghost')),
    h('div.screen-head', h('h1', g.title), g.sub ? h('div.sub', g.sub) : null),
    h('div.prose', { html: g.html }));
}
