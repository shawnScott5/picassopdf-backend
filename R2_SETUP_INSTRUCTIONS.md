# 🚀 R2 Storage Setup Instructions

## **Step 1: Get Cloudflare R2 Credentials**

### **1.1 Access Cloudflare Dashboard**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Log in to your account
3. Navigate to **R2 Object Storage** in the sidebar

### **1.2 Create R2 Bucket (if you don't have one)**
1. Click **"Create bucket"**
2. Name it: `picassopdf-storage` (or your preferred name)
3. Choose your preferred location
4. Click **"Create bucket"**

### **1.3 Get Account ID**
1. In your R2 dashboard, look at the right sidebar
2. Copy your **Account ID** (it looks like: `abc123def456ghi789`)

### **1.4 Create R2 API Token**
1. Go to **"Manage R2 API tokens"**
2. Click **"Create API token"**
3. **Token name**: `picassopdf-api-token`
4. **Permissions**: 
   - ✅ **Object Read & Write** (for your bucket)
   - ✅ **Bucket Read & Write** (for your bucket)
5. Click **"Create API token"**
6. **IMPORTANT**: Copy both the **Access Key ID** and **Secret Access Key** immediately (you won't see them again!)

## **Step 2: Set Environment Variables**

### **For Heroku:**
```bash
heroku config:set R2_ACCOUNT_ID=your-account-id-here
heroku config:set R2_ACCESS_KEY_ID=your-access-key-id-here
heroku config:set R2_SECRET_ACCESS_KEY=your-secret-access-key-here
heroku config:set R2_BUCKET_NAME=picassopdf-storage
```

### **For Render:**
1. Go to your Render dashboard
2. Select your service
3. Go to **Environment** tab
4. Add these variables:
   - `R2_ACCOUNT_ID` = your-account-id-here
   - `R2_ACCESS_KEY_ID` = your-access-key-id-here
   - `R2_SECRET_ACCESS_KEY` = your-secret-access-key-here
   - `R2_BUCKET_NAME` = picassopdf-storage

### **For Local Development (.env file):**
```bash
R2_ACCOUNT_ID=your-account-id-here
R2_ACCESS_KEY_ID=your-access-key-id-here
R2_SECRET_ACCESS_KEY=your-secret-access-key-here
R2_BUCKET_NAME=picassopdf-storage
```

## **Step 3: Deploy Your Changes**

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Enable R2 storage support"
   git push origin main
   ```

2. **Your platform will automatically deploy** (Heroku/Render)

## **Step 4: Test R2 Storage**

### **Test PDF Generation with Storage:**
```bash
curl -X POST https://your-app-domain.com/v1/convert/pdf \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<h1>Test PDF with R2 Storage</h1><p>This should be saved to R2!</p>",
    "saveToVault": true
  }'
```

### **Expected Response:**
```json
{
  "success": true,
  "pdfUrl": "https://your-bucket.r2.cloudflarestorage.com/pdfs/filename.pdf",
  "storageInfo": {
    "storageType": "r2",
    "r2Url": "https://...",
    "r2Key": "pdfs/filename.pdf",
    "r2Bucket": "picassopdf-storage"
  }
}
```

## **Step 5: Verify in Cloudflare Dashboard**

1. Go back to your R2 bucket in Cloudflare
2. You should see a `pdfs/` folder
3. Your generated PDFs should be stored there

## **Troubleshooting**

### **If you get "R2 not enabled" error:**
- Check that all 4 environment variables are set correctly
- Restart your application after setting environment variables
- Check application logs for R2 initialization messages

### **If you get "Access Denied" error:**
- Verify your API token has the correct permissions
- Make sure the bucket name matches exactly
- Check that your Account ID is correct

### **If PDFs are generated but not saved to R2:**
- Ensure `saveToVault: true` is included in your request
- Check that R2 initialization succeeded in logs

## **Cost Information**

- **R2 Storage**: $0.015 per GB per month
- **Class A Operations** (writes): $4.50 per million requests
- **Class B Operations** (reads): $0.36 per million requests
- **Egress**: First 10GB per month free, then $0.09 per GB

For a typical PDF generation service, costs should be very low (under $10/month for most use cases).
