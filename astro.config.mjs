// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages（プロジェクトページ）用の設定。
// 独自ドメインやユーザーページに移す場合は SITE / BASE_PATH を変更してください。
const site = process.env.SITE || 'https://tatekin.github.io';
const base = process.env.BASE_PATH || '/dive-fish-zukan';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
});
