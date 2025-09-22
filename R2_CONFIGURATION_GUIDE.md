# 🔧 R2 Storage Configuration Guide

## **Environment Variables Required for R2**

Set these environment variables in your production environment (Heroku/Render):

```bash
# R2 Configuration (Required for R2 storage)
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=your-r2-bucket-name
```

## **How to Get R2 Credentials**

1. **Go to Cloudflare Dashboard**
   - Navigate to R2 Object Storage
   - Create a bucket if you don't have one

2. **Create API Token**
   - Go to "Manage R2 API tokens"
   - Create a new token with R2 permissions
   - Copy the Access Key ID and Secret Access Key

3. **Get Account ID**
   - Found in the right sidebar of your Cloudflare dashboard

## **Enable R2 in Code**

Update your ConversionsController to enable R2:

```javascript
initializeR2() {
    try {
        if (process.env.R2_ACCOUNT_ID && 
            process.env.R2_ACCESS_KEY_ID && 
            process.env.R2_SECRET_ACCESS_KEY && 
            process.env.R2_BUCKET_NAME) {
            
            this.r2Enabled = true;
            this.r2AccountId = process.env.R2_ACCOUNT_ID;
            this.r2BucketName = process.env.R2_BUCKET_NAME;
            
            // Configure S3-compatible client for R2
            this.s3 = new AWS.S3({
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
                region: 'auto', // R2 uses 'auto' region
                endpoint: `https://${this.r2AccountId}.r2.cloudflarestorage.com`
            });
            
            console.log('✅ R2 storage enabled');
        } else {
            console.log('❌ R2 storage disabled - missing environment variables');
            this.r2Enabled = false;
        }
    } catch (error) {
        console.error('Error initializing R2:', error);
        this.r2Enabled = false;
    }
}
```

## **Test R2 Configuration**

After setting up, test with:

```bash
curl -X POST https://your-app.com/v1/convert/pdf \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"html": "<h1>Test</h1>", "saveToVault": true}'
```

## **Alternative: Use Local Storage**

If you don't want to use R2, set:

```bash
STORAGE_TYPE=local
```

And disable R2 in the code by keeping the current configuration.
