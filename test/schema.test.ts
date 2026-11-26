import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validate } from '../src/lib/schema.mjs';

const load = (name: string) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));

const base = () => ({
  spots: [{ id: 'osezaki', name: '大瀬崎', prefecture: '静岡県', region: '東海', points: [{ id: 'wannai', name: '湾内' }] }],
  fish: [{ id: 'kumanomi', name: 'クマノミ' }],
  sightings: [{ fish: 'kumanomi', spot: 'osezaki', point: 'wannai', date: '2026-07-12', sourceUrl: 'https://example.com/log/1' }],
});

describe('データ検証', () => {
  it('リポジトリのデータが検証を通る', () => {
    expect(validate({ spots: load('spots'), fish: load('fish'), sightings: load('sightings') })).toEqual([]);
  });

  it('正しいデータはエラーなし', () => {
    expect(validate(base())).toEqual([]);
  });

  describe('出典ポリシー：文章や写真は保存できない', () => {
    for (const key of ['text', 'body', 'comment', 'photo', 'imageUrl']) {
      it(`目撃記録に "${key}" があるとエラー`, () => {
        const d = base();
        Object.assign(d.sightings[0]!, { [key]: 'x' });
        expect(validate(d).join('\n')).toContain(`許可されていないフィールド "${key}"`);
      });
    }

    it('出典URLがないとエラー', () => {
      const d = base();
      delete (d.sightings[0] as Partial<(typeof d.sightings)[0]>).sourceUrl;
      expect(validate(d).join('\n')).toContain('sourceUrl');
    });

    it('http(s) 以外のURLはエラー', () => {
      const d = base();
      d.sightings[0]!.sourceUrl = 'javascript:alert(1)';
      expect(validate(d).join('\n')).toContain('sourceUrl');
    });
  });

  it('未登録の魚・スポット・ポイントはエラー', () => {
    const d = base();
    d.sightings.push({ fish: 'unknown', spot: 'nowhere', point: 'wannai', date: '2026-07-12', sourceUrl: 'https://example.com/2' });
    d.sightings.push({ fish: 'kumanomi', spot: 'osezaki', point: 'nowhere', date: '2026-07-12', sourceUrl: 'https://example.com/3' });
    const errors = validate(d).join('\n');
    expect(errors).toContain('未登録の魚');
    expect(errors).toContain('未登録のスポット');
    expect(errors).toContain('未登録のポイント');
  });

  it('日付の形式が違うとエラー', () => {
    const d = base();
    d.sightings[0]!.date = '2026/7/12';
    expect(validate(d).join('\n')).toContain('YYYY-MM-DD');
  });

  it('同じ記録の重複はエラー', () => {
    const d = base();
    d.sightings.push({ ...d.sightings[0]! });
    expect(validate(d).join('\n')).toContain('重複');
  });
});
