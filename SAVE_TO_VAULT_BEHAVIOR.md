# 📋 Save to Vault Behavior Documentation

## **API Parameter: `save_to_vault` (or `saveToVault`)**

### **Location in Request:**
```json
{
  "html": "<h1>Your HTML content</h1>",
  "options": {
    "save_to_vault": true  // or false, or omit entirely
  }
}
```

### **Behavior:**

#### **✅ When `save_to_vault: true`**
- PDF is generated using AWS Lambda
- PDF is saved to Cloudflare R2 storage
- Conversion record is created in MongoDB
- Returns PDF data + storage information
- User can download PDF later via signed URL

**Response includes:**
```json
{
  "success": true,
  "pdfData": "base64-pdf-data",
  "storageInfo": {
    "storageType": "r2",
    "r2Url": "https://your-bucket.r2.cloudflarestorage.com/pdfs/filename.pdf",
    "r2Key": "pdfs/filename.pdf",
    "r2Bucket": "your-bucket-name"
  }
}
```

#### **✅ When `save_to_vault: false` or omitted**
- PDF is generated using AWS Lambda
- PDF is NOT saved to any storage
- NO conversion record is created
- Returns PDF data only
- PDF exists only in the response

**Response includes:**
```json
{
  "success": true,
  "pdfData": "base64-pdf-data",
  "storageInfo": {
    "storageType": "none",
    "message": "PDF not saved to storage"
  }
}
```

#### **⚠️ When `save_to_vault: true` but R2 not configured**
- PDF is generated using AWS Lambda
- PDF is NOT saved to R2 (R2 not available)
- NO conversion record is created
- Returns PDF data with warning
- System logs warning but doesn't fail

**Response includes:**
```json
{
  "success": true,
  "pdfData": "base64-pdf-data",
  "storageInfo": {
    "storageType": "none",
    "message": "R2 storage not configured - PDF not saved to vault"
  }
}
```

## **Default Behavior:**
- **Default value**: `false` (if not specified)
- **No storage**: PDFs are not saved unless explicitly requested
- **No database records**: No conversion tracking unless saved to vault

## **Use Cases:**

### **`save_to_vault: false` (Default)**
- One-time PDF generation
- No need for storage
- Immediate use/download
- Lower costs (no storage fees)

### **`save_to_vault: true`**
- PDFs need to be accessed later
- User dashboard with PDF history
- Sharing PDFs via links
- Audit trail requirements

## **API Examples:**

### **Generate PDF without saving:**
```bash
curl -X POST https://your-api.com/v1/convert/pdf \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<h1>Test PDF</h1>",
    "options": {
      "save_to_vault": false
    }
  }'
```

### **Generate PDF and save to vault:**
```bash
curl -X POST https://your-api.com/v1/convert/pdf \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<h1>Test PDF</h1>",
    "options": {
      "save_to_vault": true
    }
  }'
```

### **Default behavior (same as save_to_vault: false):**
```bash
curl -X POST https://your-api.com/v1/convert/pdf \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<h1>Test PDF</h1>"
  }'
```

## **Cost Implications:**
- **`save_to_vault: false`**: Only Lambda execution costs
- **`save_to_vault: true`**: Lambda execution + R2 storage costs
- **R2 costs**: ~$0.015/GB/month + $4.50/million write requests
