# PicassoPDF Lambda Converter

AWS Lambda function for PDF conversion using Playwright. This function handles the `/api/v1/convert/pdf` endpoint with high performance and scalability.

## Architecture

- **Heroku**: Main API backend with all other endpoints
- **AWS Lambda**: Dedicated PDF conversion service using Docker container
- **Playwright**: Browser automation with fresh browser instance per request

## Features

- ✅ **New browser instance per request** - No browser state issues
- ✅ **Full HTML/CSS/JS rendering** - Complete web page rendering
- ✅ **URL and HTML content support** - Convert websites or HTML strings
- ✅ **Comprehensive PDF options** - Margins, headers, footers, scale, etc.
- ✅ **Proper cleanup** - Always closes browser instances
- ✅ **CORS enabled** - Ready for frontend integration

## Deployment

### Prerequisites

1. AWS CLI configured with appropriate permissions
2. Docker installed
3. ECR repository created

### Quick Deploy

```bash
# Make script executable
chmod +x deploy.sh

# Deploy to AWS Lambda
./deploy.sh
```

### Manual Deploy

```bash
# Build Docker image
docker build -t picassopdf-lambda .

# Tag for ECR
docker tag picassopdf-lambda:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/picassopdf-lambda:latest

# Push to ECR
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/picassopdf-lambda:latest

# Create Lambda function
aws lambda create-function \
    --function-name picassopdf-converter \
    --package-type Image \
    --code ImageUri=YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/picassopdf-lambda:latest \
    --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
    --timeout 300 \
    --memory-size 2048
```

## Usage

### Request Format

```json
{
    "html": "<html><body><h1>Hello World</h1></body></html>",
    "url": "https://example.com",
    "options": {
        "format": "A4",
        "margin": {
            "top": "20px",
            "right": "20px",
            "bottom": "20px",
            "left": "20px"
        },
        "landscape": false,
        "filename": "document.pdf"
    }
}
```

### Response

- **Success**: Returns PDF as base64-encoded binary
- **Error**: Returns JSON error response

## Configuration

### Lambda Settings

- **Memory**: 2048 MB (recommended for Playwright)
- **Timeout**: 300 seconds (5 minutes)
- **Runtime**: Node.js 20.x
- **Package Type**: Container Image

### Environment Variables

No environment variables required - Playwright handles browser installation automatically.

## Cost Optimization

- **Cold start**: ~10-15 seconds (browser installation)
- **Warm requests**: ~2-5 seconds (browser already loaded)
- **Memory usage**: ~1.5GB during PDF generation
- **Recommended**: Use provisioned concurrency for high-traffic scenarios

## Monitoring

Monitor the function using:
- AWS CloudWatch Logs
- AWS X-Ray for performance tracing
- Lambda metrics for invocation count and duration

## Troubleshooting

### Common Issues

1. **Timeout**: Increase Lambda timeout to 300 seconds
2. **Memory**: Increase memory to 2048 MB minimum
3. **Browser crashes**: Ensure proper cleanup in finally block
4. **Cold starts**: Consider provisioned concurrency

### Logs

Check CloudWatch logs for detailed error messages and performance metrics.
