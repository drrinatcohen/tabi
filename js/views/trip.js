import { icon } from '../icons.js';
import { h, R, shortDate, weekday } from '../ui.js';
import { hotelCard } from '../components.js';
import { currentDate } from './today.js';

export function tripView(app, tab = 'days') {
  const d = app.data;
  const today = currentDate(app);
  const seg = h('div.seg', { role: 'group' },
    h('button', { type: 'button', 'aria-pressed': String(tab !== 'hotels'), onclick: () => app.go('trip/days') }, 'ימים'),
    h('button', { type: 'button', 'aria-pressed': String(tab === 'hotels'), onclick: () => app.go('trip/hotels') }, 'מלונות'));

  const days = d.days.map(day => {
    const tr = (day.items || []).some(i => i.train);
    const car = (day.items || []).some(i => i.ic === 'car');
    const plane = (day.items || []).some(i => i.ic === 'plane');
    const bag = (day.items || []).some(i => i.ic === 'bag');
    return h('button.list-item', { type: 'button', onclick: () => app.go('day/' + day.id) },
      h('div.day-row' + (day.date === today ? '.today' : ''), { style: 'width:100%' },
        h('div.day-num', h('b', day.n > 0 ? day.n : '·'), h('span', shortDate(day.date))),
        h('div.txt', h('div.t', `${day.city} `, h('span.faint', `· ${weekday(day.date)}`)), R('div.d', day.short || day.title)),
        h('div.day-icons', { html: (plane ? icon('plane') : '') + (tr ? icon('train') : '') + (car ? icon('car') : '') + (bag ? icon('bag') : '') + (day.hotel ? icon('bed') : '') })));
  });

  const hotels = Object.values(d.hotels).map(ho => hotelCard(app, ho));

  return h('div',
    h('div.screen-head', h('h1', 'המסלול'), h('div.sub', '24.10 עד 11.11 · אוסקה, הירושימה, קיוטו, האקונה, טוקיו')),
    seg,
    tab === 'hotels' ? hotels : days);
}
