# AuvexaConnect – 統合開発版

このパッケージは、AuvexaConnect の再構築用プロジェクトです。既存の Cloudflare Worker 名・公開 URL を維持する場合は、デプロイ前に現在の Worker 名、ルート、D1 database_id を確認して合わせてください。

## 含まれるもの
- 多言語対応 UI 基盤（日本語・英語、設定から切替、localStorage保存）
- ホーム、動画、ショート動画、プロフィール、公開チャット、メール、フレンド、掲示板、設定の画面骨格
- Worker API の認証・投稿・コメント・フォロー・公開チャット・管理者停止・メンテナンス API
- D1 スキーマ
- 容量上限チェックの設計

## 必須設定
1. `wrangler.toml` の `database_id` を実際の D1 ID に置換。
2. Cloudflare Worker の Secrets に `ADMIN_PASSWORD_HASH` と `SESSION_SECRET` を設定。
3. `npm` 等のビルド工程は不要。静的ファイルを Worker Assets として配信する構成。
4. `npx wrangler d1 migrations apply <DB名> --remote` で migration を適用。
5. 既存 Worker にデプロイする場合、Worker 名を既存名に変更せず維持する。

## 重要な未接続機能
本パッケージ単体では、動画/画像の実ファイル保管、実メール配送、WebRTC 通話シグナリング、Web Push、Google OAuth、世界規模のスケーラブルなリアルタイム配信は完成していません。R2・Durable Objects・メール事業者・OAuth資格情報等の設定と追加実装が必要です。画面上でも未接続として扱います。管理者停止・メンテナンスはサーバー側で必ず検証してください。

## 容量制限
アプリ側のアップロードAPIに上限チェックを実装する前提です。Cloudflare側の課金そのものをこのコードだけで保証停止するものではありません。R2を接続するまではファイルアップロードを有効化しないでください。
