const { ImageHandler } = require('./imageHandler.js');

/**
 * Test script to verify picsum.photos image handling
 */
async function testPicsumImageHandling() {
    console.log('🧪 Testing picsum.photos image handling...');
    
    const imageHandler = new ImageHandler();
    
    // Test HTML with picsum.photos images
    const testHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Picsum Test</title><style>body { font-family: Arial, sans-serif; margin: 40px; background-color: #f9f9f9; } h1 { color: #2c3e50; text-align: center; } section { margin: 30px 0; } img, svg { display: block; margin: 20px auto; max-width: 400px; }</style></head><body><h1>Picsum Test Page</h1><section><h2>1. Picsum Image</h2><img src="https://picsum.photos/400/300?random=5" alt="Picsum Image"></section><section><h2>2. Picture Element</h2><picture><source media="(min-width: 650px)" srcset="https://picsum.photos/400/150?random=7a"><source media="(min-width: 465px)" srcset="https://picsum.photos/300/100?random=7b"><img src="https://picsum.photos/200/75?random=7c" alt="Responsive"></picture></section></body></html>`;

    console.log('📋 Original HTML contains:');
    console.log('- Picsum images:', (testHtml.match(/picsum\.photos/g) || []).length);
    console.log('- Picture elements:', (testHtml.match(/<picture/g) || []).length);

    const startTime = Date.now();
    
    try {
        // Debug: Test individual image processing
        console.log('\n🔍 Debug - Individual image processing:');
        try {
            const result1 = await imageHandler.processImageSrc('https://picsum.photos/400/300?random=5');
            console.log('Picsum image result:', result1);
        } catch (error) {
            console.log('Picsum image error:', error.message);
        }
        
        const processedHtml = await imageHandler.processImages(testHtml);
        const endTime = Date.now();
        
        console.log('\n✅ Processing completed in:', endTime - startTime, 'ms');
        
        console.log('\n📋 Processed HTML contains:');
        console.log('- Picsum images:', (processedHtml.match(/picsum\.photos/g) || []).length);
        console.log('- Picture elements:', (processedHtml.match(/<picture/g) || []).length);
        console.log('- Hidden divs:', (processedHtml.match(/data-removed-image="true"/g) || []).length);
        console.log('- File URLs:', (processedHtml.match(/file:\/\//g) || []).length);
        console.log('- Data URIs:', (processedHtml.match(/data:image/g) || []).length);
        
        // Show some examples of what was processed
        console.log('\n📋 Processing examples:');
        
        // Check if picsum images were processed
        const dataUriMatches = processedHtml.match(/data:image/g);
        if (dataUriMatches) {
            console.log('✅ Picsum images converted to data URIs:', dataUriMatches.length);
        }
        
        // Debug: Show what the processed HTML looks like
        console.log('\n🔍 Debug - Processed HTML snippets:');
        const imgMatches = processedHtml.match(/<img[^>]*>/g);
        if (imgMatches) {
            imgMatches.forEach((img, index) => {
                console.log(`Image ${index + 1}:`, img);
            });
        }
        
        console.log('\n✅ Picsum image handling test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testPicsumImageHandling().catch(console.error);










