const fs = require("fs");
const path = require("path");
const axios = require("axios");
const mime = require("mime-types");
const { JSDOM } = require("jsdom");

const TMP_DIR = "/tmp"; // Lambda temp dir
const BASE64_LIMIT = 50 * 1024; // 50KB

/**
 * Optimizes images in HTML for fast Lambda PDF rendering.
 * Small images → Base64 inline
 * Large images → Downloaded to /tmp and referenced locally
 */
async function optimizeImages(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const imgTags = [...document.querySelectorAll("img")];

  for (let i = 0; i < imgTags.length; i++) {
    const img = imgTags[i];
    const src = img.getAttribute("src");

    if (!src || src.startsWith("data:") || src.startsWith("file:///")) {
      continue; // already handled
    }

    try {
      // Fetch image as buffer
      const response = await axios.get(src, { responseType: "arraybuffer" });
      const buffer = Buffer.from(response.data);
      const mimeType =
        response.headers["content-type"] || mime.lookup(src) || "image/png";

      if (buffer.length <= BASE64_LIMIT) {
        // Inline as Base64
        const base64 = buffer.toString("base64");
        img.setAttribute("src", `data:${mimeType};base64,${base64}`);
      } else {
        // Save to /tmp
        const fileName = `img_${i}${path.extname(src).split("?")[0] || ".png"}`;
        const filePath = path.join(TMP_DIR, fileName);
        fs.writeFileSync(filePath, buffer);
        img.setAttribute("src", `file:///${filePath}`);
      }
    } catch (err) {
      console.error(`❌ Failed to process image: ${src}`, err.message);
      // fallback → leave original src (might still load if network allows)
    }
  }

  return dom.serialize();
}

module.exports = { optimizeImages };
