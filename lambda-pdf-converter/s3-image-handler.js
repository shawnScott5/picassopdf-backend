// AWS S3 integration for handling large local images
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

class S3ImageHandler {
    constructor() {
        this.s3 = new AWS.S3();
        this.bucketName = process.env.S3_BUCKET_NAME || 'picassopdf-temp-images';
    }

    /**
     * Upload local image to S3 and return public URL
     */
    async uploadLocalImageToS3(filePath) {
        try {
            const fileBuffer = fs.readFileSync(filePath);
            const fileName = path.basename(filePath);
            const key = `temp-images/${Date.now()}-${fileName}`;
            
            const uploadParams = {
                Bucket: this.bucketName,
                Key: key,
                Body: fileBuffer,
                ContentType: this.getMimeType(filePath),
                ACL: 'public-read'
            };
            
            const result = await this.s3.upload(uploadParams).promise();
            console.log(`✅ Uploaded to S3: ${result.Location}`);
            
            return result.Location;
        } catch (error) {
            console.error(`❌ S3 upload failed:`, error.message);
            return null;
        }
    }

    /**
     * Get MIME type from file extension
     */
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml'
        };
        return mimeTypes[ext] || 'image/png';
    }

    /**
     * Clean up temporary S3 files (optional)
     */
    async cleanupTempFiles() {
        try {
            const listParams = {
                Bucket: this.bucketName,
                Prefix: 'temp-images/'
            };
            
            const objects = await this.s3.listObjectsV2(listParams).promise();
            
            if (objects.Contents.length > 0) {
                const deleteParams = {
                    Bucket: this.bucketName,
                    Delete: {
                        Objects: objects.Contents.map(obj => ({ Key: obj.Key }))
                    }
                };
                
                await this.s3.deleteObjects(deleteParams).promise();
                console.log(`🧹 Cleaned up ${objects.Contents.length} temp files`);
            }
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }
}

module.exports = S3ImageHandler;
