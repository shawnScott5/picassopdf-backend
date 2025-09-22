#!/bin/bash

# AWS Lambda deployment script for PDF converter
# Make sure you have AWS CLI configured with appropriate permissions

FUNCTION_NAME="picassopdf-converter"
REGION="us-east-1"  # Change to your preferred region
ECR_REPO="picassopdf-lambda"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest"

echo "🚀 Deploying PicassoPDF Lambda Converter..."
echo "📋 Account ID: $ACCOUNT_ID"
echo "🌍 Region: $REGION"
echo "📦 Repository: $ECR_REPO"

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t $ECR_REPO .

# Tag for ECR
echo "🏷️ Tagging image for ECR..."
docker tag $ECR_REPO:latest $ECR_URI

# Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

# Create ECR repository if it doesn't exist
echo "📋 Creating ECR repository if needed..."
aws ecr describe-repositories --repository-names $ECR_REPO --region $REGION 2>/dev/null || \
aws ecr create-repository --repository-name $ECR_REPO --region $REGION

# Push to ECR
echo "⬆️ Pushing to ECR..."
docker push $ECR_URI

# Create or update Lambda function
echo "⚡ Creating/updating Lambda function..."

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
    echo "🔄 Updating existing function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --image-uri $ECR_URI \
        --region $REGION
else
    echo "🆕 Creating new function..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --package-type Image \
        --code ImageUri=$ECR_URI \
        --role arn:aws:iam::${ACCOUNT_ID}:role/lambda-execution-role \
        --timeout 300 \
        --memory-size 2048 \
        --region $REGION
fi

echo "✅ Lambda function deployed successfully!"
echo "🔗 Function ARN: arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$FUNCTION_NAME"
echo ""
echo "📋 Next steps:"
echo "1. Set up API Gateway to expose the function"
echo "2. Configure environment variables on Heroku:"
echo "   AWS_ACCESS_KEY_ID=your_key"
echo "   AWS_SECRET_ACCESS_KEY=your_secret"
echo "   AWS_REGION=$REGION"
echo "   LAMBDA_PDF_FUNCTION_NAME=$FUNCTION_NAME"
