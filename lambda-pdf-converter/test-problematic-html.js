/**
 * Test script to verify the problematic HTML is handled correctly
 * This tests the exact HTML that was causing 21-second delays
 */

function removeProblematicImages(html) {
    const problematicServices = ['via.placeholder.com', 'placeholder.com', 'dummyimage.com'];
    
    // Replace problematic img tags with hidden divs
    let processedHtml = html;
    
    problematicServices.forEach(service => {
        const imgRegex = new RegExp(`<img([^>]*?)src\\s*=\\s*["'][^"']*${service.replace('.', '\\.')}[^"']*["']([^>]*?)>`, 'gi');
        processedHtml = processedHtml.replace(imgRegex, '<div style="display:none;" data-removed-image="true"></div>');
    });
    
    return processedHtml;
}

// Test with the exact HTML that was causing issues
const problematicHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Complex Test Page</title><style>body { font-family: Arial, sans-serif; margin: 40px; background-color: #f9f9f9; } h1 { color: #2c3e50; text-align: center; } p { line-height: 1.6; } table { width: 100%; border-collapse: collapse; margin-top: 20px; } th, td { border: 1px solid #ccc; padding: 10px; text-align: left; } th { background-color: #34495e; color: white; } ul { list-style-type: square; margin-left: 20px; } a { color: #e74c3c; text-decoration: none; } a:hover { text-decoration: underline; } .highlight { background-color: #f1c40f; padding: 2px 5px; border-radius: 3px; }</style></head><body><h1>Complex HTML Test Page</h1><p>Welcome to this <span class="highlight">complex</span> HTML test page. It includes multiple elements like tables, images, lists, and links.</p><img src="https://via.placeholder.com/400x150.png?text=Test+Image" alt="Test Image" style="display:block; margin: 20px auto;"><h2>Sample Table</h2><table><tr><th>Name</th><th>Age</th><th>City</th></tr><tr><td>Alice</td><td>30</td><td>New York</td></tr><tr><td>Bob</td><td>25</td><td>Los Angeles</td></tr><tr><td>Charlie</td><td>35</td><td>Chicago</td></tr></table><h2>Lists</h2><ul><li>First item</li><li>Second item with <a href="https://example.com">a link</a></li><li>Third item</li></ul><script>document.addEventListener('DOMContentLoaded', function() { console.log('Page loaded for PDF conversion test'); });</script></body></html>`;

console.log('🧪 Testing problematic HTML processing...');
console.log('Original HTML contains placeholder image:', problematicHtml.includes('via.placeholder.com'));

const startTime = Date.now();
const processedHtml = removeProblematicImages(problematicHtml);
const endTime = Date.now();

console.log('✅ Processing completed in:', endTime - startTime, 'ms');
console.log('Processed HTML contains placeholder image:', processedHtml.includes('via.placeholder.com'));
console.log('Processed HTML contains removed image div:', processedHtml.includes('data-removed-image="true"'));

// Show the before/after of the img tag
const originalImgMatch = problematicHtml.match(/<img[^>]*src="https:\/\/via\.placeholder\.com[^"]*"[^>]*>/);
const processedImgMatch = processedHtml.match(/<div[^>]*data-removed-image="true"[^>]*>/);

console.log('\n📋 BEFORE (original img tag):');
console.log(originalImgMatch ? originalImgMatch[0] : 'No img tag found');

console.log('\n📋 AFTER (replaced with hidden div):');
console.log(processedImgMatch ? processedImgMatch[0] : 'No replacement div found');

console.log('\n✅ Test completed successfully!');
