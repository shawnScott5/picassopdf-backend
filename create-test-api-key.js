// Script to create a test API key for local testing
import mongoose from 'mongoose';
import ApiKeysSchema from './api-keys/ApiKeysSchema.js';
import UserSchema from './users/UserSchema.js';
import dotenv from 'dotenv';

dotenv.config();

async function createTestApiKey() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/picassopdf');
        console.log('✅ Connected to MongoDB');

        // Find or create a test user
        let testUser = await UserSchema.findOne({ email: 'test@picassopdf.com' });
        
        if (!testUser) {
            console.log('📝 Creating test user...');
            testUser = new UserSchema({
                email: 'test@picassopdf.com',
                password: 'testpassword123',
                firstName: 'Test',
                lastName: 'User',
                companyId: 'test-company-123',
                credits: 1000,
                isActive: true
            });
            await testUser.save();
            console.log('✅ Test user created');
        } else {
            console.log('✅ Test user found');
        }

        // Check if test API key already exists
        let testApiKey = await ApiKeysSchema.findOne({ 
            userId: testUser._id,
            name: 'Test API Key'
        });

        if (!testApiKey) {
            console.log('📝 Creating test API key...');
            
            // Generate a simple API key
            const apiKeyValue = 'test-api-key-' + Date.now();
            
            testApiKey = new ApiKeysSchema({
                userId: testUser._id,
                companyId: testUser.companyId,
                name: 'Test API Key',
                key: apiKeyValue,
                permissions: ['pdf_conversion'],
                isActive: true,
                usage: {
                    totalRequests: 0,
                    lastUsed: null
                }
            });
            
            await testApiKey.save();
            console.log('✅ Test API key created');
        } else {
            console.log('✅ Test API key found');
        }

        console.log('\n🎯 Test API Key Details:');
        console.log('API Key:', testApiKey.key);
        console.log('User ID:', testUser._id);
        console.log('Company ID:', testUser.companyId);
        
        console.log('\n🧪 Test Command:');
        console.log(`curl -X POST http://localhost:3000/v1/convert/pdf \\`);
        console.log(`  -H "Authorization: Bearer ${testApiKey.key}" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"html": "<h1>Test PDF</h1><p>Generated with test API key!</p>"}'`);

        await mongoose.disconnect();
        console.log('\n✅ Database disconnected');

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
    }
}

createTestApiKey();
