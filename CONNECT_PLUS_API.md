# Connect Plus 連携契約 v1

## 方針
- AuvexaConnectをアカウントの基準（Identity Provider）とする。
- Connect PlusはAuvexaConnectのユーザーIDを外部キーとして扱う。
- クライアントが送るuserIdだけで本人確認しない。サーバー間で署名付きトークン等を検証する。
- 本番では短寿命アクセストークンと更新トークン、audience検証、レート制限、監査ログを追加する。

## 共通ID
`ac_users.id` を `userId` として使用する。ユーザー名は変更可能な表示用識別子であり、連携キーにしない。

## Connect Plus側で持つデータ
- `auvexa_user_id` (unique)
- Connect Plus専用の11桁内部番号（電話回線の番号ではない）
- 通話履歴・着信状態・着信音などConnect Plus固有設定

## 想定イベント
- `profile.updated`
- `friend.followed`
- `notification.created`
- `account.suspended`

## API
`GET /api/connect-plus/compatibility` は契約バージョンと対応機能を返す。
このエンドポイントは互換性情報のみを返し、本人認証の代用にはならない。
