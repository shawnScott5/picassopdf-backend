# Rate Limiting Implementation Guide

## Overview

PicassoPDF API now includes comprehensive rate limiting to protect against abuse and ensure fair usage. The system uses **tiered rate limiting** based on subscription tiers, with each tier getting appropriate rate limits based on their credit allowance.

## Rate Limits

### Tiered Rate Limits (PER API KEY)
- **FREE** (≤50 credits): 600 RPM (10 RPS)
- **STARTER** (51-500 credits): 600 RPM (10 RPS)
- **GROWTH** (501-5,000 credits): 600 RPM (10 RPS)
- **SCALE** (5,001-50,000 credits): 600 RPM (10 RPS)
- **SMALL BUSINESS** (50,001-100,000 credits): 600 RPM (10 RPS)
- **MEDIUM BUSINESS** (100,001-500,000 credits): 600 RPM (10 RPS)
- **ENTERPRISE** (500,001-1,000,000 credits): 600 RPM (10 RPS)

### Global Protection
- **IP Protection**: 1000 RPM per IP (global protection)
- **Health Checks**: 1000 RPM

### Development Limits
- **All endpoints**: 1000 RPM (for testing)

## Implementation Details

### Files Created/Modified

1. **`middlewares/rateLimiter.js`** - Main rate limiting middleware
2. **`services/RateLimitMonitor.js`** - Monitoring and analytics
3. **`config/rateLimits.js`** - Environment-specific configurations
4. **`server.js`** - Updated to use rate limiting

### Rate Limiting Strategy

#### 1. **Layered Protection**
```
IP Limiter (1000 RPM global) → Tiered API Limits (600 RPM per API key for all tiers)
```

#### 2. **Tiered Limits** (Implemented)
- **FREE**: 600 RPM (≤50 credits)
- **STARTER**: 600 RPM (51-500 credits)
- **GROWTH**: 600 RPM (501-5,000 credits)
- **SCALE**: 600 RPM (5,001-50,000 credits)
- **SMALL BUSINESS**: 600 RPM (50,001-100,000 credits)
- **MEDIUM BUSINESS**: 600 RPM (100,001-500,000 credits)
- **ENTERPRISE**: 600 RPM (500,001-1,000,000 credits)

#### 3. **Monitoring & Analytics**
- Real-time rate limit event tracking
- IP-based blocking detection
- Hourly/daily statistics
- Top blocked IPs tracking

## API Endpoints

### Rate Limited Endpoints
- `POST /v1/convert` - PDF conversion (600 RPM per API key for all tiers)
- `POST /v1/convert/pdf` - PDF conversion (600 RPM per API key for all tiers)
- `GET /api/*` - General API (600 RPM per API key for all tiers)

### Monitoring Endpoints
- `GET /v1/status` - Server status with rate limit info
- `GET /v1/admin/rate-limits` - Rate limiting statistics
- `GET /health` - Health check (1000 RPM)

## Rate Limit Response

When rate limit is exceeded, the API returns:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests, please try again later",
  "retryAfter": "1 minute",
  "limit": 240,
  "remaining": 0,
  "resetTime": "2024-01-15T10:30:00.000Z"
}
```

## HTTP Headers

The API includes standard rate limit headers:

```
RateLimit-Limit: 240
RateLimit-Remaining: 150
RateLimit-Reset: 1642248600
```

## Monitoring

### Real-time Monitoring
- Console logs for rate limit events
- In-memory statistics tracking
- IP-based blocking detection

### Statistics Available
- Total requests
- Rate limited requests
- Rate limit percentage
- Top blocked IPs
- Hourly/daily usage patterns

### Access Monitoring Data
```bash
curl https://your-api.com/v1/admin/rate-limits
```

## Configuration

### Environment Variables
```bash
# Redis for distributed rate limiting (optional)
REDIS_URL=redis://localhost:6379

# Rate limiting can be disabled in development
NODE_ENV=development  # Uses higher limits
NODE_ENV=production   # Uses production limits
```

### Customizing Limits

Edit `config/rateLimits.js` to modify limits:

```javascript
export const rateLimits = {
    production: {
        pdfConversion: {
            max: 240, // Change this value
            windowMs: 60 * 1000,
        }
    }
};
```

## Redis Integration (Optional)

For distributed rate limiting across multiple server instances:

1. **Add Redis URL to environment**:
   ```bash
   heroku config:set REDIS_URL=redis://your-redis-url
   ```

2. **Rate limiting automatically uses Redis** when available
3. **Falls back to memory store** if Redis unavailable

## Testing Rate Limits

### Test with curl
```bash
# Test PDF conversion rate limit
for i in {1..250}; do
  curl -X POST https://your-api.com/v1/convert/pdf \
    -H "X-API-Key: your-key" \
    -H "Content-Type: application/json" \
    -d '{"html": "<h1>Test</h1>"}'
  echo "Request $i"
done
```

### Expected Behavior
- First 240 requests: Success (200)
- Requests 241+: Rate limit exceeded (429)

## Performance Impact

### Memory Usage
- **Minimal**: ~1-2MB for rate limiting data
- **Auto-cleanup**: Old events removed every hour
- **Bounded**: Maximum 1000 events stored

### CPU Impact
- **Negligible**: Rate limiting is very fast
- **O(1) operations**: Hash table lookups
- **No blocking**: Non-blocking rate limit checks

## Troubleshooting

### Common Issues

1. **Rate limits too strict**
   - Check `config/rateLimits.js`
   - Verify environment is set correctly

2. **Redis connection errors**
   - Rate limiting falls back to memory store
   - Check Redis URL configuration

3. **Memory usage growing**
   - Normal: Events are cleaned up automatically
   - Check cleanup interval in `RateLimitMonitor.js`

### Debug Mode
```bash
# Enable debug logging
DEBUG=rate-limit* npm start
```

## Future Enhancements

### Planned Features
1. **User-based rate limiting** (API key tiers)
2. **Geographic rate limiting**
3. **Dynamic rate limiting** based on server load
4. **Rate limit bypass** for trusted IPs
5. **Webhook notifications** for rate limit events

### Integration Points
- **Stripe billing** for tier management
- **Analytics dashboard** for usage visualization
- **Alert system** for abuse detection

## Security Considerations

### Protection Against
- **DDoS attacks**: IP-based rate limiting
- **API abuse**: Per-endpoint limits
- **Resource exhaustion**: PDF conversion limits
- **Brute force**: Login attempt limits

### Best Practices
- Monitor rate limit statistics regularly
- Set up alerts for unusual patterns
- Review blocked IPs for false positives
- Adjust limits based on legitimate usage patterns

## Support

For rate limiting issues:
1. Check `/v1/admin/rate-limits` for statistics
2. Review server logs for rate limit events
3. Verify environment configuration
4. Contact support with specific error messages

---

**Rate Limiting Status**: ✅ **ACTIVE**  
**Configuration**: 4 RPS (240 RPM)  
**Last Updated**: January 2024
