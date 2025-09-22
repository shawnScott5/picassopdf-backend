# AWS Lambda Deployment Guide for PicassoPDF

This guide will walk you through creating and deploying your PDF converter Lambda function to AWS.

## Prerequisites

1. **AWS Account** - Sign up at [aws.amazon.com](https://aws.amazon.com)
2. **AWS CLI** - Install and configure
3. **Docker** - For building the Lambda container
4. **Git** - For version control

## Step 1: Install and Configure AWS CLI

### Install AWS CLI
```bash
# Windows (PowerShell)
winget install Amazon.AWSCLI

# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### Configure AWS CLI
```bash
aws configure
```

Enter your credentials when prompted:
- **AWS Access Key ID**: Your access key
- **AWS Secret Access Key**: Your secret key
- **Default region name**: `us-east-1` (or your preferred region)
- **Default output format**: `json`

## Step 2: Create IAM Role for Lambda

### Create the IAM role
```bash
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
```

### Get your AWS Account ID
```bash
aws sts get-caller-identity --query Account --output text
```

## Step 3: Build and Deploy Lambda Function

### Navigate to the Lambda directory
```bash
cd backend/lambda-pdf-converter
```

### Make the deploy script executable
```bash
chmod +x deploy.sh
```

### Run the deployment script
```bash
./deploy.sh
```

The script will:
1. Build the Docker image
2. Create ECR repository
3. Push image to ECR
4. Create/update Lambda function

## Step 4: Test Your Lambda Function

### Test locally first
```bash
node test-local.js
```

### Test via AWS CLI
```bash
# Create test payload
cat > test-payload.json << EOF
{
  "body": "{\"html\": \"<h1>Hello from Lambda!</h1><p>Test PDF generation.</p>\", \"options\": {\"format\": \"A4\"}}"
}
EOF

# Invoke the function
aws lambda invoke \
  --function-name picassopdf-converter \
  --payload file://test-payload.json \
  --region us-east-1 \
  response.json

# Check the response
cat response.json
```

## Step 5: Set Up API Gateway (Optional)

If you want to expose your Lambda function via HTTP:

### Create API Gateway
```bash
# Create REST API
aws apigateway create-rest-api \
  --name picassopdf-api \
  --description "PicassoPDF Lambda API" \
  --region us-east-1

# Note the API ID from the response
```

### Create resource and method
```bash
# Get the API ID from previous step
API_ID="your-api-id-here"

# Get root resource ID
aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region us-east-1

# Create /pdf resource
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id "root-resource-id" \
  --path-part pdf \
  --region us-east-1

# Create POST method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id "resource-id" \
  --http-method POST \
  --authorization-type NONE \
  --region us-east-1
```

## Step 6: Configure Environment Variables

### Set Lambda environment variables
```bash
aws lambda update-function-configuration \
  --function-name picassopdf-converter \
  --environment Variables='{
    "NODE_ENV": "production",
    "LOG_LEVEL": "info"
  }' \
  --region us-east-1
```

## Step 7: Update Heroku Environment

Add these environment variables to your Heroku app:

```bash
# Set AWS credentials on Heroku
heroku config:set AWS_ACCESS_KEY_ID=your-access-key-id
heroku config:set AWS_SECRET_ACCESS_KEY=your-secret-access-key
heroku config:set AWS_REGION=us-east-1
heroku config:set LAMBDA_PDF_FUNCTION_NAME=picassopdf-converter

# Optional: Set Lambda endpoint if using API Gateway
heroku config:set LAMBDA_PDF_ENDPOINT=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/pdf
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   # Check your AWS credentials
   aws sts get-caller-identity
   ```

2. **ECR Repository Not Found**
   ```bash
   # The deploy script will create it automatically
   # Or create manually:
   aws ecr create-repository --repository-name picassopdf-lambda --region us-east-1
   ```

3. **Lambda Function Not Found**
   ```bash
   # Check if function exists
   aws lambda get-function --function-name picassopdf-converter --region us-east-1
   ```

4. **Docker Build Fails**
   ```bash
   # Make sure Docker is running
   docker --version
   docker ps
   ```

### Monitor Lambda Function

```bash
# View logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/picassopdf-converter

# Get recent logs
aws logs tail /aws/lambda/picassopdf-converter --follow
```

## Cost Optimization

- **Memory**: Start with 2048MB, adjust based on performance
- **Timeout**: Set to 300 seconds (5 minutes) for PDF generation
- **Reserved Concurrency**: Consider setting limits for cost control

## Security Best Practices

1. **IAM Roles**: Use least privilege principle
2. **VPC**: Consider VPC if accessing private resources
3. **Environment Variables**: Don't store secrets in code
4. **API Gateway**: Add authentication if exposing publicly

## Next Steps

1. Monitor function performance in AWS CloudWatch
2. Set up CloudWatch alarms for errors
3. Consider implementing retry logic
4. Set up CI/CD pipeline for automated deployments
