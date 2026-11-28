// ショップのログを取得して、目撃記録（魚・スポット・日付・出典URL・ショップ名）を sightings.json に追加する。
// 使い方: node scripts/fetch-sightings.mjs [--days 7] [--dry-run] [--report report.md]
// - 取得するのはログの公開ページ・RSSだけ。robots.txt で禁止されていれば取得しない。
// - ページの文章・写真は保存しない。fish.json にある魚だけを記録し、知らない名前は unmatched-names.json に名前だけ残す。
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { validate, todayJst } from '../src/lib/schema.mjs';
import {
  addDays, buildDictionary, extractNames, mergeSightings, parseCocomo, parseLeialohaFeed, parseSeaking, robotsAllows,
} from './fetch/lib.mjs';

const { values: args } = parseArgs({
  options: { days: { type: 'string', default: '7' }, 'dry-run': { type: 'boolean', default: false }, report: { type: 'string' } },
});
const DAYS = Math.max(1, Number(args.days) || 7);
const DRY = args['dry-run'];
const SPOT = 'osezaki';
const UA = 'dive-fish-zukan-bot/1.0 (+https://tatekin.github.io/dive-fish-zukan/about/)';
const WAIT_MS = 1500;

const dataPath = (n) => new URL(`../src/data/${n}.json`, import.meta.url);
const load = (n) => JSON.parse(readFileSync(dataPath(n), 'utf8'));
const names = JSON.parse(readFileSync(new URL('./fetch/names.json', import.meta.url), 'utf8'));
const fish = load('fish');
const dict = buildDictionary(fish, names);
const today = todayJst();
const cutoff = addDays(today, -(DAYS - 1));

// ---------- 取得（ホストごとに間隔をあけ、robots.txt を守る） ----------
const robotsCache = new Map();
const lastHit = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rawGet(url) {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + WAIT_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) });
  return { status: res.status, text: await res.text() };
}

async function get(url) {
  const u = new URL(url);
  if (!robotsCache.has(u.origin)) {
    const r = await rawGet(`${u.origin}/robots.txt`);
    robotsCache.set(u.origin, r.status === 200 ? r.text : '');
  }
  if (!robotsAllows(robotsCache.get(u.origin), u.pathname + u.search)) throw new Error(`robots.txt で禁止: ${url}`);
  const r = await rawGet(url);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.text;
}

// ---------- 各出典 ----------
/** @typedef {{ date: string, url: string, text: string, collectUnknown: boolean }} Entry */

/** @returns {Promise<Entry[]>} */
async function cocomo() {
  const base = 'https://www.cocomo-ds.net/p4-1.html';
  const first = parseCocomo(await get(base));
  const latest = Math.max(...first.ids);
  if (!Number.isFinite(latest)) throw new Error('COCOMO: 記事の id が見つかりません（ページの形が変わった可能性）');
  const out = [];
  for (let id = latest; id > latest - DAYS - 3 && id > 0; id--) {
    const p = parseCocomo(await get(`${base}?id=${id}`));
    if (!p.date) throw new Error(`COCOMO: 日付が読めません（id=${id}）`);
    if (p.date < cutoff) break;
    out.push({ date: p.date, url: `${base}?id=${id}`, text: p.creatures, collectUnknown: true });
  }
  return out;
}

/** @returns {Promise<Entry[]>} */
async function seaking() {
  const base = 'https://www.seaking-ds.com/seainfo_detail.php';
  const first = parseSeaking(await get(base));
  if (!first.date) throw new Error('シーキング: 日付が読めません（ページの形が変わった可能性）');
  const compact = (d) => d.replaceAll('-', '');
  const out = [];
  if (first.date >= cutoff) out.push({ date: first.date, url: `${base}?D=${compact(first.date)}`, text: first.creatures, collectUnknown: true });
  for (const d of first.days.filter((d) => d < compact(first.date)).sort().reverse()) {
    const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    if (date < cutoff) break;
    const p = parseSeaking(await get(`${base}?D=${d}`));
    if (p.date !== date) throw new Error(`シーキング: ${d} のページの日付が一致しません（${p.date}）`);
    out.push({ date, url: `${base}?D=${d}`, text: p.creatures, collectUnknown: true });
  }
  return out;
}

/** @returns {Promise<Entry[]>} */
async function leialoha() {
  const items = parseLeialohaFeed(await get('https://www.marinhouse-leialoha.com/blog-feed.xml'));
  // タイトルは自由な文なので、知らない名前の候補は集めない
  return items.filter((i) => i.date >= cutoff).map((i) => ({ date: i.date, url: i.url, text: i.title, collectUnknown: false }));
}

const SOURCES = [
  { name: 'COCOMO OSEZAKI', run: cocomo },
  { name: 'マリンハウス レイアロハ', run: leialoha },
  { name: 'ダイビングサービス シーキング', run: seaking },
];

// ---------- 実行 ----------
const incoming = [];
/** @type {Map<string, Set<string>>} 知らない名前 → 見た日付 */
const unmatchedNow = new Map();
const summary = [];
let failures = 0;
for (const src of SOURCES) {
  try {
    const entries = await src.run();
    let n = 0;
    for (const e of entries) {
      if (e.date > today) continue;
      const { fish: ids, unknown } = extractNames(e.text, dict, { collectUnknown: e.collectUnknown });
      for (const id of ids) incoming.push({ fish: id, spot: SPOT, date: e.date, sourceUrl: e.url, sourceName: src.name });
      n += ids.length;
      for (const u of unknown) unmatchedNow.set(u, (unmatchedNow.get(u) ?? new Set()).add(e.date));
    }
    summary.push(`- ${src.name}: ${entries.length}件のログから ${n}件`);
  } catch (err) {
    failures++;
    summary.push(`- ${src.name}: 取得できませんでした（${err.message}）`);
  }
}

const sightings = load('sightings');
const { all, added } = mergeSightings(sightings, incoming);
const errors = validate({ spots: load('spots'), fish, sightings: all });
if (errors.length) {
  console.error('検証エラーのため書き込みません:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

// 知らない名前は「名前と見た日付」だけを残す（辞書に入ったものは消す）。日付は新しい順に最大20件
const unmatchedPath = new URL('./fetch/unmatched-names.json', import.meta.url);
/** @type {Record<string,string[]>} */
const prev = JSON.parse(readFileSync(unmatchedPath, 'utf8'));
const unmatched = new Map(Object.entries(prev).filter(([k]) => !dict.byName.has(k) && !dict.ignore.has(k)));
for (const [k, dates] of unmatchedNow) {
  unmatched.set(k, [...new Set([...(unmatched.get(k) ?? []), ...dates])].sort().reverse().slice(0, 20));
}
const unmatchedSorted = Object.fromEntries(
  [...unmatched.entries()].sort((a, b) => b[1].length - a[1].length || b[1][0].localeCompare(a[1][0]) || a[0].localeCompare(b[0])),
);

const fishName = new Map(fish.map((f) => [f.id, f.name]));
const lines = [
  `## 大瀬崎の自動取得（${today}、過去${DAYS}日分）`,
  '',
  ...summary,
  '',
  `新しい記録: ${added.length}件`,
  ...added.map((r) => `- ${r.date} ${fishName.get(r.fish)}（${r.sourceName}）`),
  '',
  `fish.json にない名前（見た日数の多い順・上位40）: ${unmatchedNow.size}件`,
  ...[...unmatchedNow.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 40).map(([k, v]) => `- ${k}（${v.size}日）`),
  '',
  '※ 魚名・日付・出典URLだけを取り出しています。ログの文章や写真は保存していません。',
];
const report = lines.join('\n') + '\n';
console.log(report);
if (args.report) writeFileSync(args.report, report);

if (!DRY) {
  writeFileSync(dataPath('sightings'), JSON.stringify(all, null, 2) + '\n');
  writeFileSync(unmatchedPath, JSON.stringify(unmatchedSorted, null, 2) + '\n');
}
if (failures === SOURCES.length) process.exit(1);
