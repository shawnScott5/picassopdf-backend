const { ImageHandler } = require('./imageHandler.js');

/**
 * Test script to verify comprehensive image handling
 * Tests all the image types that were failing in the user's test
 */
async function testComprehensiveImageHandling() {
    console.log('🧪 Testing comprehensive image handling...');
    
    const imageHandler = new ImageHandler();
    
    // Test HTML with all the problematic image types
    const testHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Image Handling Test</title><style>body { font-family: Arial, sans-serif; margin: 40px; background-color: #f9f9f9; } h1 { color: #2c3e50; text-align: center; } section { margin: 30px 0; } img, svg { display: block; margin: 20px auto; max-width: 400px; }</style></head><body><h1>Image Handling Test Page</h1><section><h2>1. Standard Image (src)</h2><img src="https://via.placeholder.com/400x150.png?text=Standard+Image" alt="Standard"></section><section><h2>2. Inline SVG</h2><svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect width="200" height="100" fill="#3498db"/><text x="100" y="55" font-size="20" text-anchor="middle" fill="#fff">Inline SVG</text></svg></section><section><h2>3. Data URI (Base64 PNG)</h2><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIUlEQVQoU2NkQAKMgmEYYWBhYGBg4AFIMLkA2ihXShgYAFCvBfZl8tfIAAAAAElFTkSuQmCC" alt="Base64 PNG"></section><section><h2>4. External SVG (via src)</h2><img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/Bitmap_VS_SVG.svg" alt="External SVG"></section><section><h2>5. Local Image (relative path)</h2><img src="/images/sample.jpg" alt="Local Image"></section><section><h2>6. Object Tag (SVG)</h2><object type="image/svg+xml" data="https://upload.wikimedia.org/wikipedia/commons/0/02/SVG_logo.svg" width="200" height="100"></object></section><section><h2>7. Picture Element (responsive)</h2><picture><source media="(min-width: 650px)" srcset="https://via.placeholder.com/400x150.png?text=Large"><source media="(min-width: 465px)" srcset="https://via.placeholder.com/300x100.png?text=Medium"><img src="https://via.placeholder.com/200x75.png?text=Fallback" alt="Responsive"></picture></section></body></html>`;

    console.log('📋 Original HTML contains:');
    console.log('- via.placeholder.com images:', (testHtml.match(/via\.placeholder\.com/g) || []).length);
    console.log('- Inline SVGs:', (testHtml.match(/<svg/g) || []).length);
    console.log('- Data URIs:', (testHtml.match(/data:image/g) || []).length);
    console.log('- External SVGs:', (testHtml.match(/upload\.wikimedia\.org.*\.svg/g) || []).length);
    console.log('- Object tags:', (testHtml.match(/<object/g) || []).length);
    console.log('- Picture elements:', (testHtml.match(/<picture/g) || []).length);

    const startTime = Date.now();
    
    try {
        const processedHtml = await imageHandler.processImages(testHtml);
        const endTime = Date.now();
        
        console.log('\n✅ Processing completed in:', endTime - startTime, 'ms');
        
        console.log('\n📋 Processed HTML contains:');
        console.log('- via.placeholder.com images:', (processedHtml.match(/via\.placeholder\.com/g) || []).length);
        console.log('- Inline SVGs:', (processedHtml.match(/<svg/g) || []).length);
        console.log('- Data URIs:', (processedHtml.match(/data:image/g) || []).length);
        console.log('- External SVGs:', (processedHtml.match(/upload\.wikimedia\.org.*\.svg/g) || []).length);
        console.log('- Object tags:', (processedHtml.match(/<object/g) || []).length);
        console.log('- Picture elements:', (processedHtml.match(/<picture/g) || []).length);
        console.log('- Hidden divs:', (processedHtml.match(/data-removed-image="true"/g) || []).length);
        
        // Show some examples of what was processed
        console.log('\n📋 Processing examples:');
        
        // Check if placeholder images were removed
        const placeholderMatches = processedHtml.match(/data-removed-image="true"/g);
        if (placeholderMatches) {
            console.log('✅ Placeholder images removed:', placeholderMatches.length);
        }
        
        // Check if external SVGs were converted to data URIs
        const dataUriMatches = processedHtml.match(/data:image\/svg\+xml;charset=utf-8,/g);
        if (dataUriMatches) {
            console.log('✅ External SVGs converted to data URIs:', dataUriMatches.length);
        }
        
        // Check if object tags were converted to img tags
        const objectToImgMatches = processedHtml.match(/<img[^>]*alt="SVG Image"/g);
        if (objectToImgMatches) {
            console.log('✅ Object tags converted to img tags:', objectToImgMatches.length);
        }
        
        console.log('\n✅ Comprehensive image handling test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testComprehensiveImageHandling().catch(console.error);
