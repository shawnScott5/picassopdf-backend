const { ImageHandler } = require('./imageHandler.js');

/**
 * Test script to verify invalid image handling
 * This tests the specific placeholder.com URL that was causing 20-second delays
 */
async function testInvalidImageHandling() {
    console.log('🧪 Testing invalid image handling...');
    
    const imageHandler = new ImageHandler();
    
    // Test the problematic URL that was causing 20-second delays
    const problematicUrl = 'https://via.placeholder.com/400x150.png?text=Test+Image';
    
    console.log(`Testing URL: ${problematicUrl}`);
    
    try {
        const startTime = Date.now();
        const result = await imageHandler.processImageSrc(problematicUrl);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ Result: ${result}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        
        if (duration > 5000) {
            console.log('❌ FAIL: Image processing took too long (>5s)');
        } else {
            console.log('✅ PASS: Image processing completed quickly');
        }
        
    } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ Expected error caught: ${error.message}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        
        if (duration > 5000) {
            console.log('❌ FAIL: Error handling took too long (>5s)');
        } else {
            console.log('✅ PASS: Error handling completed quickly');
        }
    }
    
    // Test with a valid image URL for comparison
    console.log('\n🧪 Testing valid image handling...');
    const validUrl = 'https://httpbin.org/image/png';
    
    try {
        const startTime = Date.now();
        const result = await imageHandler.processImageSrc(validUrl);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ Valid image result: ${result.substring(0, 50)}...`);
        console.log(`⏱️  Duration: ${duration}ms`);
        
    } catch (error) {
        console.log(`❌ Valid image failed: ${error.message}`);
    }
}

// Run the test
testInvalidImageHandling().catch(console.error);
