@echo off
setlocal enabledelayedexpansion

echo 🚀 PicassoPDF Lambda Quick Deploy
echo ==================================

REM Configuration
set FUNCTION_NAME=picassopdf-converter
set REGION=us-east-1
set ECR_REPO=picassopdf-lambda

echo [INFO] Starting deployment process...

REM Check prerequisites
echo [INFO] Checking prerequisites...

REM Check AWS CLI
aws --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] AWS CLI not found. Please install it first.
    exit /b 1
)

REM Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker not found. Please install it first.
    exit /b 1
)

REM Check AWS credentials
aws sts get-caller-identity >nul 2>&1
if errorlevel 1 (
    echo [ERROR] AWS credentials not configured. Run 'aws configure' first.
    exit /b 1
)

echo [SUCCESS] All prerequisites met!

REM Get AWS account ID
echo [INFO] Getting AWS account ID...
for /f "tokens=*" %%i in ('aws sts get-caller-identity --query Account --output text') do set ACCOUNT_ID=%%i
set ECR_URI=%ACCOUNT_ID%.dkr.ecr.%REGION%.amazonaws.com/%ECR_REPO%:latest

echo [INFO] AWS Account ID: %ACCOUNT_ID%
echo [INFO] ECR URI: %ECR_URI%

REM Create IAM role if it doesn't exist
echo [INFO] Checking IAM role...
aws iam get-role --role-name lambda-execution-role >nul 2>&1
if errorlevel 1 (
    echo [INFO] Creating IAM role...
    
    REM Create trust policy file
    echo {> lambda-trust-policy.json
    echo   "Version": "2012-10-17",>> lambda-trust-policy.json
    echo   "Statement": [>> lambda-trust-policy.json
    echo     {>> lambda-trust-policy.json
    echo       "Effect": "Allow",>> lambda-trust-policy.json
    echo       "Principal": {>> lambda-trust-policy.json
    echo         "Service": "lambda.amazonaws.com">> lambda-trust-policy.json
    echo       },>> lambda-trust-policy.json
    echo       "Action": "sts:AssumeRole">> lambda-trust-policy.json
    echo     }>> lambda-trust-policy.json
    echo   ]>> lambda-trust-policy.json
    echo }>> lambda-trust-policy.json
    
    REM Create the role
    aws iam create-role --role-name lambda-execution-role --assume-role-policy-document file://lambda-trust-policy.json
    
    REM Attach basic execution policy
    aws iam attach-role-policy --role-name lambda-execution-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    
    echo [SUCCESS] IAM role created successfully
    
    REM Clean up
    del lambda-trust-policy.json
) else (
    echo [SUCCESS] IAM role 'lambda-execution-role' already exists
)

REM Build and deploy
echo [INFO] Building Docker image...
docker build -t %ECR_REPO% .

echo [INFO] Tagging image for ECR...
docker tag %ECR_REPO%:latest %ECR_URI%

echo [INFO] Logging into ECR...
aws ecr get-login-password --region %REGION% | docker login --username AWS --password-stdin %ACCOUNT_ID%.dkr.ecr.%REGION%.amazonaws.com

echo [INFO] Creating ECR repository if needed...
aws ecr describe-repositories --repository-names %ECR_REPO% --region %REGION% >nul 2>&1
if errorlevel 1 (
    aws ecr create-repository --repository-name %ECR_REPO% --region %REGION%
)

echo [INFO] Pushing to ECR...
docker push %ECR_URI%

echo [INFO] Creating/updating Lambda function...
aws lambda get-function --function-name %FUNCTION_NAME% --region %REGION% >nul 2>&1
if errorlevel 1 (
    echo [INFO] Creating new function...
    aws lambda create-function --function-name %FUNCTION_NAME% --package-type Image --code ImageUri=%ECR_URI% --role arn:aws:iam::%ACCOUNT_ID%:role/lambda-execution-role --timeout 300 --memory-size 2048 --region %REGION%
) else (
    echo [INFO] Updating existing function...
    aws lambda update-function-code --function-name %FUNCTION_NAME% --image-uri %ECR_URI% --region %REGION%
)

echo [SUCCESS] Lambda function deployed successfully!

REM Test the function
echo [INFO] Testing Lambda function...

REM Create test payload
echo {> test-payload.json
echo   "body": "{\"html\": \"^<h1^>Hello from Lambda!^</h1^>^<p^>Test PDF generation.^</p^>\", \"options\": {\"format\": \"A4\"}}">> test-payload.json
echo }>> test-payload.json

REM Invoke the function
aws lambda invoke --function-name %FUNCTION_NAME% --payload file://test-payload.json --region %REGION% response.json

REM Check if successful
findstr /c:"statusCode\":200" response.json >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Lambda function test may have failed. Check response.json
) else (
    echo [SUCCESS] Lambda function test passed!
    echo [INFO] Response saved to response.json
)

REM Clean up
del test-payload.json

echo.
echo [SUCCESS] 🎉 Deployment completed successfully!
echo.
echo [INFO] Next steps:
echo 1. Set environment variables on Heroku:
echo    heroku config:set AWS_ACCESS_KEY_ID=your-key
echo    heroku config:set AWS_SECRET_ACCESS_KEY=your-secret
echo    heroku config:set AWS_REGION=%REGION%
echo    heroku config:set LAMBDA_PDF_FUNCTION_NAME=%FUNCTION_NAME%
echo.
echo 2. Test your Heroku app with PDF conversion
echo.
echo [INFO] Function ARN: arn:aws:lambda:%REGION%:%ACCOUNT_ID%:function:%FUNCTION_NAME%

pause
