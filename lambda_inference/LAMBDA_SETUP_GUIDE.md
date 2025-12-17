# AWS Lambda 感情分析関数 作成手順

## 📋 前提条件

### 必要なツール
- ✅ AWS CLI（インストール済み・設定済み）
- ✅ Docker（インストール済み）
- ✅ AWSアカウント（適切な権限）

### 確認コマンド
```bash
# AWS CLIのバージョン確認
aws --version

# AWS認証情報の確認
aws sts get-caller-identity

# Dockerの確認
docker --version
```

---

## 🚀 ステップ1: モデルファイルの準備

```bash
# lambda_inferenceディレクトリに移動
cd /Users/komodatomo/Desktop/onsei-laboratory/mental-app-test/lambda_inference

# modelディレクトリを作成
mkdir -p model

# モデルファイルをコピー
cp /Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning/model/model_20241026_HCUDB.pkl model/

# ファイルが存在することを確認
ls -lh model/model_20241026_HCUDB.pkl
```

**期待される出力:**
```
-rw-r--r--  1 user  staff   XXX MB  Oct 26  2024 model/model_20241026_HCUDB.pkl
```

---

## 🚀 ステップ2: IAMロールの作成

Lambda関数には実行用のIAMロールが必要です。

### 2-1. 信頼ポリシーの作成

`trust-policy.json` を作成:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### 2-2. IAMロールの作成

```bash
# IAMロールを作成
aws iam create-role \
  --role-name lambda-emotion-analysis-role \
  --assume-role-policy-document file://trust-policy.json

# 基本的な実行権限をアタッチ
aws iam attach-role-policy \
  --role-name lambda-emotion-analysis-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# ロールのARNを取得（後で使用）
aws iam get-role \
  --role-name lambda-emotion-analysis-role \
  --query 'Role.Arn' \
  --output text
```

**出力例:**
```
arn:aws:iam::123456789012:role/lambda-emotion-analysis-role
```

このARNを控えておいてください。

---

## 🚀 ステップ3: ECRリポジトリの作成

Dockerイメージを保存するためのECRリポジトリを作成します。

```bash
# AWSアカウントIDを取得
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION="ap-northeast-1"
export ECR_REPO_NAME="emotion-analysis-repo"

echo "AWS Account ID: $AWS_ACCOUNT_ID"
echo "Region: $AWS_REGION"

# ECRリポジトリを作成
aws ecr create-repository \
  --repository-name $ECR_REPO_NAME \
  --region $AWS_REGION \
  --image-scanning-configuration scanOnPush=true

# リポジトリURIを確認
aws ecr describe-repositories \
  --repository-names $ECR_REPO_NAME \
  --region $AWS_REGION \
  --query 'repositories[0].repositoryUri' \
  --output text
```

**出力例:**
```
123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/emotion-analysis-repo
```

---

## 🚀 ステップ4: Dockerイメージのビルドとプッシュ

### 4-1. ECRにログイン

```bash
# ECRにログイン
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

**成功時の出力:**
```
Login Succeeded
```

### 4-2. Dockerイメージをビルド

```bash
# lambda_inferenceディレクトリにいることを確認
pwd
# 出力: /Users/komodatomo/Desktop/onsei-laboratory/mental-app-test/lambda_inference

# Dockerイメージをビルド（5-10分かかります）
docker build --platform linux/amd64 -t $ECR_REPO_NAME:latest .
```

**ビルド中の出力例:**
```
[+] Building 234.5s (12/12) FINISHED
 => [internal] load build definition from Dockerfile
 => => transferring dockerfile: 653B
 => [internal] load .dockerignore
 => [1/6] FROM public.ecr.aws/lambda/python:3.11
 => [2/6] WORKDIR /var/task
 => [3/6] RUN yum install -y libsndfile
 => [4/6] COPY requirements.txt .
 => [5/6] RUN pip install --no-cache-dir -r requirements.txt
 => [6/6] COPY . .
 => exporting to image
 => => writing image sha256:abc123...
 => => naming to docker.io/library/emotion-analysis-repo:latest
```

### 4-3. イメージにタグ付け

```bash
# ECR用のタグを付ける
docker tag $ECR_REPO_NAME:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:latest
```

### 4-4. ECRにプッシュ

```bash
# ECRにプッシュ（3-5分かかります）
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:latest
```

**成功時の出力:**
```
The push refers to repository [123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/emotion-analysis-repo]
latest: digest: sha256:abc123... size: 4567
```

---

## 🚀 ステップ5: Lambda関数の作成

### 5-1. イメージURIを取得

```bash
export IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:latest"
echo "Image URI: $IMAGE_URI"
```

### 5-2. Lambda関数を作成

```bash
# 先ほど取得したIAMロールのARNを設定
export ROLE_ARN="arn:aws:iam::$AWS_ACCOUNT_ID:role/lambda-emotion-analysis-role"

# Lambda関数を作成
aws lambda create-function \
  --function-name emotion-analysis-lambda \
  --package-type Image \
  --code ImageUri=$IMAGE_URI \
  --role $ROLE_ARN \
  --timeout 30 \
  --memory-size 2048 \
  --region $AWS_REGION \
  --architectures x86_64
```

**成功時の出力:**
```json
{
    "FunctionName": "emotion-analysis-lambda",
    "FunctionArn": "arn:aws:lambda:ap-northeast-1:123456789012:function:emotion-analysis-lambda",
    "Role": "arn:aws:iam::123456789012:role/lambda-emotion-analysis-role",
    "CodeSize": 0,
    "Handler": "",
    "Runtime": "",
    "Timeout": 30,
    "MemorySize": 2048,
    "LastModified": "2024-12-08T09:46:00.000+0000",
    "State": "Pending",
    "StateReason": "The function is being created.",
    "PackageType": "Image"
}
```

### 5-3. 関数の状態を確認

```bash
# 関数が準備完了するまで待つ（1-2分）
aws lambda wait function-active-v2 \
  --function-name emotion-analysis-lambda \
  --region $AWS_REGION

# 状態を確認
aws lambda get-function \
  --function-name emotion-analysis-lambda \
  --region $AWS_REGION \
  --query 'Configuration.State' \
  --output text
```

**期待される出力:**
```
Active
```

---

## 🚀 ステップ6: Function URLの作成（HTTPSエンドポイント）

Lambda Function URLを使うと、HTTPSエンドポイントが自動で作成されます。

```bash
# Function URLを作成
aws lambda create-function-url-config \
  --function-name emotion-analysis-lambda \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["*"],
    "AllowMethods": ["POST"],
    "AllowHeaders": ["content-type"],
    "MaxAge": 86400
  }' \
  --region $AWS_REGION

# Function URLを取得
aws lambda get-function-url-config \
  --function-name emotion-analysis-lambda \
  --region $AWS_REGION \
  --query 'FunctionUrl' \
  --output text
```

**出力例:**
```
https://abcdef123456.lambda-url.ap-northeast-1.on.aws/
```

このURLを `.env.local` に設定します。

---

## 🚀 ステップ7: テスト実行

### 7-1. テストペイロードの準備

`test-payload.json`:
```json
{
  "audio_base64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
  "format": "wav"
}
```

### 7-2. Lambda関数を直接テスト

```bash
# Lambda関数を呼び出し
aws lambda invoke \
  --function-name emotion-analysis-lambda \
  --payload file://test-payload.json \
  --region $AWS_REGION \
  response.json

# レスポンスを確認
cat response.json
```

**期待される出力:**
```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  "body": "{\"arousal\": 4.12, \"valence\": 3.85, \"dominance\": 4.05}"
}
```

### 7-3. Function URLをテスト

```bash
# Function URLを使ってHTTPリクエスト
export FUNCTION_URL=$(aws lambda get-function-url-config \
  --function-name emotion-analysis-lambda \
  --region $AWS_REGION \
  --query 'FunctionUrl' \
  --output text)

curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

---

## 🚀 ステップ8: 環境変数の設定

`.env.local` に以下を追加:

```bash
# OpenAI Realtime API
NEXT_PUBLIC_OPENAI_API_KEY=sk-proj-your-key-here

# AWS Lambda Function URL（ステップ6で取得したURL）
NEXT_PUBLIC_LAMBDA_ENDPOINT=https://abcdef123456.lambda-url.ap-northeast-1.on.aws/
```

---

## 🚀 ステップ9: CloudWatch Logsの確認

```bash
# ログストリームを確認
aws logs tail /aws/lambda/emotion-analysis-lambda \
  --follow \
  --region $AWS_REGION
```

---

## 📊 作成完了後の確認チェックリスト

- [ ] ECRリポジトリが作成されている
- [ ] Dockerイメージがプッシュされている
- [ ] IAMロールが作成されている
- [ ] Lambda関数が作成されている（State: Active）
- [ ] Function URLが作成されている
- [ ] テスト実行が成功している
- [ ] `.env.local` に環境変数が設定されている

---

## 🔧 トラブルシューティング

### エラー: "No such file or directory: model/model_20241026_HCUDB.pkl"

**原因**: モデルファイルがコピーされていない

**解決策**:
```bash
cp /Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning/model/model_20241026_HCUDB.pkl model/
```

### エラー: "AccessDeniedException"

**原因**: AWS認証情報が正しくない

**解決策**:
```bash
aws configure
# Access Key ID、Secret Access Key、Regionを再設定
```

### エラー: "ImageNotFoundException"

**原因**: Dockerイメージがプッシュされていない

**解決策**:
```bash
# ステップ4を再実行
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:latest
```

### Lambda実行時のタイムアウト

**原因**: メモリ不足またはタイムアウト設定が短い

**解決策**:
```bash
# メモリを増やす
aws lambda update-function-configuration \
  --function-name emotion-analysis-lambda \
  --memory-size 3008 \
  --timeout 60 \
  --region $AWS_REGION
```

---

## 🎯 次のステップ

Lambda関数が作成できたら:

1. ✅ フロントエンドのデモページを作成
2. ✅ リアルタイム録音をテスト
3. ✅ OpenAI Realtime APIと統合
4. ✅ 結果をSupabaseに保存

---

## 📝 まとめ

この手順で以下が完了します:

✅ ECRリポジトリの作成  
✅ Dockerイメージのビルド・プッシュ  
✅ IAMロールの作成  
✅ Lambda関数の作成  
✅ Function URLの作成  
✅ テスト実行  

所要時間: 約15-20分（初回ビルド時）
