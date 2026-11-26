import { readFileSync } from 'node:fs';
import { validate } from '../src/lib/schema.mjs';

const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const data = { spots: load('spots'), fish: load('fish'), sightings: load('sightings') };
const errors = validate(data);

if (errors.length) {
  console.error(`データ検証エラー（${errors.length}件）:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`OK: スポット ${data.spots.length} / 魚 ${data.fish.length} / 目撃記録 ${data.sightings.length}`);
