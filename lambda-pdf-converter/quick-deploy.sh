#!/bin/bash

# Quick AWS Lambda Deployment Script
# This script automates the entire process

set -e  # Exit on any error

echo "🚀 PicassoPDF Lambda Quick Deploy"
echo "=================================="

# Configuration
FUNCTION_NAME="picassopdf-converter"
REGION="us-east-1"
ECR_REPO="picassopdf-lambda"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found. Please install it first."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker not found. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    
    print_success "All prerequisites met!"
}

# Get AWS account ID
get_account_id() {
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest"
    
    print_status "AWS Account ID: $ACCOUNT_ID"
    print_status "ECR URI: $ECR_URI"
}

# Create IAM role if it doesn't exist
create_iam_role() {
    print_status "Checking IAM role..."
    
    if aws iam get-role --role-name lambda-execution-role &> /dev/null; then
        print_success "IAM role 'lambda-execution-role' already exists"
    else
        print_status "Creating IAM role..."
        
        # Create trust policy
        cat > lambda-trust-policy.json << EOF
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
EOF
        
        # Create the role
        aws iam create-role \
            --role-name lambda-execution-role \
            --assume-role-policy-document file://lambda-trust-policy.json
        
        # Attach basic execution policy
        aws iam attach-role-policy \
            --role-name lambda-execution-role \
            --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
        
        print_success "IAM role created successfully"
        
        # Clean up
        rm lambda-trust-policy.json
    fi
}

# Build and deploy
deploy_lambda() {
    print_status "Building Docker image..."
    docker build -t $ECR_REPO .
    
    print_status "Tagging image for ECR..."
    docker tag $ECR_REPO:latest $ECR_URI
    
    print_status "Logging into ECR..."
    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com
    
    print_status "Creating ECR repository if needed..."
    aws ecr describe-repositories --repository-names $ECR_REPO --region $REGION 2>/dev/null || \
    aws ecr create-repository --repository-name $ECR_REPO --region $REGION
    
    print_status "Pushing to ECR..."
    docker push $ECR_URI
    
    print_status "Creating/updating Lambda function..."
    
    # Check if function exists
    if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
        print_status "Updating existing function..."
        aws lambda update-function-code \
            --function-name $FUNCTION_NAME \
            --image-uri $ECR_URI \
            --region $REGION
    else
        print_status "Creating new function..."
        aws lambda create-function \
            --function-name $FUNCTION_NAME \
            --package-type Image \
            --code ImageUri=$ECR_URI \
            --role arn:aws:iam::${ACCOUNT_ID}:role/lambda-execution-role \
            --timeout 300 \
            --memory-size 2048 \
            --region $REGION
    fi
    
    print_success "Lambda function deployed successfully!"
}

# Test the function
test_function() {
    print_status "Testing Lambda function..."
    
    # Create test payload
    cat > test-payload.json << EOF
{
  "body": "{\"html\": \"<h1>Hello from Lambda!</h1><p>Test PDF generation at $(date).</p>\", \"options\": {\"format\": \"A4\"}}"
}
EOF
    
    # Invoke the function
    aws lambda invoke \
        --function-name $FUNCTION_NAME \
        --payload file://test-payload.json \
        --region $REGION \
        response.json
    
    # Check if successful
    if grep -q '"statusCode":200' response.json; then
        print_success "Lambda function test passed!"
        print_status "Response saved to response.json"
    else
        print_warning "Lambda function test may have failed. Check response.json"
    fi
    
    # Clean up
    rm test-payload.json
}

# Main execution
main() {
    check_prerequisites
    get_account_id
    create_iam_role
    deploy_lambda
    test_function
    
    echo ""
    print_success "🎉 Deployment completed successfully!"
    echo ""
    print_status "Next steps:"
    echo "1. Set environment variables on Heroku:"
    echo "   heroku config:set AWS_ACCESS_KEY_ID=your-key"
    echo "   heroku config:set AWS_SECRET_ACCESS_KEY=your-secret"
    echo "   heroku config:set AWS_REGION=$REGION"
    echo "   heroku config:set LAMBDA_PDF_FUNCTION_NAME=$FUNCTION_NAME"
    echo ""
    echo "2. Test your Heroku app with PDF conversion"
    echo ""
    print_status "Function ARN: arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$FUNCTION_NAME"
}

# Run main function
main "$@"
