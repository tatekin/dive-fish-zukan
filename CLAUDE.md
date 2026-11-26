# 大瀬崎 魚図鑑（dive-fish-zukan）

ダイビングスポットで「いつ・どこで・どんな魚が見られたか」を **スポット × 魚 × 季節** でまとめる静的サイト。
最初は **大瀬崎（静岡県・西伊豆）だけ** で始め、うまくいったら全国のスポットに広げる。
勉強・趣味で作るもの。

## 方針（決定事項）

- **費用は0円**。どのサービスにもクレジットカードを登録しない。
- **リポジトリは公開**（公開リポジトリは GitHub Actions が無制限で使えるため）。
- **出典ポリシー（いちばん大事）**
  - ショップのログから抽出して保存するのは **魚名・日付・スポット（ポイント）・出典URL（とショップ名）だけ**。
  - ログの **文章や写真は転載しない**。要約・言い換えもしない。
  - 各記録には **出典ページへのリンク** を必ず表示する。
  - 削除・修正の依頼があったらすぐ対応する。
  - この方針は `src/lib/schema.mjs` の検証で強制している。目撃記録に `text` や `photo` などのフィールドを足さないこと（足すとビルドが落ちる）。
- **大瀬崎限定でも、全国に広げられる構造にしておく**。スポットを `spots.json` に足せば、スポット一覧・地域別表示が自動で出る（スポットが1か所の間はトップページがそのスポットのページになる）。

## 技術スタック

- サイト：[Astro](https://astro.build/) の静的サイト（`output: static`）。クライアント側のJavaScriptは使わない
- データ：`src/data/*.json`（DBは使わない。データの変更もPRで行う）
- テスト：Vitest（`test/`）。型チェックは `astro check`
- Node.js 24
- ホスティング：GitHub Pages（`https://tatekin.github.io/dive-fish-zukan/`）
- CI・デプロイ：GitHub Actions（`.github/workflows/`）

## データモデル（`src/data/`）

- `spots.json`：`id`, `name`, `prefecture`, `region`, `area`(任意), `points`(任意。スポット内のポイント `{id, name}` の配列。大瀬崎なら湾内・先端・柵下・門下・一本松)
- `fish.json`：`id`, `name`(和名), `scientificName`(任意), `family`(任意)
- `sightings.json`：目撃記録。`fish`, `spot`, `point`(任意), `date`(YYYY-MM-DD), `sourceUrl`, `sourceName`(任意。ショップ名)
- `id` は半角英小文字・数字・ハイフン。魚の `id` は和名のローマ字（例：`hanatatsu`）
- 季節は `date` の月で集計する（1〜12月のヒートマップ）
- 今入っている目撃記録は **すべて動作確認用のサンプル**（出典URLが `example.com`）。実データが入ったら消す

## ページ

- `/`：スポットが1か所ならそのスポットのページ、複数ならトップ
- `/spots/`, `/spots/<id>/`：スポット一覧・スポットで見られる魚と月別ヒートマップ
- `/fish/`, `/fish/<id>/`：魚一覧・魚が見られるスポットと季節
- `/months/<1-12>/`：その月に見られる魚
- `/about/`：出典と掲載方針
- リンクは必ず `src/lib/data.ts` の `url()` を通す（GitHub Pages ではサイトが `/dive-fish-zukan/` 配下になるため）

## 開発フロー（AIに頼むだけで本番反映）

1. 作業は `claude/` で始まるブランチで行い、完了したらPRを作る（ドラフトにはしない）
2. GitHub Actions（`ci.yml` の `test` ジョブ）で型チェック・テスト・データ検証・ビルドが走る
3. CIが通ったら、同じワークフローの `merge-and-deploy` ジョブが PR を squash マージする
4. 続けて同じジョブが `deploy.yml` を起動し、GitHub Pages に反映する
   （`GITHUB_TOKEN` によるマージでは push トリガーのワークフローが起動しないため、workflow_dispatch で明示的に起動している）
5. CIが落ちたら原因を調べて修正をpushする

## コマンド

- `npm run dev`：ローカルで起動（`http://localhost:4321/dive-fish-zukan/`）
- `npm run typecheck`：型チェック
- `npm test`：テスト
- `npm run validate`：データ検証だけ
- `npm run build`：データ検証＋ビルド（`dist/`）
- `npm run add-sighting -- <魚id> <スポットid[:ポイントid]> <YYYY-MM-DD> <出典URL> [ショップ名]`：目撃記録を1件追加

## ショップのログから記録を追加するとき

- 抽出するのは「どの魚が・いつ・どこ（ポイント）で見られたか」と出典URLだけ。ログの文章を `sightings.json` やコミットメッセージ、PR本文に貼らない
- 1つのログに複数の魚が出ていれば、魚ごとに1件ずつ記録する
- 日付はダイブした日（分からなければログの投稿日）
- 魚の名前はログの表記ではなく標準和名にそろえる。新しい魚は先に `fish.json` に追加する
- 「〇〇っぽい」「たぶん」など同定があいまいなものは記録しない
- 出典サイトの利用規約・robots.txt で禁止されている場合は、そのサイトからは抽出しない

## 作業ルール

- テスト・型チェック・ビルドが通ることを確認してからpushする
- 「文章・写真のフィールドがあると検証で落ちる」「出典URLが必須」はテストで守る（`test/schema.test.ts`）
- APIキーやパスワードはコードに書かない

## 最初の準備（人間がブラウザで1回だけやる）

- [ ] GitHubで公開リポジトリ `dive-fish-zukan` を作成（空のまま。README等は作らない）
- [ ] Claude GitHub Appをリポジトリにインストール
- [ ] **Settings → Pages → Build and deployment → Source** を「GitHub Actions」にする
- [ ] **Settings → Branches（または Rules → Rulesets）** で `main` に「PR必須」「ステータスチェック `test` 必須」を設定
- [ ] **Settings → Actions → General → Workflow permissions** を「Read and write permissions」にする（CIからマージ・デプロイ起動するため）

手順の詳細は README.md を参照。

## 次にやること

- 大瀬崎のショップのログから実データを集める（どのショップを出典にするか決める）
- 実データが入ったらサンプルの目撃記録を削除する
- 大瀬崎で手応えがあれば、ほかのスポットを追加する
