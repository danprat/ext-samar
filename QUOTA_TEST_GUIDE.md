# 🧪 Quick Test Guide - Quota System

## Before Testing
1. Reload extension in Chrome: `chrome://extensions` → Reload
2. Open any webpage
3. Check popup to see current quota

## Test Scenarios

### ✅ Scenario 1: FREE User (Quota Available)
**Setup**: Set `usage_count = 15` in database
```sql
UPDATE profiles 
SET usage_count = 15, subscription_expires_at = NULL 
WHERE email = 'your@email.com';
```

**Test Steps**:
1. Open popup → Should show "5/20 soal tersisa"
2. Select text → Right-click → SOAL-AI
3. Wait for answer → Should succeed
4. Open popup again → Should show "6/20 soal tersisa" (incremented)

**Expected**:
- ✅ Answer appears in floating window
- ✅ Progress bar shows ~75% filled
- ✅ No countdown timer
- ✅ Usage count incremented

---

### 🚫 Scenario 2: FREE User (Quota Exceeded)
**Setup**: Set `usage_count = 20` in database
```sql
UPDATE profiles 
SET usage_count = 20, subscription_expires_at = NULL 
WHERE email = 'your@email.com';
```

**Test Steps**:
1. Open popup → Should show "0/20 soal tersisa" + Upgrade button
2. Select text → Right-click → SOAL-AI
3. Wait for overlay

**Expected Overlay**:
```
🚫
Kuota Habis!

Anda telah menggunakan 20/20 soal gratis.
Upgrade ke Premium untuk unlimited access.

Total Penggunaan Akun: 20 / 20
[███████████████████████] 100%
Tidak ada reset otomatis

[🚀 Upgrade ke Premium] [Tutup]
```

**Check**:
- ✅ NO countdown timer
- ✅ NO "tunggu X detik" message
- ✅ Upgrade button present and clickable
- ✅ Progress bar 100% filled
- ✅ Clear "no reset" message

---

### ✨ Scenario 3: PREMIUM User
**Setup**: Grant premium subscription
```sql
UPDATE profiles 
SET usage_count = 50, 
    subscription_expires_at = NOW() + INTERVAL '30 days' 
WHERE email = 'your@email.com';
```

**Test Steps**:
1. Open popup → Should show "✨ Premium - Unlimited"
2. Select text → Right-click → SOAL-AI
3. Answer should appear
4. Repeat 10+ times

**Expected**:
- ✅ All requests succeed
- ✅ No quota check blocking
- ✅ Popup always shows "Unlimited"
- ✅ No "X/20" counter displayed
- ✅ usage_count tracked but not enforced

---

### 🖼️ Scenario 4: Scan Area (Screenshot)
**Setup**: FREE user with `usage_count = 15`

**Test Steps**:
1. Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac)
2. Draw scan area
3. Wait for OCR + answer

**Expected**:
- ✅ Loading overlay appears
- ✅ Image uploaded to Supabase Storage
- ✅ Answer appears in floating window
- ✅ Quota incremented (15 → 16)

**If quota exceeded (usage_count = 20)**:
- ✅ Same quota exceeded overlay appears
- ✅ No countdown timer
- ✅ Upgrade CTA shown

---

## Common Issues & Solutions

### Issue: Popup still shows old format
**Solution**: Hard refresh popup
```javascript
// In popup.js console:
chrome.storage.local.clear();
location.reload();
```

### Issue: Countdown timer still appears
**Check**: 
1. Extension reloaded? (`chrome://extensions`)
2. Cache cleared? (`Ctrl+Shift+R`)
3. No old service worker running?

### Issue: Backend returns old `rate_limit_info`
**Check**:
1. Edge functions deployed? (v18 text, v21 screenshot)
2. Check response in Network tab
3. Response should have `quota_info` not `rate_limit_info`

### Issue: usage_count not incrementing
**Check**:
```sql
-- Check current value
SELECT email, usage_count, subscription_expires_at 
FROM profiles 
WHERE email = 'your@email.com';

-- Reset if needed
UPDATE profiles SET usage_count = 0 WHERE email = 'your@email.com';
```

---

## Quick SQL Commands

### View User Status
```sql
SELECT 
  email,
  usage_count,
  subscription_expires_at,
  CASE 
    WHEN subscription_expires_at > NOW() THEN 'PREMIUM'
    ELSE 'FREE'
  END as plan_type
FROM profiles
WHERE email = 'your@email.com';
```

### Reset Quota (Testing)
```sql
UPDATE profiles 
SET usage_count = 0 
WHERE email = 'your@email.com';
```

### Set to Almost Limit
```sql
UPDATE profiles 
SET usage_count = 19 
WHERE email = 'your@email.com';
```

### Set to Exceeded
```sql
UPDATE profiles 
SET usage_count = 20 
WHERE email = 'your@email.com';
```

### Grant Premium (30 days)
```sql
UPDATE profiles 
SET subscription_expires_at = NOW() + INTERVAL '30 days'
WHERE email = 'your@email.com';
```

### Revoke Premium
```sql
UPDATE profiles 
SET subscription_expires_at = NULL 
WHERE email = 'your@email.com';
```

---

## Validation Checklist

### UI Display
- [ ] Popup shows "X/20 soal tersisa" format
- [ ] Progress bar reflects current usage
- [ ] No per-minute/per-day/per-month grid
- [ ] Premium shows "Unlimited"
- [ ] Upgrade button appears when quota = 0

### Quota Exceeded Overlay
- [ ] NO countdown timer visible
- [ ] "Tidak ada reset otomatis" message shown
- [ ] Upgrade button prominent
- [ ] Progress bar at 100%
- [ ] Clear "20/20" usage display

### Backend Response
- [ ] `quota_info` field present (not `rate_limit_info`)
- [ ] `action: "quota_exceeded"` when limit reached
- [ ] `limit: 20` for FREE users
- [ ] `limit: "unlimited"` for PREMIUM users

### Functional
- [ ] FREE users limited to 20 questions total
- [ ] PREMIUM users have no limit
- [ ] usage_count increments correctly
- [ ] No automatic reset occurs
- [ ] Upgrade button opens pricing page

---

## Debug Console Commands

### Check Current Quota
```javascript
chrome.storage.local.get(['rateLimitStats'], (result) => {
  console.log('Current quota:', result.rateLimitStats);
});
```

### Force Popup Refresh
```javascript
chrome.runtime.sendMessage({ action: 'updateRateLimitStats' });
```

### View Last Response
```javascript
// In background.js console:
chrome.storage.local.get(['lastQuotaInfo'], (result) => {
  console.log('Last quota info:', result.lastQuotaInfo);
});
```

---

**Remember**: 
1. Always reload extension after code changes
2. Clear browser cache if UI not updating
3. Check Network tab for actual API responses
4. Verify database values match expected state
