// Rinat 13.11: "אני רוצה שיופיע לו באפליקציה כמו אצלי".
// The journal travels as a link: #j=<encrypted, compressed journal>. Encrypted with the app's own key,
// so only a phone that already has the app can read it. The hash is never sent to the server.
import { store } from './store.js';
import { b64uToBytes, bytesToB64u, encryptBuf, decryptBuf } from './crypto.js';

const enc = new TextEncoder();
const dec = new TextDecoder();
const canZip = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export function ownJournal(app) {
  const j = {};
  app.data.days.forEach(d => { const t = store.get('journal:' + d.date, ''); if (t) j[d.date] = t; });
  return j;
}

export const partnerJournal = (app) => store.get('journalFrom:' + app.partner(), null);

export async function journalLink(app) {
  let bytes = enc.encode(JSON.stringify({ from: app.who, at: new Date().toISOString(), j: ownJournal(app) }));
  let tag = 'j';
  if (canZip) { bytes = await pipe(bytes, new CompressionStream('deflate-raw')); tag = 'jz'; }
  const sealed = await encryptBuf(app.key, bytes);
  return location.origin + location.pathname + '#' + tag + '=' + bytesToB64u(sealed);
}

// Finds a journal link in a hash or in a pasted WhatsApp message and saves it. Returns who sent it, or null.
export async function importJournal(app, text) {
  const m = String(text || '').match(/#(jz?)=([A-Za-z0-9_-]{20,})/);
  if (!m) return null;
  try {
    let bytes = new Uint8Array(await decryptBuf(app.key, b64uToBytes(m[2])));
    if (m[1] === 'jz') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    const p = JSON.parse(dec.decode(bytes));
    if (!p || !p.from || !p.j || p.from === app.who) return null;
    store.set('journalFrom:' + p.from, { at: p.at, j: p.j });
    return p.from;
  } catch (e) { console.warn('journal link', e); return null; }
}
