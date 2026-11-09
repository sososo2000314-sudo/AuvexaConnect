# AuvexaConnect — 実装パッケージ

このパッケージは、AuvexaConnect の実行可能な土台と、D1を使う基本SNS機能をまとめたものです。

## 実装済み
- PC/スマホ対応のホーム・動画・メール・フレンド・板・マイページ画面
- ライト/ナイトテーマ切替（端末に保存）
- D1を使ったメールアドレス登録・ログイン、プロフィール取得/更新
- 投稿作成・一覧、いいね、コメント
- フォロー/フォロー解除、相互フォロー判定
- 板の一覧・作成・投稿
- 管理者ログイン（Cloudflare Secret `ADMIN_PASSWORD` を使用）
- 管理者向け概要・メンテナンス告知の更新
- R2が未設定でもアプリ本体は動作。ファイルアップロードは無効表示

## まだ別途サービス接続・実装が必要
実際の動画/画像ファイル保管、メール配送、Web Push、通話の着信シグナリング、グループ通話、Googleログイン、大型会議、災害安否確認の一斉配信はこのパッケージだけでは完成しません。画面に準備中と表示し、成功したように見せかけません。

## Cloudflareへの設定
1. ZIPを解凍し、中身をGitHubリポジトリのルートへアップロードします。
2. Cloudflare D1でデータベースを作り、`wrangler.toml` の `database_id` にIDを設定します。
3. `npx wrangler d1 migrations apply auvexa-connect-db --remote` を実行します。
4. `npx wrangler secret put ADMIN_PASSWORD` を実行し、管理者パスワード `2824` を入力します。
5. `npx wrangler secret put SESSION_SECRET` を実行し、十分に長いランダム文字列を設定します。
6. Cloudflare Workerをデプロイします。

`wrangler.toml` の `database_id = "ここにD1のデータベースID"` は必ず実際のIDに置き換えてください。既存Worker名・ドメインを維持したい場合、`name` は現在のWorker名に合わせてください。

## R2について
R2は今は必須にしていません。ユーザーが心配している無料枠超過課金を避けるため、R2への自動アップロードは行いません。将来R2を接続する場合も、アプリ側の容量制限だけでCloudflare側の超過請求を完全保証できるわけではありません。Cloudflareの請求設定・使用量監視も別途必要です。

## セキュリティ
- パスワードはPBKDF2でハッシュ化して保存します。
- 管理者パスワードはソースコードに含めずSecretで管理します。
- ログインセッションはHttpOnly/Secure/SameSite Cookieです。
- 本番公開前にHTTPS、D1設定、Secret設定、認証テストを行ってください。
