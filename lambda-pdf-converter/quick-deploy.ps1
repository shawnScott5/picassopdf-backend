# PowerShell script for AWS Lambda deployment
# PicassoPDF Lambda Quick Deploy

param(
    [string]$Region = "us-east-2",
    [string]$FunctionName = "picassopdf-converter",
    [string]$EcrRepo = "picassopdf-lambda"
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Cyan"

function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

Write-Host "🚀 PicassoPDF Lambda Quick Deploy" -ForegroundColor $Green
Write-Host "==================================" -ForegroundColor $Green

# Check prerequisites
Write-Status "Checking prerequisites..."

# Check AWS CLI
try {
    aws --version | Out-Null
    Write-Success "AWS CLI found"
} catch {
    Write-Error "AWS CLI not found. Please install it first."
    exit 1
}

# Check Docker
try {
    docker --version | Out-Null
    Write-Success "Docker found"
} catch {
    Write-Error "Docker not found. Please install it first."
    exit 1
}

# Check AWS credentials
try {
    $accountInfo = aws sts get-caller-identity --output json | ConvertFrom-Json
    $accountId = $accountInfo.Account
    Write-Success "AWS credentials configured"
    Write-Status "AWS Account ID: $accountId"
} catch {
    Write-Error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
}

$ecrUri = "$accountId.dkr.ecr.$Region.amazonaws.com/$EcrRepo`:latest"
Write-Status "ECR URI: $ecrUri"

# Create IAM role if it doesn't exist
Write-Status "Checking IAM role..."
try {
    aws iam get-role --role-name lambda-execution-role | Out-Null
    Write-Success "IAM role 'lambda-execution-role' already exists"
} catch {
    Write-Status "Creating IAM role..."
    
    # Create trust policy
    $trustPolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Effect = "Allow"
                Principal = @{
                    Service = "lambda.amazonaws.com"
                }
                Action = "sts:AssumeRole"
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $trustPolicy | Out-File -FilePath "lambda-trust-policy.json" -Encoding UTF8
    
    # Create the role
    aws iam create-role --role-name lambda-execution-role --assume-role-policy-document file://lambda-trust-policy.json
    
    # Attach basic execution policy
    aws iam attach-role-policy --role-name lambda-execution-role --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    
    Write-Success "IAM role created successfully"
    
    # Clean up
    Remove-Item "lambda-trust-policy.json"
}

# Build and deploy
Write-Status "Building Docker image..."
docker build -t $EcrRepo .

Write-Status "Tagging image for ECR..."
docker tag "$EcrRepo`:latest" $ecrUri

Write-Status "Logging into ECR..."
$loginCommand = aws ecr get-login-password --region $Region
$loginCommand | docker login --username AWS --password-stdin "$accountId.dkr.ecr.$Region.amazonaws.com"

Write-Status "Creating ECR repository if needed..."
try {
    aws ecr describe-repositories --repository-names $EcrRepo --region $Region | Out-Null
} catch {
    aws ecr create-repository --repository-name $EcrRepo --region $Region
}

Write-Status "Pushing to ECR..."
docker push $ecrUri

Write-Status "Creating/updating Lambda function..."
try {
    aws lambda get-function --function-name $FunctionName --region $Region | Out-Null
    Write-Status "Updating existing function..."
    aws lambda update-function-code --function-name $FunctionName --image-uri $ecrUri --region $Region
} catch {
    Write-Status "Creating new function..."
    aws lambda create-function --function-name $FunctionName --package-type Image --code ImageUri=$ecrUri --role "arn:aws:iam::$accountId`:role/lambda-execution-role" --timeout 300 --memory-size 2048 --region $Region
}

Write-Success "Lambda function deployed successfully!"

# Test the function
Write-Status "Testing Lambda function..."

# Create test payload
$testPayload = @{
    body = '{"html": "<h1>Hello from Lambda!</h1><p>Test PDF generation.</p>", "options": {"format": "A4"}}'
} | ConvertTo-Json

$testPayload | Out-File -FilePath "test-payload.json" -Encoding UTF8

# Invoke the function
aws lambda invoke --function-name $FunctionName --payload file://test-payload.json --region $Region response.json

# Check if successful
$response = Get-Content "response.json" | ConvertFrom-Json
if ($response.statusCode -eq 200) {
    Write-Success "Lambda function test passed!"
    Write-Status "Response saved to response.json"
} else {
    Write-Warning "Lambda function test may have failed. Check response.json"
}

# Clean up
Remove-Item "test-payload.json"

Write-Host ""
Write-Success "🎉 Deployment completed successfully!"
Write-Host ""
Write-Status "Next steps:"
Write-Host "1. Set environment variables on Heroku:"
Write-Host "   heroku config:set AWS_ACCESS_KEY_ID=your-key"
Write-Host "   heroku config:set AWS_SECRET_ACCESS_KEY=your-secret"
Write-Host "   heroku config:set AWS_REGION=$Region"
Write-Host "   heroku config:set LAMBDA_PDF_FUNCTION_NAME=$FunctionName"
Write-Host ""
Write-Host "2. Test your Heroku app with PDF conversion"
Write-Host ""
Write-Status "Function ARN: arn:aws:lambda:$Region`:$accountId`:function:$FunctionName"

Read-Host "Press Enter to continue"
