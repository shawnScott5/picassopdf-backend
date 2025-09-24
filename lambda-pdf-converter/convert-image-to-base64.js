// Script to convert your local image to base64 data URI
const fs = require('fs');
const path = require('path');

// Path to your image
const imagePath = 'C:\\Users\\sesjr\\OneDrive\\Desktop\\IMG_1652-min.png';

try {
    // Read the image file
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Convert to base64
    const base64String = imageBuffer.toString('base64');
    
    // Create data URI
    const dataUri = `data:image/png;base64,${base64String}`;
    
    console.log('✅ Image converted to base64 data URI');
    console.log('📏 Base64 length:', base64String.length);
    console.log('🔗 Data URI (first 100 chars):', dataUri.substring(0, 100) + '...');
    
    // Create the HTML with the data URI
    const htmlWithDataUri = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Handling Test</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 40px; 
            background-color: #f9f9f9; 
        } 
        h1 { 
            color: #2c3e50; 
            text-align: center; 
        } 
        section { 
            margin: 30px 0; 
        } 
        img, svg { 
            display: block; 
            margin: 20px auto; 
            max-width: 400px; 
        }
    </style>
</head>
<body>
    <h1>Image Handling Test Page</h1>
    
    <section>
        <h2>1. Standard Image (src)</h2>
        <img src="https://res.cloudinary.com/dza3ed8yw/image/upload/v1746886120/xvz2k2dgc6cxxg9wb3t6.jpg" alt="Standard">
    </section>
    
    <section>
        <h2>2. Inline SVG</h2>
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
            <rect width="200" height="100" fill="#3498db"/>
            <text x="100" y="55" font-size="20" text-anchor="middle" fill="#fff">Inline SVG</text>
        </svg>
    </section>
    
    <section>
        <h2>3. Data URI (Base64 PNG)</h2>
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIUlEQVQoU2NkQAKMgmEYYWBhYGBg4AFIMLkA2ihXShgYAFCvBfZl8tfIAAAAAElFTkSuQmCC" alt="Base64 PNG">
    </section>
    
    <section>
        <h2>4. External SVG (via src)</h2>
        <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/Bitmap_VS_SVG.svg" alt="External SVG">
    </section>
    
    <section>
        <h2>5. Local Image (converted to data URI)</h2>
        <img src="${dataUri}" alt="Local Image">
    </section>
    
    <section>
        <h2>6. Object Tag (SVG)</h2>
        <object type="image/svg+xml" data="https://upload.wikimedia.org/wikipedia/commons/0/02/SVG_logo.svg" width="200" height="100"></object>
    </section>
    
    <section>
        <h2>7. Picture Element (responsive)</h2>
        <picture>
            <source media="(min-width: 650px)" srcset="https://picsum.photos/400/150?random=7a">
            <source media="(min-width: 465px)" srcset="https://picsum.photos/300/100?random=7b">
            <img src="https://picsum.photos/200/75?random=7c" alt="Responsive">
        </picture>
    </section>
</body>
</html>`;

    // Create the API payload
    const apiPayload = {
        html: htmlWithDataUri,
        options: {
            save_to_vault: true
        },
        ai_options: {
            layout_repair: false
        }
    };
    
    // Save to file
    fs.writeFileSync('api-payload-with-local-image.json', JSON.stringify(apiPayload, null, 2));
    
    console.log('✅ API payload saved to: api-payload-with-local-image.json');
    console.log('📋 Use this payload to test your Lambda function');
    
} catch (error) {
    console.error('❌ Error converting image:', error.message);
    console.log('💡 Make sure the image file exists at:', imagePath);
}
