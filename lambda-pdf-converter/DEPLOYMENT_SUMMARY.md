# 🚀 AWS Lambda Deployment Summary

## Quick Start Options

You now have **3 ways** to deploy your Lambda function:

### Option 1: PowerShell (Recommended for Windows)
```powershell
cd backend/lambda-pdf-converter
.\quick-deploy.ps1
```

### Option 2: Batch File (Windows)
```cmd
cd backend/lambda-pdf-converter
quick-deploy.bat
```

### Option 3: Bash Script (Linux/Mac)
```bash
cd backend/lambda-pdf-converter
./quick-deploy.sh
```

## Prerequisites Checklist

Before running any deployment script, ensure you have:

- ✅ **AWS Account** - [aws.amazon.com](https://aws.amazon.com)
- ✅ **AWS CLI** installed and configured (`aws configure`)
- ✅ **Docker** installed and running
- ✅ **AWS Credentials** with sufficient permissions

## What the Scripts Do

### Automatic Setup:
1. **Check Prerequisites** - Verify AWS CLI, Docker, and credentials
2. **Create IAM Role** - Sets up `lambda-execution-role` if it doesn't exist
3. **Build Docker Image** - Creates optimized container with Playwright
4. **Create ECR Repository** - AWS container registry for your image
5. **Push to ECR** - Uploads your Docker image to AWS
6. **Create Lambda Function** - Deploys `picassopdf-converter` function
7. **Test Function** - Verifies everything works

### Configuration:
- **Function Name**: `picassopdf-converter`
- **Region**: `us-east-1` (configurable)
- **Memory**: 2048 MB
- **Timeout**: 300 seconds (5 minutes)
- **Runtime**: Node.js 20 (container image)

## Manual Steps (If Scripts Don't Work)

### 1. Configure AWS CLI
```bash
aws configure
# Enter your Access Key ID, Secret Key, and region
```

### 2. Create IAM Role
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

# Create role
aws iam create-role --role-name lambda-execution-role --assume-role-policy-document file://lambda-trust-policy.json

# Attach policy
aws iam attach-role-policy --role-name lambda-execution-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 3. Build and Deploy
```bash
# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Build Docker image
docker build -t picassopdf-lambda .

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Create repository
aws ecr create-repository --repository-name picassopdf-lambda --region us-east-1

# Tag and push
docker tag picassopdf-lambda:latest $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/picassopdf-lambda:latest
docker push $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/picassopdf-lambda:latest

# Create Lambda function
aws lambda create-function \
  --function-name picassopdf-converter \
  --package-type Image \
  --code ImageUri=$ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/picassopdf-lambda:latest \
  --role arn:aws:iam::$ACCOUNT_ID:role/lambda-execution-role \
  --timeout 300 \
  --memory-size 2048 \
  --region us-east-1
```

## After Deployment

### 1. Set Heroku Environment Variables
```bash
heroku config:set AWS_ACCESS_KEY_ID=your-access-key-id
heroku config:set AWS_SECRET_ACCESS_KEY=your-secret-access-key
heroku config:set AWS_REGION=us-east-1
heroku config:set LAMBDA_PDF_FUNCTION_NAME=picassopdf-converter
```

### 2. Test Your Setup
```bash
# Test Lambda directly
aws lambda invoke \
  --function-name picassopdf-converter \
  --payload '{"body": "{\"html\": \"<h1>Test</h1>\", \"options\": {\"format\": \"A4\"}}"}' \
  --region us-east-1 \
  response.json

cat response.json
```

### 3. Monitor in AWS Console
- Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda/)
- Find your `picassopdf-converter` function
- Check logs in CloudWatch
- Monitor performance and errors

## Troubleshooting

### Common Issues:

1. **"Access Denied"**
   - Check AWS credentials: `aws sts get-caller-identity`
   - Ensure IAM user has Lambda, ECR, and IAM permissions

2. **"Docker not found"**
   - Install Docker Desktop
   - Ensure Docker is running

3. **"ECR repository not found"**
   - Script will create it automatically
   - Or create manually in AWS Console

4. **"Function already exists"**
   - Script will update existing function
   - Check function in AWS Console

### Get Help:
- Check AWS CloudWatch logs for detailed error messages
- Verify all environment variables are set correctly
- Test Lambda function independently before integrating

## Cost Estimation

**AWS Lambda Pricing** (approximate):
- **Free Tier**: 1M requests/month + 400,000 GB-seconds
- **After Free Tier**: ~$0.20 per 1M requests + $0.0000166667 per GB-second

**For PDF generation**:
- Each request: ~2-5 seconds at 2GB memory
- Cost per PDF: ~$0.0001-$0.0002 (very cheap!)

## Next Steps

1. ✅ **Deploy Lambda Function** (using scripts above)
2. ✅ **Configure Heroku Environment** (set AWS variables)
3. ✅ **Test Integration** (try PDF conversion)
4. 🔄 **Monitor Performance** (AWS CloudWatch)
5. 🚀 **Scale as Needed** (adjust memory/timeout)

Your Lambda function is now ready to handle PDF conversion at scale! 🎉
