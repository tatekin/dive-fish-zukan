// データモデルの定義と検証（ビルド前に scripts/validate.mjs から実行）
// 出典ポリシー: 目撃記録に保存してよいのは「魚・スポット（とその中のポイント）・日付・出典URL・出典名」だけ。
// 本文・写真・コメント等のフィールドは追加できない（検証でエラーにする）。

export const SPOT_KEYS = ['id', 'name', 'prefecture', 'region', 'area', 'points'];
export const POINT_KEYS = ['id', 'name'];
export const FISH_KEYS = ['id', 'name', 'scientificName', 'family'];
export const SIGHTING_KEYS = ['fish', 'spot', 'point', 'date', 'sourceUrl', 'sourceName'];

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function checkKeys(obj, allowed, required, where, errors) {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) errors.push(`${where}: 許可されていないフィールド "${k}"（文章・写真などは保存しない方針です）`);
  }
  for (const k of required) {
    if (obj[k] === undefined || obj[k] === '') errors.push(`${where}: 必須フィールド "${k}" がありません`);
  }
}

export function validate({ spots, fish, sightings }) {
  const errors = [];
  const spotIds = new Set();
  /** @type {Map<string, Set<string>>} */
  const pointsBySpot = new Map();
  const fishIds = new Set();

  spots.forEach((s, i) => {
    const where = `spots[${i}]`;
    checkKeys(s, SPOT_KEYS, ['id', 'name', 'prefecture', 'region'], where, errors);
    if (s.id && !ID_RE.test(s.id)) errors.push(`${where}: id は半角英小文字・数字・ハイフンのみ`);
    if (spotIds.has(s.id)) errors.push(`${where}: id "${s.id}" が重複しています`);
    spotIds.add(s.id);
    const pts = new Set();
    if (s.points !== undefined && !Array.isArray(s.points)) errors.push(`${where}: points は配列`);
    (Array.isArray(s.points) ? s.points : []).forEach((p, j) => {
      const pw = `${where}.points[${j}]`;
      checkKeys(p, POINT_KEYS, ['id', 'name'], pw, errors);
      if (p.id && !ID_RE.test(p.id)) errors.push(`${pw}: id は半角英小文字・数字・ハイフンのみ`);
      if (pts.has(p.id)) errors.push(`${pw}: id "${p.id}" が重複しています`);
      pts.add(p.id);
    });
    pointsBySpot.set(s.id, pts);
  });

  fish.forEach((f, i) => {
    const where = `fish[${i}]`;
    checkKeys(f, FISH_KEYS, ['id', 'name'], where, errors);
    if (f.id && !ID_RE.test(f.id)) errors.push(`${where}: id は半角英小文字・数字・ハイフンのみ`);
    if (fishIds.has(f.id)) errors.push(`${where}: id "${f.id}" が重複しています`);
    fishIds.add(f.id);
  });

  const seen = new Set();
  sightings.forEach((r, i) => {
    const where = `sightings[${i}]`;
    checkKeys(r, SIGHTING_KEYS, ['fish', 'spot', 'date', 'sourceUrl'], where, errors);
    if (r.fish && !fishIds.has(r.fish)) errors.push(`${where}: 未登録の魚 "${r.fish}"`);
    if (r.spot && !spotIds.has(r.spot)) errors.push(`${where}: 未登録のスポット "${r.spot}"`);
    if (r.point !== undefined && spotIds.has(r.spot) && !pointsBySpot.get(r.spot)?.has(r.point)) {
      errors.push(`${where}: スポット "${r.spot}" に未登録のポイント "${r.point}"`);
    }
    if (r.date && (!DATE_RE.test(r.date) || Number.isNaN(Date.parse(r.date)))) errors.push(`${where}: 日付は YYYY-MM-DD 形式`);
    if (r.sourceUrl) {
      try {
        const u = new URL(r.sourceUrl);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
      } catch {
        errors.push(`${where}: sourceUrl が正しいURLではありません`);
      }
    }
    const key = `${r.fish}|${r.spot}|${r.point ?? ''}|${r.date}|${r.sourceUrl}`;
    if (seen.has(key)) errors.push(`${where}: 同じ記録が重複しています`);
    seen.add(key);
  });

  return errors;
}
