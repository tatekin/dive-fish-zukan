// ショップのログから「魚名・日付・出典URL」だけを取り出すための純粋関数。
// ページの文章そのものは返さない（呼び出し側でも保存・表示しない）。

/** 全角英数・半角カナなどをそろえる */
export const norm = (s) => s.normalize('NFKC');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©' };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML断片をテキストに（<br> と ブロック要素は改行） */
export function htmlToText(html) {
  const t = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return norm(decodeEntities(t));
}

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** Date → 日本時間の YYYY-MM-DD */
export const jstDate = (date) => new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** YYYY-MM-DD から n 日前 */
export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------- 名前の抽出 ----------

/** 同定があいまい・見られなかった、を表す言い回し。含む部分は記録しない */
const UNSURE = /[?？]|っぽい|ぽい|らしき|らしい|かも|思われ|似た|みたい|見つから|見られず|見れず|いなく|不在|行方不明|探し/;
const KATAKANA_RUN = /[ァ-ヺー・]+/g;
/** 名前の候補にしない一般的なカタカナ語 */
const GENERIC = new Set(['ペア', 'ペアー', 'サイズ', 'カップル', 'ベビー', 'チビ', 'ビーチ', 'ボート', 'ダイブ', 'ダイバー', 'ダイビング', 'ポイント', 'ガイド', 'ゲスト', 'ライト', 'カメラ', 'ドライ', 'ウェット', 'スーツ', 'エントリー', 'エキジット', 'ブイ', 'ロープ', 'ゴロタ', 'ウネリ', 'ウミ', 'メイン', 'ラスト', 'セット', 'シーズン', 'レア', 'ヨコ', 'タテ', 'ハッチアウト', 'ホバリング', 'アイドル', 'ハンター', 'オレンジ', 'ピンク', 'ブルー', 'イエロー', 'ハート', 'シルエット', 'ゲット', 'チャンス', 'キラキラ', 'ゆらゆら', 'ユラユラ', 'フワフワ', 'ニョロニョロ', 'ペタペタ', 'パクパク', 'ノーマル', 'ペリクリ']);

/**
 * 辞書を作る。fish の標準和名 → fishId、aliases: ログでの表記 → fishId、
 * ignore / ignoreSuffixes: 魚ではない・記録しない名前（とその語尾）
 * @param {{id:string,name:string}[]} fish
 * @param {{aliases?:Record<string,string>, ignore?:string[], ignoreSuffixes?:string[]}} extra
 */
export function buildDictionary(fish, extra = {}) {
  const byName = new Map();
  for (const f of fish) byName.set(norm(f.name), f.id);
  for (const [k, v] of Object.entries(extra.aliases ?? {})) byName.set(norm(k), v);
  return {
    byName,
    ignore: new Set((extra.ignore ?? []).map(norm)),
    ignoreSuffixes: (extra.ignoreSuffixes ?? []).map(norm),
  };
}

/** 辞書になく、記録もしない（魚ではない等）名前か */
export const isIgnored = (dict, name) =>
  dict.ignore.has(name) || GENERIC.has(name) || (dict.ignoreSuffixes ?? []).some((s) => name.endsWith(s));

/**
 * 生物名が並んだ文字列から、辞書にある魚の id と、辞書にない名前の候補を取り出す。
 * カタカナの連なり全体が名前と一致したときだけ一致とみなす（「ブリ」が「ブリモドキ」に誤一致しないように）。
 * @returns {{ fish: string[], unknown: string[] }}
 */
export function extractNames(text, dict, { collectUnknown = true } = {}) {
  const fishIds = new Set();
  const unknown = new Set();
  for (const token of norm(text).split(/[、，,。\n]/)) {
    if (UNSURE.test(token)) continue;
    for (const run of token.match(KATAKANA_RUN) ?? []) {
      const parts = dict.byName.has(run) ? [run] : run.split('・').filter(Boolean);
      for (const p of parts) {
        // 「〇〇ペア」のように後ろに付いた一般語は外す
        const name = p.replace(/^ー+|ー+$/g, '').replace(/(ペアー?|カップル|ベビー)$/, '');
        if (name.length < 2) continue;
        const id = dict.byName.get(name);
        if (id) fishIds.add(id);
        else if (collectUnknown && !isIgnored(dict, name)) unknown.add(name);
      }
    }
  }
  return { fish: [...fishIds], unknown: [...unknown] };
}

/** text の中で marker から始まり「。」で終わる部分（生物の列挙部分） */
export function sentenceFrom(text, marker) {
  const i = text.indexOf(marker);
  if (i < 0) return '';
  const rest = text.slice(i + marker.length);
  const end = rest.indexOf('。');
  return end < 0 ? rest : rest.slice(0, end);
}

// ---------- 各サイトのパーサー ----------

/**
 * COCOMO OSEZAKI 海洋情報（https://www.cocomo-ds.net/p4-1.html?id=NNNN）
 * @returns {{ date?: string, creatures: string, ids: number[] }}
 */
export function parseCocomo(html) {
  const h = /<h3[^>]*class="[^"]*heading[^"]*"[^>]*>([\s\S]*?)<\/h3>/i.exec(html);
  const dm = h ? /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(norm(htmlToText(h[1]))) : null;
  const body = /<div[^>]*class="[^"]*detailText[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
  const text = body ? htmlToText(body[1]) : '';
  const parts = [sentenceFrom(text, '生き物は')];
  const photo = text.indexOf('今日の写真は');
  if (photo >= 0) parts.push(text.slice(photo + '今日の写真は'.length).replace(/です。?\s*$/, ''));
  const ids = [...html.matchAll(/href="\?id=(\d+)"/g)].map((m) => Number(m[1]));
  return { date: dm ? ymd(dm[1], dm[2], dm[3]) : undefined, creatures: parts.filter(Boolean).join('\n'), ids: [...new Set(ids)] };
}

/**
 * ダイビングサービス シーキング 海況情報（https://www.seaking-ds.com/seainfo_detail.php?D=YYYYMMDD）
 * @returns {{ date?: string, creatures: string, days: string[] }}
 */
export function parseSeaking(html) {
  const h = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html);
  const dm = h ? /(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(norm(htmlToText(h[1]))) : null;
  const body = /<div[^>]*class="body"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
  const text = body ? htmlToText(body[1]).replace(/\n/g, '') : '';
  const days = [...html.matchAll(/href="\?D=(\d{8})"/g)].map((m) => m[1]);
  return { date: dm ? ymd(dm[1], dm[2], dm[3]) : undefined, creatures: sentenceFrom(text, '生物は'), days: [...new Set(days)] };
}

/**
 * マリンハウス レイアロハ RSS（https://www.marinhouse-leialoha.com/blog-feed.xml）
 * 大瀬崎のカテゴリの記事だけ。日付はタイトルの日付、なければ投稿日（日本時間）。
 * @returns {{ title: string, url: string, date: string }[]}
 */
export function parseLeialohaFeed(xml, category = '大瀬崎海洋速報') {
  const out = [];
  for (const item of xml.split(/<item>/).slice(1)) {
    const tag = (t) => {
      const m = new RegExp(`<${t}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${t}>`).exec(item);
      return m ? decodeEntities(m[1]).trim() : '';
    };
    const cats = [...item.matchAll(/<category>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/g)].map((m) => m[1].trim());
    if (!cats.includes(category)) continue;
    const title = norm(tag('title'));
    let url = tag('link');
    try { url = decodeURI(url); } catch { /* そのまま */ }
    const dm = /(20\d{2})[/.\-](\d{1,2})[/.\-](\d{1,2})/.exec(title);
    const pub = tag('pubDate');
    const date = dm ? ymd(dm[1], dm[2], dm[3]) : pub ? jstDate(new Date(pub)) : '';
    if (url && date) out.push({ title, url, date });
  }
  return out;
}

// ---------- robots.txt ----------

/** robots.txt で path の取得が許されているか（User-agent: * と自分のUAのグループを見る） */
export function robotsAllows(robotsTxt, path, agent = 'dive-fish-zukan-bot') {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (cur && (key === 'allow' || key === 'disallow')) cur.rules.push({ allow: key === 'allow', path: val });
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.toLowerCase().includes(a)));
  const use = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  let best = null;
  for (const r of use.flatMap((g) => g.rules)) {
    if (!r.path) continue; // 空の Disallow は「すべて許可」
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
  }
  return best ? best.allow : true;
}

// ---------- 記録のマージ ----------

export const sightingKey = (r) => `${r.fish}|${r.spot}|${r.point ?? ''}|${r.date}|${r.sourceUrl}`;

/** 新しい日付が先。同じ日はスポット・魚・出典の順 */
export const compareSightings = (a, b) =>
  b.date.localeCompare(a.date) || a.spot.localeCompare(b.spot) || a.fish.localeCompare(b.fish) || a.sourceUrl.localeCompare(b.sourceUrl);

/** 既存の記録に新しい記録を足す（重複は足さない）。追加したものも返す */
export function mergeSightings(existing, incoming) {
  const seen = new Set(existing.map(sightingKey));
  const added = [];
  for (const r of incoming) {
    const k = sightingKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    added.push(r);
  }
  const all = [...existing, ...added].sort(compareSightings);
  return { all, added };
}
