# Fix: Floating Window Loading Forever on Quota Exceeded

## 🐛 Problem
- Edge function return 429 error dengan quota exceeded
- `api-client.js` catch error dan parse jadi `RATE_LIMIT:{...}`
- Tapi `background.js` tidak recognize `action: 'quota_exceeded'`
- Floating window tetap loading (muter-muter terus)

## ✅ Solution

### 1. api-client.js - Consistent Error Format
**Updated**:
- `processText()` catch block
- `processScanArea()` catch block

**Before**:
```javascript
if (error.message.startsWith('RATE_LIMIT:')) {
  const rateLimitData = JSON.parse(error.message.substring(11));
  return {
    success: false,
    error: rateLimitData.reason,
    action: rateLimitData.action, // ❌ undefined dari edge function
    rate_limit_info: rateLimitData
  };
}
```

**After**:
```javascript
if (error.message.startsWith('RATE_LIMIT:')) {
  const rateLimitData = JSON.parse(error.message.substring(11));
  return {
    success: false,
    error: rateLimitData.reason,
    action: 'quota_exceeded', // ✅ Consistent action name
    quota_info: {
      current: rateLimitData.current_count || 20,
      limit: rateLimitData.limit || 20,
      remaining: 0,
      plan_type: 'FREE'
    },
    rate_limit_info: rateLimitData // backward compatibility
  };
}
```

### 2. background.js - Handle Quota Exceeded
**Updated**: `processAIRequest()` function

**Before**:
```javascript
if (result.action && (result.action.startsWith('rate_limit') || result.action === 'rate_limit')) {
  // ❌ Never match 'quota_exceeded'
  return { success: false, error, action, rate_limit_info };
}
```

**After**:
```javascript
// ✅ Handle quota exceeded first
if (result.action === 'quota_exceeded') {
  return {
    success: false,
    error: result.error,
    action: 'quota_exceeded',
    quota_info: result.quota_info,
    rate_limit_info: result.rate_limit_info
  };
}

// Legacy rate limiting (backward compatibility)
if (result.action && result.action.startsWith('rate_limit')) {
  return { success: false, error, action, rate_limit_info };
}
```

## 📊 Error Flow

### Before (Broken)
```
1. User click SOAL-AI (quota = 20/20)
   ↓
2. Edge function returns:
   { status: 429, action: undefined }
   ↓
3. api-client.js catches 429:
   { action: undefined, rate_limit_info: {...} }
   ↓
4. background.js processAIRequest():
   result.action is undefined
   ↓
5. No match for 'quota_exceeded'
   ↓
6. Returns generic error
   ↓
7. Floating window keeps loading ⏳❌
```

### After (Fixed)
```
1. User click SOAL-AI (quota = 20/20)
   ↓
2. Edge function returns:
   { status: 429, error: "Anda telah menggunakan 20/20..." }
   ↓
3. api-client.js catches 429:
   { 
     action: 'quota_exceeded', ✅
     quota_info: { current: 20, limit: 20, remaining: 0 }
   }
   ↓
4. background.js processAIRequest():
   result.action === 'quota_exceeded' ✅
   ↓
5. Returns quota exceeded response
   ↓
6. Context menu handler catches it:
   if (litellmResult.action === 'quota_exceeded')
   ↓
7. Remove loading overlay ✅
   ↓
8. Show quota exceeded overlay with upgrade CTA 🚀
```

## 🧪 Testing

### Test Quota Exceeded
```sql
-- Set quota to limit
UPDATE profiles SET usage_count = 20 WHERE email = 'your@email.com';
```

**Steps**:
1. Select text → Right-click → SOAL-AI
2. Should show loading overlay
3. Should remove loading overlay immediately
4. Should show quota exceeded overlay:
   ```
   🚫 Kuota Habis!
   Anda telah menggunakan 20/20 soal gratis.
   [🚀 Upgrade ke Premium]
   ```

### Expected Console Output
```javascript
// api-client.js
🔌 [API-ERROR] Request failed {status: 429, ...}
🔌 [API-ERROR] Text processing failed {
  error: 'RATE_LIMIT:{"reason":"Anda telah menggunakan 20/20...", ...}'
}

// background.js
Quota exceeded {
  current: 20, 
  limit: 20, 
  remaining: 0, 
  plan_type: 'FREE'
}
Showing quota exceeded overlay
```

## 📝 Files Modified

1. ✅ `api-client.js`
   - processText() - Add `action: 'quota_exceeded'`
   - processScanArea() - Add `action: 'quota_exceeded'`
   - Parse quota_info from rate limit data

2. ✅ `background.js`
   - processAIRequest() - Handle `action === 'quota_exceeded'`
   - Pass quota_info in success response
   - Maintain backward compatibility with rate_limit_info

## 🔗 Related Issues

This fix completes the quota system implementation:
- Edge functions (v18, v21): Return proper error with quota info ✅
- api-client.js: Parse and format error consistently ✅
- background.js: Recognize and handle quota exceeded ✅
- Floating window: Stop loading and show proper overlay ✅

---

**Status**: ✅ Fixed
**Files**: api-client.js, background.js
**Test**: Quota exceeded now shows overlay instead of infinite loading
