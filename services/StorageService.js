import fs from 'fs';
import path from 'path';
// import AWS from 'aws-sdk'; // Disabled for deployment
// import * as Minio from 'minio'; // Disabled for deployment
// import { createClient } from '@supabase/supabase-js'; // Disabled for deployment
import { v4 as uuidv4 } from 'uuid';

class StorageService {
    constructor() {
        this.storageType = process.env.STORAGE_TYPE || 'local'; // 'local', 's3', 'minio', 'supabase'
        
        if (this.storageType === 's3') {
            this.s3 = new AWS.S3({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION || 'us-east-1'
            });
            this.bucketName = process.env.AWS_S3_BUCKET;
        } else if (this.storageType === 'minio') {
            this.minio = new Minio.Client({
                endPoint: process.env.MINIO_ENDPOINT,
                port: parseInt(process.env.MINIO_PORT) || 9000,
                useSSL: process.env.MINIO_USE_SSL === 'true',
                accessKey: process.env.MINIO_ACCESS_KEY,
                secretKey: process.env.MINIO_SECRET_KEY
            });
            this.bucketName = process.env.MINIO_BUCKET;
        } else if (this.storageType === 'supabase') {
            this.supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_ANON_KEY
            );
            this.supabaseBucket = process.env.SUPABASE_BUCKET || 'pdfs';
        }
    }

    async uploadToStorage(file, folder = 'uploads') {
        try {
            const fileName = `${folder}/${uuidv4()}_${file.name}`;
            
            if (this.storageType === 'local') {
                return await this.uploadToLocal(file, fileName);
            } else if (this.storageType === 's3') {
                return await this.uploadToS3(file, fileName);
            } else if (this.storageType === 'minio') {
                return await this.uploadToMinio(file, fileName);
            } else if (this.storageType === 'supabase') {
                return await this.uploadToSupabase(file, fileName);
            }
        } catch (error) {
            console.error('Upload error:', error);
            throw new Error('Failed to upload file');
        }
    }

    async uploadToLocal(file, fileName) {
        const uploadDir = path.join(process.cwd(), 'uploads');
        const filePath = path.join(uploadDir, fileName);
        
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Move file to destination
        await file.mv(filePath);
        
        return {
            path: filePath,
            url: `/uploads/${fileName}`,
            filename: fileName
        };
    }

    async uploadToS3(file, fileName) {
        const params = {
            Bucket: this.bucketName,
            Key: fileName,
            Body: fs.createReadStream(file.tempFilePath),
            ContentType: file.mimetype,
            ACL: 'private'
        };

        const result = await this.s3.upload(params).promise();
        
        return {
            path: result.Key,
            url: result.Location,
            filename: fileName
        };
    }

    async uploadToMinio(file, fileName) {
        const result = await this.minio.putObject(
            this.bucketName,
            fileName,
            fs.createReadStream(file.tempFilePath),
            file.size,
            { 'Content-Type': file.mimetype }
        );

        const url = await this.minio.presignedGetObject(this.bucketName, fileName, 24 * 60 * 60); // 24 hours

        return {
            path: fileName,
            url: url,
            filename: fileName
        };
    }

    async uploadToSupabase(file, fileName) {
        try {
            const fileBuffer = fs.readFileSync(file.tempFilePath);
            const { data, error } = await this.supabase.storage
                .from(this.supabaseBucket)
                .upload(fileName, fileBuffer, {
                    contentType: file.mimetype,
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                throw new Error(`Supabase upload error: ${error.message}`);
            }

            // Get public URL
            const { data: urlData } = this.supabase.storage
                .from(this.supabaseBucket)
                .getPublicUrl(fileName);

            return {
                path: fileName,
                url: urlData.publicUrl,
                filename: fileName,
                fileId: data.id
            };
        } catch (error) {
            console.error('Supabase upload error:', error);
            throw new Error(`Failed to upload to Supabase: ${error.message}`);
        }
    }

    async uploadPDFBufferToSupabase(pdfBuffer, fileName, metadata = {}) {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.supabaseBucket)
                .upload(fileName, pdfBuffer, {
                    contentType: 'application/pdf',
                    cacheControl: '3600',
                    upsert: false,
                    metadata: {
                        ...metadata,
                        uploadedAt: new Date().toISOString(),
                        fileSize: pdfBuffer.length
                    }
                });

            if (error) {
                throw new Error(`Supabase PDF upload error: ${error.message}`);
            }

            // Get public URL
            const { data: urlData } = this.supabase.storage
                .from(this.supabaseBucket)
                .getPublicUrl(fileName);

            return {
                success: true,
                fileId: data.id,
                fileName: fileName,
                downloadUrl: urlData.publicUrl,
                size: pdfBuffer.length,
                path: fileName
            };
        } catch (error) {
            console.error('Supabase PDF upload error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async downloadFile(filePath) {
        try {
            if (this.storageType === 'local') {
                return await this.downloadFromLocal(filePath);
            } else if (this.storageType === 's3') {
                return await this.downloadFromS3(filePath);
            } else if (this.storageType === 'minio') {
                return await this.downloadFromMinio(filePath);
            }
        } catch (error) {
            console.error('Download error:', error);
            throw new Error('Failed to download file');
        }
    }

    async downloadFromLocal(filePath) {
        const fullPath = path.join(process.cwd(), 'uploads', filePath);
        
        if (!fs.existsSync(fullPath)) {
            throw new Error('File not found');
        }

        return {
            stream: fs.createReadStream(fullPath),
            size: fs.statSync(fullPath).size
        };
    }

    async downloadFromS3(filePath) {
        const params = {
            Bucket: this.bucketName,
            Key: filePath
        };

        const result = await this.s3.getObject(params).promise();
        
        return {
            stream: result.Body,
            size: result.ContentLength
        };
    }

    async downloadFromMinio(filePath) {
        const stream = await this.minio.getObject(this.bucketName, filePath);
        
        return {
            stream: stream,
            size: null // MinIO doesn't provide size in stream
        };
    }

    async deleteFile(filePath) {
        try {
            if (this.storageType === 'local') {
                return await this.deleteFromLocal(filePath);
            } else if (this.storageType === 's3') {
                return await this.deleteFromS3(filePath);
            } else if (this.storageType === 'minio') {
                return await this.deleteFromMinio(filePath);
            }
        } catch (error) {
            console.error('Delete error:', error);
            throw new Error('Failed to delete file');
        }
    }

    async deleteFromLocal(filePath) {
        const fullPath = path.join(process.cwd(), 'uploads', filePath);
        
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }

    async deleteFromS3(filePath) {
        const params = {
            Bucket: this.bucketName,
            Key: filePath
        };

        await this.s3.deleteObject(params).promise();
    }

    async deleteFromMinio(filePath) {
        await this.minio.removeObject(this.bucketName, filePath);
    }

    async getFileUrl(filePath, expiresIn = 3600) {
        try {
            if (this.storageType === 'local') {
                return `/uploads/${filePath}`;
            } else if (this.storageType === 's3') {
                return await this.getS3PresignedUrl(filePath, expiresIn);
            } else if (this.storageType === 'minio') {
                return await this.minio.presignedGetObject(this.bucketName, filePath, expiresIn);
            }
        } catch (error) {
            console.error('Get URL error:', error);
            throw new Error('Failed to get file URL');
        }
    }

    async getS3PresignedUrl(filePath, expiresIn) {
        const params = {
            Bucket: this.bucketName,
            Key: filePath,
            Expires: expiresIn
        };

        return this.s3.getSignedUrl('getObject', params);
    }
}

const storageService = new StorageService();

// Export the class for direct instantiation
export default StorageService;

// Export individual functions for backward compatibility
export const uploadToStorage = (file, folder) => storageService.uploadToStorage(file, folder);
export const downloadFile = (filePath) => storageService.downloadFile(filePath);
export const deleteFile = (filePath) => storageService.deleteFile(filePath);
export const getFileUrl = (filePath, expiresIn) => storageService.getFileUrl(filePath, expiresIn);

