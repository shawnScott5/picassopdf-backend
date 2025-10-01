# PicassoPDF API Error Codes Reference

## Overview
This document lists all error codes returned by the PicassoPDF API. All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "suggestion": "Helpful suggestion to fix the issue",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Input Validation Errors (400 Bad Request)

### `MISSING_INPUT`
**Status:** 400  
**Cause:** Neither HTML content nor URL was provided in the request.  
**Solution:** Provide either the `html` or `url` field in your request body.

**Example:**
```json
{
  "html": "<html>...</html>"
}
// OR
{
  "url": "https://example.com"
}
```

---

### `CONFLICTING_INPUT`
**Status:** 400  
**Cause:** Both HTML content and URL were provided in the same request.  
**Solution:** Provide only one - either `html` OR `url`, not both.

---

### `INVALID_URL`
**Status:** 400  
**Cause:** The provided URL is malformed or invalid.  
**Solution:** Ensure the URL is properly formatted with a valid protocol (http:// or https://).

---

### `INVALID_URL_PROTOCOL`
**Status:** 400  
**Cause:** URL uses an unsupported protocol (not HTTP/HTTPS).  
**Solution:** Only HTTP and HTTPS protocols are supported.

---

### `BLOCKED_URL`
**Status:** 400  
**Cause:** URL points to a blocked resource (localhost, internal IP, cloud metadata endpoints).  
**Solution:** Use publicly accessible URLs only. Private IPs and localhost are blocked for security.

**Blocked patterns:**
- localhost, 127.0.0.1, 0.0.0.0
- Private IP ranges (10.x, 172.16-31.x, 192.168.x)
- Cloud metadata endpoints (169.254.169.254)
- .local and .localhost domains

---

### `URL_TOO_LONG`
**Status:** 400  
**Cause:** URL exceeds maximum length of 2048 characters.  
**Solution:** Use a shorter URL or consider using HTML input instead.

---

### `INVALID_OPTIONS`
**Status:** 400  
**Cause:** Invalid PDF generation options provided.  
**Solution:** Check that your options match the API specification.

**Common issues:**
- Invalid `format` (must be: A0-A6, Letter, Legal, Tabloid, Ledger)
- Invalid `scale` (must be between 0.1 and 2.0)
- Conflicting `format` and `width/height` options
- Invalid margin values

---

### `INVALID_CONTENT`
**Status:** 400  
**Cause:** HTML content is malformed or cannot be parsed.  
**Solution:** Validate your HTML syntax before sending.

---

## Size Limit Errors (413 Payload Too Large)

### `HTML_TOO_LARGE`
**Status:** 413  
**Cause:** HTML content exceeds the maximum size limit (10MB).  
**Solution:** Reduce the size of your HTML content. Consider:
- Removing inline images (use URLs instead)
- Minimizing CSS/JavaScript
- Breaking into multiple smaller documents

---

### `CSS_TOO_LARGE`
**Status:** 413  
**Cause:** CSS content exceeds the maximum size limit (2MB).  
**Solution:** Reduce or minify your CSS content.

---

### `JAVASCRIPT_TOO_LARGE`
**Status:** 413  
**Cause:** JavaScript content exceeds the maximum size limit (2MB).  
**Solution:** Reduce or minify your JavaScript content.

---

### `TOTAL_CONTENT_TOO_LARGE`
**Status:** 413  
**Cause:** Combined HTML + CSS + JavaScript exceeds 15MB.  
**Solution:** Reduce the total size of your content.

---

### `CONTENT_TOO_COMPLEX`
**Status:** 413  
**Cause:** Content is estimated to produce more than 1000 pages.  
**Solution:** Break your document into smaller parts or reduce content.

---

## Security Errors (400 Bad Request)

### `SECURITY_VIOLATION`
**Status:** 400  
**Cause:** Content contains potentially malicious or dangerous patterns.  
**Solution:** Remove suspicious code patterns.

**Blocked patterns:**
- Crypto mining scripts
- Excessive DOM nesting (>50,000 elements)
- Potentially malicious JavaScript patterns

---

## Authentication & Authorization Errors

### `INVALID_API_KEY`
**Status:** 401  
**Cause:** API key is invalid or not found.  
**Solution:** Check that you're using the correct API key with the `Bearer` prefix:
```
Authorization: Bearer your_api_key_here
```

---

### `API_KEY_EXPIRED`
**Status:** 401  
**Cause:** Your API key has expired.  
**Solution:** Generate a new API key from your dashboard.

---

### `API_KEY_INACTIVE`
**Status:** 401  
**Cause:** Your API key has been deactivated.  
**Solution:** Activate your API key or create a new one.

---

### `INSUFFICIENT_PERMISSIONS`
**Status:** 403  
**Cause:** API key doesn't have permission for PDF conversion.  
**Solution:** Ensure your API key has the `pdf_conversion` permission.

---

### `IP_NOT_ALLOWED`
**Status:** 403  
**Cause:** Request is from an IP address not on the whitelist.  
**Solution:** Add your IP to the whitelist or disable IP restrictions.

---

## Rate Limiting & Quota Errors (429 Too Many Requests)

### `RATE_LIMIT_EXCEEDED`
**Status:** 429  
**Cause:** Too many requests in a short time period.  
**Solution:** Slow down your request rate. Check the `Retry-After` header.

**Response headers:**
```
Retry-After: 60
```

---

### `QUOTA_EXCEEDED`
**Status:** 429  
**Cause:** Monthly conversion quota has been exhausted.  
**Solution:** Upgrade your plan or wait until quota resets.

---

### `TOO_MANY_CONCURRENT_REQUESTS`
**Status:** 429  
**Cause:** Too many simultaneous conversion requests.  
**Solution:** Wait for current conversions to complete before starting new ones.

**Limits:**
- Free: 1 concurrent request
- Paid plans: 5 concurrent requests

---

## Timeout Errors

### `TIMEOUT`
**Status:** 408  
**Cause:** PDF generation took longer than 5 minutes.  
**Solution:** Simplify your content:
- Reduce number of images
- Remove complex JavaScript
- Decrease page count

---

### `URL_TIMEOUT`
**Status:** 504  
**Cause:** External URL took too long to respond (>30 seconds).  
**Solution:** 
- Ensure the target website responds quickly
- Consider downloading the HTML and sending it directly
- Check that the website is online

---

## Network & Connection Errors

### `DNS_ERROR`
**Status:** 400  
**Cause:** URL domain name could not be resolved.  
**Solution:** Verify the domain name exists and is spelled correctly.

---

### `CONNECTION_REFUSED`
**Status:** 400  
**Cause:** Connection to the URL was refused.  
**Solution:** 
- Ensure the website is online
- Check that the URL is publicly accessible
- Verify the website isn't blocking our servers

---

### `SSL_ERROR`
**Status:** 400  
**Cause:** SSL certificate is invalid or expired.  
**Solution:** 
- Ensure the website has a valid SSL certificate
- Check certificate expiration date
- Contact the website administrator

---

### `CONNECTION_FAILED`
**Status:** 502  
**Cause:** Failed to establish connection to the URL.  
**Solution:** The website may be behind a firewall or blocking automated requests.

---

## Server & Processing Errors

### `OUT_OF_MEMORY`
**Status:** 507  
**Cause:** Content is too complex and exceeded available memory.  
**Solution:** Reduce complexity:
- Decrease image sizes
- Simplify CSS/JavaScript
- Reduce DOM element count
- Break into smaller documents

---

### `BROWSER_CRASH`
**Status:** 500  
**Cause:** Browser crashed during PDF rendering.  
**Solution:** 
- Simplify your HTML structure
- Remove complex JavaScript animations
- Reduce memory-intensive operations

---

### `SESSION_ERROR`
**Status:** 500  
**Cause:** Browser session was terminated unexpectedly.  
**Solution:** This is usually temporary - retry your request.

---

### `CONVERSION_FAILED`
**Status:** 500  
**Cause:** General conversion failure.  
**Solution:** 
- Check your HTML is valid
- Retry the request
- Contact support if the issue persists

---

### `SERVICE_UNAVAILABLE`
**Status:** 503  
**Cause:** PDF conversion service is temporarily unavailable.  
**Solution:** Wait a few moments and retry your request.

---

### `LAMBDA_UNAVAILABLE`
**Status:** 503  
**Cause:** AWS Lambda service is not available.  
**Solution:** This is temporary - retry after a short delay.

---

## Best Practices

### 1. Implement Retry Logic
```javascript
async function convertWithRetry(payload, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await convertToPDF(payload);
    } catch (error) {
      if (error.code === 'TIMEOUT' || error.code === 'SERVICE_UNAVAILABLE') {
        if (i < maxRetries - 1) {
          await sleep(Math.pow(2, i) * 1000); // Exponential backoff
          continue;
        }
      }
      throw error;
    }
  }
}
```

### 2. Handle Rate Limits
```javascript
if (error.statusCode === 429) {
  const retryAfter = response.headers['retry-after'];
  await sleep(retryAfter * 1000);
  // Retry request
}
```

### 3. Validate Input Before Sending
```javascript
// Check size limits
if (html.length > 10 * 1024 * 1024) {
  throw new Error('HTML too large');
}

// Validate URL format
try {
  new URL(url);
} catch {
  throw new Error('Invalid URL');
}
```

### 4. Monitor Error Rates
Track error codes in your application to identify patterns:
- High `TIMEOUT` rates → Content too complex
- High `QUOTA_EXCEEDED` → Need plan upgrade
- High `RATE_LIMIT_EXCEEDED` → Slow down requests

---

## Support

If you encounter errors not listed here or need assistance:
- Email: support@picassopdf.com
- Documentation: https://docs.picassopdf.com
- Status Page: https://status.picassopdf.com

Include the error code and timestamp when contacting support for faster resolution.

