# AWS認証情報の取得と設定ガイド

## 🔐 AWS認証情報とは？

AWS CLIやSDKを使ってAWSサービスにアクセスするために必要な2つの鍵：
- **Access Key ID**: 公開鍵（例: `AKIAIOSFODNN7EXAMPLE`）
- **Secret Access Key**: 秘密鍵（例: `wJalrXUtnFEMI/K7MDENG/bPxRfiCY...`）

---

## 📋 ステップ1: AWSアカウントの確認

### AWSアカウントを持っている場合
→ ステップ2へ進む

### AWSアカウントを持っていない場合
1. https://aws.amazon.com/jp/ にアクセス
2. 「無料でアカウント作成」をクリック
3. メールアドレス、クレジットカード情報を登録
4. 電話番号認証を完了

**注意**: クレジットカードが必要ですが、無料枠内であれば課金されません。

---

## 📋 ステップ2: IAMユーザーの作成

### 2-1. AWSコンソールにログイン

1. https://console.aws.amazon.com/ にアクセス
2. ルートユーザー（メールアドレス）でログイン

### 2-2. IAMサービスに移動

1. 検索バーに「IAM」と入力
2. 「IAM」サービスをクリック

### 2-3. ユーザーを作成

1. 左メニューの **「ユーザー」** をクリック
2. **「ユーザーを作成」** ボタンをクリック
3. ユーザー名を入力（例: `lambda-admin`）
4. **「次へ」** をクリック

### 2-4. 権限を設定

**方法1: 管理者権限を付与（簡単・推奨）**
1. **「ポリシーを直接アタッチする」** を選択
2. 検索バーに「AdministratorAccess」と入力
3. **「AdministratorAccess」** にチェック
4. **「次へ」** をクリック

**方法2: 必要最小限の権限（セキュア）**
以下のポリシーにチェック：
- `AWSLambda_FullAccess`
- `AmazonEC2ContainerRegistryFullAccess`
- `IAMFullAccess`
- `CloudWatchLogsFullAccess`

### 2-5. 確認して作成

1. 設定内容を確認
2. **「ユーザーの作成」** をクリック

---

## 📋 ステップ3: アクセスキーの作成

### 3-1. ユーザーの詳細画面に移動

1. 作成したユーザー（例: `lambda-admin`）をクリック
2. **「セキュリティ認証情報」** タブをクリック

### 3-2. アクセスキーを作成

1. **「アクセスキーを作成」** ボタンをクリック
2. 使用目的を選択：**「コマンドラインインターフェイス (CLI)」**
3. 確認チェックボックスにチェック
4. **「次へ」** をクリック
5. 説明タグを入力（例: `Lambda開発用`）※任意
6. **「アクセスキーを作成」** をクリック

### 3-3. 認証情報をコピー

**重要**: この画面は一度しか表示されません！

```
Access Key ID: AKIAIOSFODNN7EXAMPLE
Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**必ず両方をコピーして安全な場所に保存してください！**

オプション:
- **「.csvファイルをダウンロード」** をクリックして保存（推奨）
- メモ帳などにコピー

---

## 📋 ステップ4: AWS CLIに設定

### 方法1: `aws configure` コマンド（対話形式）

ターミナルで以下を実行：

```bash
aws configure
```

以下のように入力：

```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: ap-northeast-1
Default output format [None]: json
```

### 方法2: 直接ファイルを編集

`~/.aws/credentials` ファイルを作成・編集：

```bash
mkdir -p ~/.aws
cat > ~/.aws/credentials << 'EOF'
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
EOF
```

`~/.aws/config` ファイルを作成・編集：

```bash
cat > ~/.aws/config << 'EOF'
[default]
region = ap-northeast-1
output = json
EOF
```

---

## 📋 ステップ5: 設定の確認

以下のコマンドで確認：

```bash
# 認証情報の確認
aws sts get-caller-identity
```

**成功時の出力例:**
```json
{
    "UserId": "AIDAI23HXS4EXAMPLE",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/lambda-admin"
}
```

**エラーが出る場合:**
```
Unable to locate credentials
```
→ ステップ4をもう一度確認

---

## 🎯 設定完了後

認証情報が設定できたら、Lambda関数の作成を開始できます！

```bash
cd /Users/komodatomo/Desktop/onsei-laboratory/mental-app-test/lambda_inference
./setup-lambda.sh
```

---

## 🔒 セキュリティのベストプラクティス

### ✅ やるべきこと
- [ ] アクセスキーは安全な場所に保管
- [ ] `.gitignore` に `~/.aws/credentials` を追加（既に追加済み）
- [ ] 不要になったアクセスキーは削除
- [ ] 定期的にアクセスキーをローテーション

### ❌ やってはいけないこと
- ❌ アクセスキーをGitHubにプッシュ
- ❌ アクセスキーをSlackやメールで共有
- ❌ ルートユーザーのアクセスキーを使用
- ❌ 複数人で同じアクセスキーを共有

---

## 🐛 トラブルシューティング

### エラー: "Unable to locate credentials"

**原因**: 認証情報が正しく設定されていない

**解決策**:
```bash
# 設定ファイルの確認
cat ~/.aws/credentials
cat ~/.aws/config

# 再設定
aws configure
```

### エラー: "An error occurred (UnauthorizedOperation)"

**原因**: IAMユーザーに必要な権限がない

**解決策**:
1. AWSコンソール > IAM > ユーザー
2. 該当ユーザーをクリック
3. 「許可」タブで必要なポリシーを追加

### エラー: "The security token included in the request is invalid"

**原因**: アクセスキーが無効または削除されている

**解決策**:
1. AWSコンソールで新しいアクセスキーを作成
2. `aws configure` で再設定

---

## 📞 サポート

設定でわからないことがあれば、具体的なエラーメッセージを教えてください！
