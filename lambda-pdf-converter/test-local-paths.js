const { ImageHandler } = require('./imageHandler.js');

/**
 * Test script to verify local path handling
 * Tests both valid local paths and invalid relative paths
 */
async function testLocalPathHandling() {
    console.log('🧪 Testing local path handling...');
    
    const imageHandler = new ImageHandler();
    
    // Test HTML with both valid local path and invalid relative path
    const testHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Local Path Test</title><style>body { font-family: Arial, sans-serif; margin: 40px; background-color: #f9f9f9; } h1 { color: #2c3e50; text-align: center; } section { margin: 30px 0; } img, svg { display: block; margin: 20px auto; max-width: 400px; }</style></head><body><h1>Local Path Test Page</h1><section><h2>1. Valid Local Path (Windows - non-existent)</h2><img src="C:\\\\Users\\\\sesjr\\\\OneDrive\\\\Desktop\\\\IMG_1652-min.png" alt="Valid Local"></section><section><h2>2. Valid Local Path (exists)</h2><img src="./test-image.jpg" alt="Valid Local Exists"></section><section><h2>3. Invalid Relative Path</h2><img src="/images/sample.jpg" alt="Invalid Relative"></section><section><h2>4. Another Invalid Path</h2><img src="./test.jpg" alt="Invalid Relative 2"></section></body></html>`;

    console.log('📋 Original HTML contains:');
    console.log('- Windows local path:', (testHtml.match(/C:\\\\Users/g) || []).length);
    console.log('- Invalid relative paths:', (testHtml.match(/\/images\/|\.\//g) || []).length);

    const startTime = Date.now();
    
    try {
        // Debug: Test the path detection functions
        console.log('\n🔍 Debug - Path detection:');
        console.log('Windows path detection:', imageHandler.isRealLocalPath('C:\\Users\\sesjr\\OneDrive\\Desktop\\IMG_1652-min.png'));
        console.log('Relative path detection:', imageHandler.isRelativePath('/images/sample.jpg'));
        console.log('Relative path detection 2:', imageHandler.isRelativePath('./test.jpg'));
        
        // Debug: Test individual image processing
        console.log('\n🔍 Debug - Individual image processing:');
        try {
            const result1 = await imageHandler.processImageSrc('C:\\Users\\sesjr\\OneDrive\\Desktop\\IMG_1652-min.png');
            console.log('Windows path result:', result1);
        } catch (error) {
            console.log('Windows path error:', error.message);
        }
        
        try {
            const result2 = await imageHandler.processImageSrc('/images/sample.jpg');
            console.log('Relative path result:', result2);
        } catch (error) {
            console.log('Relative path error:', error.message);
        }
        
        try {
            const result3 = await imageHandler.processImageSrc('./test-image.jpg');
            console.log('Local file result:', result3);
        } catch (error) {
            console.log('Local file error:', error.message);
            console.log('Current working directory:', process.cwd());
            console.log('Tmp directory:', imageHandler.tmpDir);
        }
        
        const processedHtml = await imageHandler.processImages(testHtml);
        const endTime = Date.now();
        
        console.log('\n✅ Processing completed in:', endTime - startTime, 'ms');
        
        console.log('\n📋 Processed HTML contains:');
        console.log('- Windows local path:', (processedHtml.match(/C:\\\\Users/g) || []).length);
        console.log('- Invalid relative paths:', (processedHtml.match(/\/images\/|\.\//g) || []).length);
        console.log('- Hidden divs:', (processedHtml.match(/data-removed-image="true"/g) || []).length);
        console.log('- File URLs:', (processedHtml.match(/file:\/\//g) || []).length);
        
        // Show some examples of what was processed
        console.log('\n📋 Processing examples:');
        
        // Check if invalid paths were hidden
        const hiddenMatches = processedHtml.match(/data-removed-image="true"/g);
        if (hiddenMatches) {
            console.log('✅ Invalid relative paths hidden:', hiddenMatches.length);
        }
        
        // Check if valid local paths were processed
        const fileUrlMatches = processedHtml.match(/file:\/\//g);
        if (fileUrlMatches) {
            console.log('✅ Valid local paths processed to file URLs:', fileUrlMatches.length);
        }
        
        // Debug: Show what the processed HTML looks like
        console.log('\n🔍 Debug - Processed HTML snippets:');
        const imgMatches = processedHtml.match(/<img[^>]*>/g);
        if (imgMatches) {
            imgMatches.forEach((img, index) => {
                console.log(`Image ${index + 1}:`, img);
            });
        }
        
        console.log('\n✅ Local path handling test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testLocalPathHandling().catch(console.error);
