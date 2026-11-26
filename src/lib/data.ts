import spotsJson from '../data/spots.json';
import fishJson from '../data/fish.json';
import sightingsJson from '../data/sightings.json';

export interface Point { id: string; name: string }
export interface Spot { id: string; name: string; prefecture: string; region: string; area?: string; points?: Point[] }
export interface Fish { id: string; name: string; scientificName?: string; family?: string }
export interface Sighting { fish: string; spot: string; point?: string; date: string; sourceUrl: string; sourceName?: string }

export const spots: Spot[] = spotsJson;
export const fish: Fish[] = fishJson;
export const sightings: Sighting[] = [...(sightingsJson as Sighting[])].sort((a, b) => b.date.localeCompare(a.date));

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export const REGIONS = ['北海道', '東北', '関東', '伊豆諸島・小笠原', '北陸', '東海', '近畿', '中国', '四国', '九州', '沖縄'];

export const monthOf = (s: Sighting) => Number(s.date.slice(5, 7));
export const spotById = new Map(spots.map((s) => [s.id, s]));
export const fishById = new Map(fish.map((f) => [f.id, f]));

/** 「大瀬崎・湾内」のような表示名 */
export function placeName(s: Sighting, withSpot = true): string {
  const spot = spotById.get(s.spot);
  const point = s.point ? spot?.points?.find((p) => p.id === s.point)?.name : undefined;
  if (!withSpot) return point ?? '';
  return point ? `${spot?.name}・${point}` : (spot?.name ?? s.spot);
}

/** スポットが1か所だけのあいだは、トップページをそのスポットのページとして見せる */
export const singleSpot: Spot | undefined = spots.length === 1 ? spots[0] : undefined;
export const SITE_NAME = singleSpot ? `${singleSpot.name} 魚図鑑` : 'ダイビング魚図鑑';

/** 月ごとの記録件数（index 0 = 1月） */
export function monthCounts(list: Sighting[]): number[] {
  const c = Array(12).fill(0);
  for (const s of list) c[monthOf(s) - 1]++;
  return c;
}

export function groupBy<T, K>(list: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const t of list) {
    const k = key(t);
    const arr = m.get(k);
    if (arr) arr.push(t);
    else m.set(k, [t]);
  }
  return m;
}

export function spotsByRegion(): [string, Spot[]][] {
  const g = groupBy(spots, (s) => s.region);
  const order = (r: string) => (REGIONS.indexOf(r) === -1 ? 99 : REGIONS.indexOf(r));
  return [...g.entries()].sort((a, b) => order(a[0]) - order(b[0]));
}

export const url = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

export function hostOf(u: string): string {
  try { return new URL(u).hostname; } catch { return u; }
}
