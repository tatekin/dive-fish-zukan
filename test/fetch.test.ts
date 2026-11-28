import { describe, expect, it } from 'vitest';
import {
  buildDictionary, extractNames, mergeSightings, parseCocomo, parseLeialohaFeed, parseSeaking, robotsAllows, sentenceFrom,
} from '../scripts/fetch/lib.mjs';

// テスト用の架空のページ（実際のショップの文章は使わない）
const dict = buildDictionary(
  [
    { id: 'buri', name: 'ブリ' },
    { id: 'hanatatsu', name: 'ハナタツ' },
    { id: 'kumadorikaeruankou', name: 'クマドリカエルアンコウ' },
    { id: 'perikurimenesu', name: 'ペリクリメネス・ダルタニコラ' },
  ],
  { aliases: { クマドリカエル: 'kumadorikaeruankou' }, ignore: ['タイプ'], ignoreSuffixes: ['エビ', 'ウミウシ'] },
);

describe('名前の抽出', () => {
  it('辞書にある名前を取り出し、ないものは候補にする', () => {
    const r = extractNames('ハナタツのペアー、ブリモドキ、クマドリカエル幼魚、ｲﾊﾞﾗﾀﾂ', dict);
    expect(r.fish.sort()).toEqual(['hanatatsu', 'kumadorikaeruankou']);
    expect(r.unknown.sort()).toEqual(['イバラタツ', 'ブリモドキ']);
  });
  it('後ろに付いた「ペア」は外す', () => {
    expect(extractNames('ハナタツペア', dict).fish).toEqual(['hanatatsu']);
  });
  it('「ブリ」が「ブリモドキ」に一致しない', () => {
    expect(extractNames('ブリモドキ', dict).fish).toEqual([]);
  });
  it('あいまい・見られなかったものは記録しない', () => {
    expect(extractNames('ハナタツっぽい魚、ブリ？、クマドリカエルアンコウは見つからず', dict).fish).toEqual([]);
  });
  it('中黒を含む名前と、中黒で区切った列挙の両方を扱う', () => {
    expect(extractNames('ペリクリメネス・ダルタニコラ', dict).fish).toEqual(['perikurimenesu']);
    expect(extractNames('ブリ・ハナタツ', dict).fish.sort()).toEqual(['buri', 'hanatatsu']);
  });
  it('魚でないものや一般語は候補にしない', () => {
    expect(extractNames('オトヒメエビ、アオウミウシ、タイプ、ペア', dict).unknown).toEqual([]);
  });
  it('collectUnknown: false なら候補を集めない', () => {
    expect(extractNames('ブリモドキ', dict, { collectUnknown: false }).unknown).toEqual([]);
  });
  it('sentenceFrom は目印から「。」まで', () => {
    expect(sentenceFrom('天気は晴れ。生物は、ブリ、ハナタツが見られました。明日は雨。', '生物は')).toBe('、ブリ、ハナタツが見られました');
  });
});

describe('COCOMO の海洋情報', () => {
  const html = `<section><h2>海洋情報</h2><h3 class="heading">2026年11月7日 海洋情報</h3>
    <div class="row"><div class="8u"><div class="detailText">天気は晴れでした。<br><br>生き物はハナタツ、ブリの群れなどが見られました。<br><br>今日の写真は<br>クマドリカエルアンコウ<br>オトヒメエビです</div></div></div>
    <a href="?id=101">a</a><a href="?id=100">b</a></section>`;
  it('日付・生物の部分・id を取り出す', () => {
    const p = parseCocomo(html);
    expect(p.date).toBe('2026-11-07');
    expect(p.ids).toEqual([101, 100]);
    expect(extractNames(p.creatures, dict).fish.sort()).toEqual(['buri', 'hanatatsu', 'kumadorikaeruankou']);
    expect(p.creatures).not.toContain('天気');
  });
  it('形が違うページでは日付が取れない', () => {
    expect(parseCocomo('<html></html>').date).toBeUndefined();
  });
});

describe('シーキングの海況情報', () => {
  const html = `<h2>海況情報 2026/11/27</h2><div class="calendar-nav"><a href="?D=20261126">前へ</a></div>
    <div class="card"><h3>１１月２７日</h3><div class="body">今日は晴れ。<br>生物は、ハナタツ、<br>ブリの群れが見られました。<br>明日は雨。</div></div>
    <div class="date-list"><a href="?D=20261126">26</a>|<a href="?D=20261125">25</a></div>`;
  it('日付・生物の部分・過去の日付を取り出す', () => {
    const p = parseSeaking(html);
    expect(p.date).toBe('2026-11-27');
    expect(p.days).toEqual(['20261126', '20261125']);
    expect(extractNames(p.creatures, dict).fish.sort()).toEqual(['buri', 'hanatatsu']);
  });
});

describe('レイアロハの RSS', () => {
  const xml = `<rss><channel>
    <item><title><![CDATA[かわいいハナタツ　2026/11/27（金）]]></title><link>https://example.com/post/%E3%81%82</link><category><![CDATA[大瀬崎海洋速報]]></category><pubDate>Fri, 27 Nov 2026 08:00:25 GMT</pubDate></item>
    <item><title><![CDATA[ブリの群れ]]></title><link>https://example.com/post/b</link><category><![CDATA[大瀬崎海洋速報]]></category><pubDate>Wed, 25 Nov 2026 16:00:00 GMT</pubDate></item>
    <item><title><![CDATA[ハナタツ　IOP]]></title><link>https://example.com/post/c</link><category><![CDATA[IOP海洋速報]]></category><pubDate>Tue, 24 Nov 2026 09:00:00 GMT</pubDate></item>
  </channel></rss>`;
  it('大瀬崎の記事だけ、タイトルの日付（なければ日本時間の投稿日）で返す', () => {
    const items = parseLeialohaFeed(xml);
    expect(items.map((i) => i.date)).toEqual(['2026-11-27', '2026-11-26']);
    expect(items[0]!.url).toBe('https://example.com/post/あ');
  });
});

describe('robots.txt', () => {
  it('Disallow / Allow と自分のUA向けのグループを見る', () => {
    const txt = 'User-agent: *\nDisallow: /private/\nAllow: /private/ok\n\nUser-agent: BadBot\nDisallow: /';
    expect(robotsAllows(txt, '/log')).toBe(true);
    expect(robotsAllows(txt, '/private/x')).toBe(false);
    expect(robotsAllows(txt, '/private/ok')).toBe(true);
    expect(robotsAllows('User-agent: dive-fish-zukan-bot\nDisallow: /', '/log')).toBe(false);
    expect(robotsAllows('', '/log')).toBe(true);
    expect(robotsAllows('User-agent: *\nDisallow:', '/log')).toBe(true);
  });
});

describe('記録のマージ', () => {
  it('重複を足さず、新しい日付順に並べる', () => {
    const a = { fish: 'buri', spot: 'osezaki', date: '2026-11-01', sourceUrl: 'https://example.com/1' };
    const b = { fish: 'hanatatsu', spot: 'osezaki', date: '2026-11-02', sourceUrl: 'https://example.com/2' };
    const { all, added } = mergeSightings([a], [a, b]);
    expect(added).toEqual([b]);
    expect(all).toEqual([b, a]);
  });
});
