# AuvexaConnect — 第一弾完成版 / 第1分割

このパッケージはゼロから作るAuvexaConnectの第1分割です。
Mac・Android・iPhone/iPadで共通利用できるレスポンシブPWAを採用しています。
Connect Plusとは共通ユーザーID・API契約で連携できる構成です。

## 重要
- Cloudflare D1の既存データベースや既存テーブルを削除・変更するSQLは含めていません。
- `schema/001_core_additive.sql` は新規テーブルのみを追加します。既存テーブルと名前が衝突する場合は実行前に確認してください。
- 第1分割はアプリ基盤、認証、プロフィール、投稿、フレンド、通知、設定、管理・メンテナンス、Connect Plus連携契約を担当します。
- 劇場・授業・高度なチャット/通話・広告などの大きな機能群は、第2分割で同じAPI契約に追加する前提です。第1分割単体でそれらが完成済みとは扱いません。

## 開発
1. Node.js 20+ を用意
2. `npm install`
3. `npm run dev`
4. Cloudflareへ配置する場合は `wrangler.toml` のD1 database_idを既存DBのIDに設定
5. `schema/001_core_additive.sql` を内容確認後にD1へ適用

## 端末対応
- Mac: Safari / Firefox / Chrome
- Android: Chrome等のモダンブラウザ
- iPhone/iPad: Safari（ホーム画面追加対応）
- ネイティブアプリのストア配布ではなく、まず共通PWAとして提供します。

## アカウント
ログインはユーザー名とパスワードのみ。メールアドレスは要求しません。
パスワードはPBKDF2でハッシュ化し、平文保存しません。
本番ではHTTPS必須です。
