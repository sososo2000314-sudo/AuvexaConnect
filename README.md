# AuvexaConnect 完成版ベース

AuvexaConnect の新規構築用 Cloudflare Workers + D1 プロジェクトです。

## 含まれるもの
- Worker API（登録・ログイン・セッション・プロフィール・投稿・いいね・コメント）
- アプリ内メール（`@auvexa.com` の内部メールボックス）
- ユーザー検索、通知、イベント、教室作成、機能リクエスト
- ユーザー設定（着信音・通知音・音量・テーマ・言語）
- 管理者API（`users.role='admin'` をサーバー側で検証）
- 緊急通知
- D1用スキーマ
- PC/スマホ対応UI

## 重要な制約（公開前に必ず対応）
1. `@auvexa.com` はアプリ内メールアドレスです。外部メールを送受信するにはドメイン所有権、DNS/MX、メール配信・受信事業者の契約とAPI接続が必要です。
2. 画面に表示する `000xxxxxxxx` は外部へ発信できないアプリ内識別番号です。実電話番号・SMS・公衆電話網の発着信には電話事業者の番号契約とAPI連携が必要です。
3. 通話のシグナリング保存APIの骨組みはありますが、実用通話にはWebRTCクライアント、TURNサーバー、着信通知（Push/WebSocket等）の追加実装・運用が必要です。
4. オンライン教室のDBテーブルはありますが、ホワイトボード共同同期、課題採点、小テスト実行、翻訳などの画面/APIは未完成です。
5. 管理者パネルのパスワードはサーバー側の `ADMIN_PANEL_PASSWORD` secret で照合し、認証成功時に1時間の管理者セッションを発行します。Cloudflareへ `npx wrangler secret put ADMIN_PANEL_PASSWORD` を実行し、値として `2824` を設定してください。管理者パネルに入れるユーザーはログイン済みである必要があります。
6. メディアアップロード、ウイルス検査、容量制限、通報・モデレーション、レート制限、メール検証、パスワード再設定、監査ログ、バックアップ、利用規約・プライバシー対応は公開前に追加してください。
7. Workerの「サーバー起動後の経過時間」はサーバーレス環境では常時稼働プロセスの起動時刻として定義できません。`/api/health` は現在時刻と稼働形態を返します。

## セットアップ
1. Cloudflare D1 `japan-connect-db` が存在することを確認。
2. `schema.sql` を一度だけ適用（IF NOT EXISTS なので再実行可能）:
   ```sh
   npx wrangler d1 execute japan-connect-db --remote --file=schema.sql
   ```
3. `wrangler.toml` の `database_id` が対象D1のIDと一致することを確認。
4. Cloudflareへデプロイ:
   ```sh
   npx wrangler secret put ADMIN_PANEL_PASSWORD  # 入力値: 2824\n   npx wrangler deploy
   ```
5. 初回登録後、Cloudflare D1コンソールで管理者にするユーザーを指定:
   ```sql
   UPDATE users SET role='admin' WHERE email='管理者のメールアドレス';
   ```
6. `/api/health` を開き `{"ok":true}` を確認。

## セキュリティ
- HTTPS上で利用すること。
- 本番の `APP_ORIGIN` を実際の公開URLに変更すること。
- 本番公開前にCSP、CSRF対策、ログイン試行制限、メール検証、管理者操作監査、バックアップを実装・検証すること。
- `virtual_phone` は先頭000の内部番号で、実電話番号ではありません。
