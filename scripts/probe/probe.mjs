// 一時的な調査用。ページの構造（タグ・class）だけを出力し、文章は先頭数文字に切り詰める。
const UA = 'dive-fish-zukan-bot/0.1 (+https://tatekin.github.io/dive-fish-zukan/about/)';
async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') ?? '';
  let cs = /charset=([\w-]+)/i.exec(ct)?.[1];
  if (!cs) cs = /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.toString('latin1'))?.[1] ?? 'utf-8';
  const text = new TextDecoder(cs.toLowerCase() === 'shift_jis' ? 'shift_jis' : cs).decode(buf);
  console.log(`\n##### ${url} -> ${res.status} ${ct} charset=${cs} len=${text.length}`);
  return text;
}
function skeleton(html, max = 400) {
  html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/gi, '');
  const re = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let depth = 0, m, out = [];
  const voids = new Set(['br','img','meta','link','input','hr','source','wbr']);
  while ((m = re.exec(html))) {
    if (m[3] !== undefined) {
      const t = m[3].replace(/\s+/g, ' ').trim();
      if (t) out.push('  '.repeat(depth) + '"' + [...t].slice(0, 14).join('') + ([...t].length > 14 ? `…(${[...t].length})` : '') + '"');
      continue;
    }
    const tag = m[1].toLowerCase();
    if (m[0].startsWith('</')) { depth = Math.max(0, depth - 1); continue; }
    const cls = /class=["']([^"']*)/.exec(m[2])?.[1];
    const id = /\bid=["']([^"']*)/.exec(m[2])?.[1];
    const href = /href=["']([^"']*)/.exec(m[2])?.[1];
    out.push('  '.repeat(depth) + `<${tag}${id ? '#' + id : ''}${cls ? '.' + cls.trim().replace(/\s+/g, '.') : ''}${href ? ' href=' + href.slice(0, 80) : ''}>`);
    if (!voids.has(tag) && !m[0].endsWith('/>')) depth++;
  }
  return out;
}
function around(lines, words, before = 15, after = 120) {
  const idx = lines.findIndex((l) => words.some((w) => l.includes(w)));
  return idx < 0 ? lines.slice(0, 200) : lines.slice(Math.max(0, idx - before), idx + after);
}
for (const u of ['https://www.cocomo-ds.net/robots.txt', 'https://www.seaking-ds.com/robots.txt', 'https://www.marinhouse-leialoha.com/robots.txt']) {
  try { console.log((await get(u)).slice(0, 800)); } catch (e) { console.log('ERR', u, e.message); }
}
for (const [u, words] of [
  ['https://www.cocomo-ds.net/p4-1.html', ['海洋情報']],
  ['https://www.cocomo-ds.net/p4-1.html?id=3306', ['海洋情報']],
  ['https://www.seaking-ds.com/seainfo_detail.php', ['海況']],
  ['https://www.seaking-ds.com/seainfo_detail.php?D=20261127', ['海況']],
]) {
  try {
    const lines = skeleton(await get(u));
    console.log(`lines=${lines.length}`);
    console.log(around(lines, words, 20, 220).join('\n'));
    console.log('----- tail-search pager/links');
    console.log(lines.filter((l) => /href=[^ ]*(id=|D=|page=)/.test(l)).slice(0, 40).join('\n'));
  } catch (e) { console.log('ERR', u, e.message); }
}
try {
  const xml = await get('https://www.marinhouse-leialoha.com/blog-feed.xml');
  const items = xml.split('<item>').slice(1, 6);
  for (const it of items) {
    const g = (t) => (new RegExp(`<${t}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${t}>`).exec(it)?.[1] ?? '').trim();
    console.log(JSON.stringify({ title: g('title'), link: g('link').slice(0, 120), category: g('category'), pubDate: g('pubDate'), creator: g('dc:creator') }));
  }
} catch (e) { console.log('ERR feed', e.message); }
