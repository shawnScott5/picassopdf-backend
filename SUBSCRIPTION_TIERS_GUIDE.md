# Subscription Tiers Implementation Guide

## Overview

PicassoPDF now uses a **credit-based tier system** where subscription tiers are automatically determined by the number of credits selected. This provides a more flexible and scalable pricing model.

## Tier Structure

### Credit Ranges & Tiers

| Credits | Tier | Rate Limit | Use Case |
|---------|------|------------|----------|
| ≤ 50 | **FREE** | 600 RPM (10 RPS) | Testing, small projects |
| 51-500 | **STARTER** | 600 RPM (10 RPS) | Small businesses, startups |
| 501-5,000 | **GROWTH** | 600 RPM (10 RPS) | Growing businesses |
| 5,001-50,000 | **SCALE** | 600 RPM (10 RPS) | High-volume operations |
| 50,001-100,000 | **SMALL BUSINESS** | 600 RPM (10 RPS) | Established small businesses |
| 100,001-500,000 | **MEDIUM BUSINESS** | 600 RPM (10 RPS) | Medium-sized organizations |
| 500,001-1,000,000 | **ENTERPRISE** | 600 RPM (10 RPS) | Large organizations |

## Implementation Details

### Backend Changes

#### 1. **Database Schema Updates**
```javascript
// CompanySchema.js
subscription: {
    type: {
        type: String,
        enum: ['FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'SCALE', 'ENTERPRISE'],
        default: 'FREE'
    }
}
```

#### 2. **Utility Functions** (`utils/subscriptionTiers.js`)
- `getSubscriptionTier(credits)` - Determines tier from credit amount
- `getRateLimitForTier(tier)` - Gets rate limit for tier
- `getTierInfo(tier)` - Gets display information for tier

#### 3. **Rate Limiting Integration**
- Each tier gets appropriate rate limits
- Automatic tier determination from credits
- Fallback to FREE tier for unauthenticated users

#### 4. **Subscription Creation**
- Custom subscriptions automatically determine tier from credits
- Tier stored in subscription metadata
- Backward compatibility with existing subscriptions

### Frontend Changes

#### 1. **Membership Component Updates**
- New tier determination functions
- Updated default credit amounts for each tier
- Tier display names and information

#### 2. **Credit-to-Tier Mapping**
```typescript
getSubscriptionTier(credits: number): string {
    if (credits <= 50) return 'FREE';
    else if (credits <= 500) return 'STARTER';
    else if (credits <= 5000) return 'GROWTH';
    else if (credits <= 50000) return 'SCALE';
    else if (credits <= 100000) return 'SMALL_BUSINESS';
    else if (credits <= 500000) return 'MEDIUM_BUSINESS';
    else return 'ENTERPRISE';
}
```

## Rate Limiting by Tier

### Tier-Specific Limits

```javascript
const rateLimits = {
    'FREE': 600,           // 600 RPM (10 RPS) - same for all tiers
    'STARTER': 600,        // 600 RPM (10 RPS)
    'GROWTH': 600,         // 600 RPM (10 RPS)
    'SCALE': 600,          // 600 RPM (10 RPS)
    'SMALL_BUSINESS': 600, // 600 RPM (10 RPS)
    'MEDIUM_BUSINESS': 600,// 600 RPM (10 RPS)
    'ENTERPRISE': 600      // 600 RPM (10 RPS)
};
```

### Benefits of Tiered Rate Limiting

1. **Consistent Performance**: All tiers get the same rate limits for now
2. **Cost Control**: Prevents abuse while allowing legitimate usage
3. **Scalability**: Can handle hundreds of companies with different needs
4. **Future Flexibility**: Easy to adjust rate limits per tier later

## Migration Strategy

### Existing Subscriptions
- **FREE**: Remains FREE (≤50 credits)
- **PRO**: Maps to SCALE (5,001-50,000 credits)
- **SCALE**: Maps to SMALL BUSINESS (50,001-100,000 credits)
- **CUSTOM**: Determined by credit amount

### New Subscriptions
- All new subscriptions use credit-based tier determination
- Tier automatically set based on selected credits
- Rate limits applied based on tier

## API Endpoints

### Status Endpoints
- `GET /v1/status` - Shows tier-based rate limits
- `GET /v1/admin/rate-limits` - Detailed tier statistics

### Response Format
```json
{
  "rateLimiting": {
    "enabled": true,
    "tiers": {
      "FREE": "600 RPM (10 RPS)",
      "STARTER": "600 RPM (10 RPS)",
      "GROWTH": "600 RPM (10 RPS)",
      "SCALE": "600 RPM (10 RPS)",
      "SMALL_BUSINESS": "600 RPM (10 RPS)",
      "MEDIUM_BUSINESS": "600 RPM (10 RPS)",
      "ENTERPRISE": "600 RPM (10 RPS)"
    }
  }
}
```

## Benefits

### For Users
- **Clear pricing**: Pay for what you use
- **Flexible limits**: Choose appropriate tier for your needs
- **Growth path**: Easy to upgrade as needs increase

### For Business
- **Revenue optimization**: Higher tiers = higher revenue
- **Resource management**: Rate limits prevent abuse
- **Scalability**: Can handle diverse customer needs

### For Infrastructure
- **Cost control**: Rate limits prevent AWS Lambda overuse
- **Performance**: Ensures fair resource allocation
- **Monitoring**: Track usage patterns by tier

## Future Enhancements

### Planned Features
1. **Dynamic tier upgrades**: Automatic tier changes based on usage
2. **Tier-specific features**: Different features per tier
3. **Usage analytics**: Track usage patterns by tier
4. **Custom enterprise limits**: Negotiated limits for large customers

### Integration Points
- **Stripe billing**: Tier-based pricing
- **Analytics dashboard**: Tier usage visualization
- **Customer support**: Tier-specific support levels

## Support

For tier-related issues:
1. Check `/v1/status` for current tier limits
2. Verify subscription tier in user data
3. Review rate limit statistics
4. Contact support with specific tier questions

---

**Tier System Status**: ✅ **ACTIVE**  
**Last Updated**: January 2024  
**Compatible With**: All existing subscriptions
