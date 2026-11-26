# 大瀬崎 魚図鑑（dive-fish-zukan）

ダイビングスポットで「いつ・どこで・どんな魚が見られたか」を **スポット × 魚 × 季節** でまとめた図鑑サイトです。
まずは **大瀬崎（静岡県・西伊豆）** から始めて、ゆくゆくは全国のスポットに広げる予定です。

[Astro](https://astro.build/) の静的サイトで、GitHub Pages で公開しています（費用0円）。

## 出典と掲載方針

目撃情報は、各ダイビングショップが公開しているログ（ブログ・海況報告など）を出典にしています。

- ログから抽出して掲載するのは **魚名・日付・スポット（ポイント）・出典URL（とショップ名）だけ** です。
- ログの **文章や写真は転載しません**。
- 各記録に **出典ページへのリンク** を表示しています。写真や詳しい様子は出典元でご覧ください。
- 掲載について削除・修正のご希望があれば Issue でお知らせください。すぐに対応します。

この方針はデータ検証でも強制しています。目撃記録に許可されたフィールド以外（`text`, `photo`, `comment` など）があるとビルドが失敗します。

> 出典にしているショップの一覧はサイトの「出典について」ページにあります。

## できること

- スポットで見られる魚と、月ごとの記録数（ヒートマップ）
- 魚ごとに、見られるスポット・ポイントと季節
- 月ごとに、その月に見られる魚
- すべての記録に出典リンク

## 構成

| 役割 | 使っているもの |
| --- | --- |
| サイト | Astro（静的サイト、クライアントJSなし） |
| データ | `src/data/*.json`（スポット・魚・目撃記録） |
| テスト・CI | Vitest、`astro check`、GitHub Actions |
| デプロイ | GitHub Actions → GitHub Pages |

### データモデル

| ファイル | 内容 | フィールド |
| --- | --- | --- |
| `spots.json` | スポット | `id`, `name`, `prefecture`, `region`, `area`(任意), `points`(任意: `{id, name}` の配列) |
| `fish.json` | 魚 | `id`, `name`(和名), `scientificName`(任意), `family`(任意) |
| `sightings.json` | 目撃記録 | `fish`, `spot`, `point`(任意), `date`(YYYY-MM-DD), `sourceUrl`, `sourceName`(任意) |

## 最初の準備（1回だけ）

1. GitHub で **公開（Public）** リポジトリ `dive-fish-zukan` を作り、コードを置く
   ※ 公開リポジトリは GitHub Actions が無制限。リポジトリに入るのはコードと公開情報（魚名・日付・出典URL）だけ
2. **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする
3. **Settings → Actions → General → Workflow permissions** を **Read and write permissions** にする
4. **Settings → Branches（または Rules → Rulesets）** で `main` にルールを追加
   - 「Require a pull request before merging」をオン
   - 「Require status checks to pass」をオンにして、チェック名 `test` を必須にする
5. [Claude GitHub App](https://github.com/apps/claude) をこのリポジトリにインストール

公開URL：`https://tatekin.github.io/dive-fish-zukan/`

## 普段の使い方（AIに頼むだけ）

Claude Code に「〇〇を追加して」と頼む。
→ `claude/` ブランチでPRが作られる → CI（型チェック・テスト・データ検証・ビルド）が通ると自動でマージ → GitHub Pages に反映。

## 手元で動かす場合

```sh
npm ci
npm run dev        # http://localhost:4321/dive-fish-zukan/
npm test           # テスト
npm run typecheck  # 型チェック
npm run build      # データ検証 + ビルド
```

### 目撃記録の追加

```sh
npm run add-sighting -- <魚id> <スポットid[:ポイントid]> <YYYY-MM-DD> <出典URL> [ショップ名]
# 例
npm run add-sighting -- hanatatsu osezaki:wannai 2026-05-17 https://example.com/log/123 "○○ダイビング"
```
