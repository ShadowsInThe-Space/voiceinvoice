# Stripe Customer Portal - Error Handling

## ✅ Implemented Error Handling

### Backend API Validation

- ✅ Zod schema validation for `returnUrl` (must be valid URL)
- ✅ JWT token validation (401 if missing/invalid)
- ✅ Stripe API error handling with try-catch
- ✅ Webhook signature verification (400 for invalid)
- ✅ License lookup by stripeCustomerId with error handling

### Frontend Error Handling

- ✅ API error catching with user-friendly messages
- ✅ Loading states (openingPortal, validating, purchasing)
- ✅ Disabled buttons during operations
- ✅ Error state display in UI

### Webhook Error Recovery

- ✅ Logged errors for subscription updates
- ✅ Webhook returns 200 even if processing fails (Stripe retry)
- ✅ License store errors caught and logged

## 🔧 Error Scenarios Covered

### 1. Missing/Invalid Authentication

**Scenario:** User tries to access portal without valid JWT
**Handling:**

- API returns 401 Unauthorized
- Frontend shows: "Unauthorized - please validate your license first"

### 2. Missing Stripe Customer ID

**Scenario:** Trial license without stripeCustomerId
**Handling:**

- API returns 400 Customer ID required
- Frontend: Button not shown for non-ACTIVE licenses

### 3. Stripe API Failures

**Scenario:** Stripe API down or rate limited
**Handling:**

- Caught in try-catch
- Returns 500 with "Stripe error: <message>"
- Frontend shows user-friendly error

### 4. Invalid Webhook Signature

**Scenario:** Webhook without valid Stripe signature
**Handling:**

- Returns 400 Invalid signature
- Stripe will retry webhook automatically
- No license updates performed

### 5. Network Failures

**Scenario:** Frontend can't reach backend
**Handling:**

- Catch block in handleManageSubscription
- Show error in UI
- Reset loading state (openingPortal = false)

### 6. License Not Found

**Scenario:** Webhook for unknown stripeCustomerId
**Handling:**

- Log warning: "License store does not support updateLicenseByStripeCustomerId"
- Return 200 to acknowledge webhook
- No crash

## 🚨 Critical Error Paths

### Portal Session Creation

```
User clicks "Abo verwalten"
  → Frontend: Loading state
  → API: Validate JWT
    ❌ Invalid → 401 → Frontend shows error
  → API: Get license
    ❌ No stripeCustomerId → 400 → Frontend shows error
  → API: Call Stripe
    ❌ Stripe error → 500 → Frontend shows error
  ✅ Success → Redirect to portal
```

### Subscription Cancellation

```
User cancels in Stripe Portal
  → Stripe: Send webhook
  → API: Verify signature
    ❌ Invalid → 400 → Stripe retries later
  → API: Find license by stripeCustomerId
    ❌ Not found → Log warning → Return 200
  → API: Update license status to EXPIRED
    ❌ Update fails → Log error → Return 200 (prevent retry loop)
  ✅ Success → License deactivated
```

## 📝 Logging Strategy

### Info Level (Success Cases)

- Portal session created
- Subscription updated/deleted
- License status changed

### Warning Level (Recoverable)

- Subscription set to cancel at period end
- License store method not supported
- Payment failed (user can retry)

### Error Level (Failures)

- Webhook verification failed
- License update failed
- Stripe API errors

## 🔄 Retry Logic

### Webhooks

- Stripe automatically retries failed webhooks (400/500 responses)
- Our webhook returns 200 even for non-critical failures
- Prevents infinite retry loops for unrecoverable errors

### Frontend

- No automatic retry for portal session creation
- User must manually click "Abo verwalten" again
- Clear error message indicates what went wrong

## 🛡️ Production Considerations

### Environment-Specific Behavior

```typescript
const message =
  process.env.NODE_ENV === 'production' && statusCode >= 500
    ? 'Internal server error' // Hide details
    : error.message; // Show specific error
```

### Required Environment Variables

- `STRIPE_SECRET_KEY` - Portal routes disabled if missing
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification
- Log warnings if missing, don't crash server

### Rate Limiting

- Existing rate limit: 60 requests/minute per IP
- Applies to portal endpoint
- Prevents abuse

## ✅ Error Handling Checklist

- [x] Input validation (Zod schemas)
- [x] Authentication errors (401)
- [x] Authorization errors (400/403)
- [x] Stripe API errors (400/500)
- [x] Network errors (fetch failures)
- [x] Webhook signature verification
- [x] License not found scenarios
- [x] Frontend loading states
- [x] User-friendly error messages
- [x] Logging for debugging
- [x] Production error hiding
- [x] Graceful degradation (portal routes disabled without STRIPE_SECRET_KEY)

## 🔍 Debugging

### Backend Logs

```bash
# View webhook logs
tail -f /var/log/proxy-server.log | grep "Stripe webhook"

# View portal session logs
tail -f /var/log/proxy-server.log | grep "Portal session"
```

### Frontend Console

- All API errors logged to console.error
- Check Network tab for request/response details
- Check Application → Local Storage for JWT token

### Stripe Dashboard

- View webhook delivery attempts and failures
- Check portal session creation events
- Monitor subscription changes
