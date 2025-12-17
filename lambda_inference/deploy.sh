#!/bin/bash
set -e

AWS_ACCOUNT_ID=$1
AWS_REGION=$2
FUNCTION_NAME=$3
ECR_REPO_NAME="emotion-analysis-repo"

if [ -z "$3" ]; then
    echo "Usage: ./deploy.sh <AWS_ACCOUNT_ID> <AWS_REGION> <FUNCTION_NAME>"
    exit 1
fi

echo "🚀 Deploying to Lambda function: $FUNCTION_NAME"

# ECRログイン
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Dockerビルド
docker build --platform linux/amd64 --provenance=false -t $ECR_REPO_NAME:latest .

# タグ付け
docker tag $ECR_REPO_NAME:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:latest

# プッシュ
echo "⬆️ Pushing image to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:latest

# Lambda画像更新
echo "🔄 Updating Lambda function code..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --image-uri $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:latest \
    --region $AWS_REGION

# 更新待ち
echo "⏳ Waiting for update to complete..."
aws lambda wait function-updated --function-name $FUNCTION_NAME --region $AWS_REGION

echo "✅ Deployment complete!"
