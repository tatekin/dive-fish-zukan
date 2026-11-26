// 使い方: npm run add-sighting -- <fishId> <spotId[:pointId]> <YYYY-MM-DD> <sourceUrl> [sourceName]
// 例: npm run add-sighting -- hanatatsu osezaki:wannai 2026-05-17 https://example.com/log/1 "○○ダイビング"
// ショップのログから「魚名・日付・スポット・出典URL」だけを記録します。
import { readFileSync, writeFileSync } from 'node:fs';
import { validate } from '../src/lib/schema.mjs';

const path = (n) => new URL(`../src/data/${n}.json`, import.meta.url);
const load = (n) => JSON.parse(readFileSync(path(n), 'utf8'));

const [fish, spotArg, date, sourceUrl, sourceName] = process.argv.slice(2);
const [spot, point] = (spotArg ?? '').split(':');
if (!fish || !spot || !date || !sourceUrl) {
  console.error('使い方: npm run add-sighting -- <fishId> <spotId[:pointId]> <YYYY-MM-DD> <sourceUrl> [sourceName]');
  process.exit(1);
}

const sightings = load('sightings');
const record = { fish, spot, ...(point ? { point } : {}), date, sourceUrl, ...(sourceName ? { sourceName } : {}) };
const next = [...sightings, record];
const errors = validate({ spots: load('spots'), fish: load('fish'), sightings: next });
if (errors.length) {
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
next.sort((a, b) => a.date.localeCompare(b.date) || a.spot.localeCompare(b.spot) || a.fish.localeCompare(b.fish));
writeFileSync(path('sightings'), JSON.stringify(next, null, 2) + '\n');
console.log('追加しました:', record);
