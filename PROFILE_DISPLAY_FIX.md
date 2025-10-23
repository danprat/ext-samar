# Profile Display Fix - Edge Function & UI Update

## 🐛 Problem Identified

### 1. Edge Function `auth-me` Issues
❌ **Fields tidak ada di database**:
- `profile.full_name` → TIDAK ADA di tabel `profiles`
- `profile.expired_at` → TIDAK ADA di tabel `profiles`
- Return: `name: profile.full_name || user.email` → Error karena field tidak ada

❌ **Format plan_type tidak konsisten**:
- Edge function auth-me v1: `'free'`, `'monthly'`, `'lifetime'`
- Edge function v18/v21: `'FREE'`, `'PREMIUM'`
- Menyebabkan konflik di popup.js

❌ **Response format tidak sesuai quota system**:
- Tidak ada `quota_info` dalam response
- Tidak konsisten dengan process-text-question v18

### 2. Popup.js Display Issues
❌ **Tampilan tidak sesuai untuk FREE user**:
- Screenshot menunjukkan: "Perlu Subscription Aktif"
- Seharusnya: "FREE Plan - X/20 soal tersisa"

❌ **Logika subscription salah**:
- `updateLicenseDisplay()` menganggap FREE user = tidak ada subscription
- Seharusnya: FREE user = subscription aktif dengan quota 20

## ✅ Solutions Implemented

### 1. Edge Function `auth-me` v2 Deployed

**Changes**:
```typescript
// REMOVED fields yang tidak ada:
// - profile.full_name ❌
// - profile.expired_at ❌

// NEW response format:
{
  success: true,
  user: {
    id: user.id,
    email: user.email,
    name: user.email, // ✅ Use email instead of full_name
    created_at: user.created_at,
    updated_at: user.updated_at
  },
  subscription: {
    is_active: isPremium,
    plan_type: 'FREE' | 'PREMIUM', // ✅ Consistent format
    status: 'active' | 'inactive',
    expires_at: profile.subscription_expires_at || null,
    usage_count: usageCount
  },
  quota_info: { // ✅ NEW: same as process-text-question v18
    current: usageCount,
    limit: isPremium ? 'unlimited' : 20,
    remaining: isPremium ? 'unlimited' : Math.max(0, 20 - usageCount),
    plan_type: 'FREE' | 'PREMIUM'
  }
}
```

**Logic**:
```typescript
const isPremium = subscription_expires_at > NOW();
const planType = isPremium ? 'PREMIUM' : 'FREE';
const FREE_QUOTA_LIMIT = 20;
```

**Deployment**:
```bash
✅ Deployed: auth-me v2
URL: https://ekqkwtxpjqqwjovekdqp.supabase.co/functions/v1/auth-me
Status: ACTIVE
```

---

### 2. Popup.js Display Updates

#### **A. loadUserProfile() - Handle quota_info**

**Before**:
```javascript
if (result.subscription) {
  await chrome.storage.local.set({
    plan_type: result.subscription.plan_type,
    expires_at: result.subscription.expires_at,
    subscription_status: result.subscription.status,
    license_valid: result.subscription.is_active
  });
}
```

**After**:
```javascript
if (result.subscription) {
  await chrome.storage.local.set({
    plan_type: result.subscription.plan_type,
    expires_at: result.subscription.expires_at,
    subscription_status: result.subscription.status,
    license_valid: result.subscription.is_active,
    usage_count: result.subscription.usage_count || 0 // ✅ NEW
  });
}

// ✅ NEW: Store quota info
if (result.quota_info) {
  await chrome.storage.local.set({
    rateLimitStats: result.quota_info
  });
}

// ✅ Pass quota_info to updateLicenseDisplay
updateLicenseDisplay(result.subscription, result.quota_info);
if (result.quota_info) {
  updateRateLimitDisplay(result.quota_info);
}
```

---

#### **B. updateLicenseDisplay() - Support FREE & PREMIUM**

**Before**:
```javascript
function updateLicenseDisplay(data) {
  if (!data || !data.expires_at || !data.plan_type) {
    updateNoSubscriptionDisplay(); // ❌ Shows "Perlu Subscription Aktif"
    return;
  }
  // Only handle PREMIUM users...
}
```

**After**:
```javascript
function updateLicenseDisplay(data, quotaInfo) {
  const planType = data?.plan_type || 'FREE';
  
  // ✅ FREE user - show quota info
  if (planType === 'FREE' || planType === 'free') {
    updateFreeUserDisplay(quotaInfo);
    return;
  }

  // ✅ PREMIUM user - show subscription info
  const isActive = calculateIsActive(data.expires_at);
  if (!isActive) {
    updateFreeUserDisplay(quotaInfo); // Expired premium → show as FREE
    return;
  }
  
  updatePremiumSubscriptionCard(data, isActive);
}
```

---

#### **C. NEW: updateFreeUserDisplay()**

```javascript
function updateFreeUserDisplay(quotaInfo) {
  const current = quotaInfo?.current || 0;
  const limit = quotaInfo?.limit || 20;
  const remaining = quotaInfo?.remaining || (limit - current);

  // Icon & Title
  subscriptionIcon.textContent = '🆓';
  subscriptionTitle.textContent = 'FREE Plan';
  subscriptionDesc.textContent = `${remaining} soal tersisa dari ${limit} soal gratis`;
  
  // Badge
  const badgeClass = remaining > 0 ? 'badge-active' : 'badge-expired';
  const badgeText = remaining > 0 ? 'Aktif' : 'Habis';
  subscriptionBadge.innerHTML = `<span class="badge ${badgeClass}">${badgeText}</span>`;
  
  // Expiry
  expiryDate.textContent = 'Tidak ada batas waktu';
  daysRemainingRow.style.display = 'none';
  
  // Show upgrade buttons
  upgradeButtons.style.display = 'block';
  
  // Apply FREE theme
  applyTheme('FREE');
}
```

---

#### **D. NEW: updatePremiumSubscriptionCard()**

```javascript
function updatePremiumSubscriptionCard(data, isActive) {
  // Icon & Title
  subscriptionIcon.textContent = '✨';
  subscriptionTitle.textContent = 'Premium Plan';
  subscriptionDesc.textContent = 'Unlimited soal tanpa batas';
  
  // Badge
  const badgeClass = isActive ? 'badge-active' : 'badge-expired';
  const badgeText = isActive ? 'Aktif' : 'Expired';
  subscriptionBadge.innerHTML = `<span class="badge ${badgeClass}">${badgeText}</span>`;
  
  // Update expiry information
  updateExpiryInfo(data, isActive);
}
```

---

#### **E. getPackageInfo() - Add PREMIUM support**

**Added**:
```javascript
const packageMap = {
  'FREE': {
    icon: '🆓',
    title: 'FREE Plan',
    subtitle: '20 soal gratis' // ✅ Updated
  },
  'PREMIUM': { // ✅ NEW
    icon: '✨',
    title: 'Premium Plan',
    subtitle: 'Unlimited soal tanpa batas'
  },
  // ... rest of mappings
};
```

---

#### **F. applyTheme() - Support FREE/PREMIUM**

**Before**:
```javascript
if (planType && planType !== 'Trial' && planType !== 'free') {
  body.classList.add('theme-premium');
} else {
  body.classList.add('theme-free');
}
```

**After**:
```javascript
if (planType === 'PREMIUM' || 
    (planType && planType !== 'Trial' && planType !== 'free' && planType !== 'FREE')) {
  body.classList.add('theme-premium');
} else {
  body.classList.add('theme-free');
}
```

---

## 📊 Database Schema (Reference)

```sql
-- profiles table (actual structure):
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR,
  subscription_expires_at TIMESTAMPTZ,  -- For premium check
  usage_count INTEGER DEFAULT 0,        -- For quota tracking
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES profiles(id),
  referral_balance INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
  
  -- ❌ NO full_name field
  -- ❌ NO expired_at field
);
```

---

## 🎨 UI Display Changes

### FREE User Display

**BEFORE** (❌ Incorrect):
```
💳 Perlu Subscription Aktif
Login dan upgrade untuk menggunakan fitur AI
❌ Tidak Aktif
Belum berlangganan
```

**AFTER** (✅ Correct):
```
🆓 FREE Plan
15 soal tersisa dari 20 soal gratis
✅ Aktif
Tidak ada batas waktu

📊 Kuota Gratis              15/20
[████████████████░░░░] 75%
15 soal tersisa dari 20 soal gratis
```

### PREMIUM User Display

**BEFORE** (✅ Already correct):
```
✨ Premium Plan
Unlimited soal tanpa batas
✅ Aktif
Berlaku sampai: 23 Nov 2025
30 hari lagi
```

**AFTER** (✅ Enhanced):
```
✨ Premium Plan
Unlimited soal tanpa batas
✅ Aktif
Berlaku sampai: 23 Nov 2025
30 hari lagi

✨ Premium    Unlimited    ✅ Aktif
```

---

## 🔄 Response Flow

### 1. User Opens Popup
```
1. popup.js calls loadUserProfile()
2. Fetch: /functions/v1/auth-me
3. Response: { user, subscription, quota_info }
4. Store: user_data, plan_type, rateLimitStats
5. Display: updateUserDisplay() + updateLicenseDisplay()
```

### 2. FREE User (usage_count = 15)
```json
{
  "success": true,
  "user": { "email": "user@example.com", "name": "user@example.com" },
  "subscription": {
    "is_active": false,
    "plan_type": "FREE",
    "status": "inactive",
    "expires_at": null,
    "usage_count": 15
  },
  "quota_info": {
    "current": 15,
    "limit": 20,
    "remaining": 5,
    "plan_type": "FREE"
  }
}
```

**Display**:
- 🆓 FREE Plan
- 5 soal tersisa dari 20 soal gratis
- ✅ Aktif badge
- Progress bar: 75%

### 3. PREMIUM User
```json
{
  "success": true,
  "user": { "email": "premium@example.com", "name": "premium@example.com" },
  "subscription": {
    "is_active": true,
    "plan_type": "PREMIUM",
    "status": "active",
    "expires_at": "2025-11-23T00:00:00Z",
    "usage_count": 150
  },
  "quota_info": {
    "current": 150,
    "limit": "unlimited",
    "remaining": "unlimited",
    "plan_type": "PREMIUM"
  }
}
```

**Display**:
- ✨ Premium Plan
- Unlimited soal tanpa batas
- ✅ Aktif badge
- Berlaku sampai: 23 Nov 2025
- 30 hari lagi

---

## 🧪 Testing

### Test 1: FREE User (quota available)
```sql
-- Setup
UPDATE profiles 
SET usage_count = 10, subscription_expires_at = NULL 
WHERE email = 'test@example.com';

-- Expected display:
-- 🆓 FREE Plan
-- 10 soal tersisa dari 20 soal gratis
-- ✅ Aktif
```

### Test 2: FREE User (quota exceeded)
```sql
-- Setup
UPDATE profiles 
SET usage_count = 20, subscription_expires_at = NULL 
WHERE email = 'test@example.com';

-- Expected display:
-- 🆓 FREE Plan
-- 0 soal tersisa dari 20 soal gratis
-- ❌ Habis
-- [Upgrade ke Premium button visible]
```

### Test 3: PREMIUM User
```sql
-- Setup
UPDATE profiles 
SET usage_count = 100, 
    subscription_expires_at = NOW() + INTERVAL '30 days'
WHERE email = 'test@example.com';

-- Expected display:
-- ✨ Premium Plan
-- Unlimited soal tanpa batas
-- ✅ Aktif
-- Berlaku sampai: [date]
-- 30 hari lagi
```

### Test 4: Expired PREMIUM User
```sql
-- Setup
UPDATE profiles 
SET usage_count = 50, 
    subscription_expires_at = NOW() - INTERVAL '1 day'
WHERE email = 'test@example.com';

-- Expected display:
-- 🆓 FREE Plan (reverted to FREE)
-- 0 soal tersisa dari 20 soal gratis (exceeded limit)
-- ❌ Habis
```

---

## 📝 Files Modified

### Edge Functions
1. ✅ `auth-me` (v1 → v2)
   - Fixed non-existent fields
   - Added quota_info response
   - Consistent plan_type format

### Extension Files
2. ✅ `popup.js`
   - loadUserProfile() - handle quota_info
   - updateLicenseDisplay() - support FREE & PREMIUM
   - NEW: updateFreeUserDisplay()
   - NEW: updatePremiumSubscriptionCard()
   - getPackageInfo() - add PREMIUM mapping
   - applyTheme() - support FREE/PREMIUM
   - isPremium() - include 'FREE' check

---

## 🚀 Deployment

### Edge Function
```bash
✅ auth-me v2 deployed
Project: ekqkwtxpjqqwjovekdqp
URL: https://ekqkwtxpjqqwjovekdqp.supabase.co/functions/v1/auth-me
Status: ACTIVE
```

### Extension
```bash
# Reload extension in Chrome
1. Go to: chrome://extensions
2. Find: SOAL-AI Extension
3. Click: Reload button
```

---

## 🔗 Related Documentation

- `QUOTA_SYSTEM_UPDATE.md` - Quota system implementation
- `QUOTA_TEST_GUIDE.md` - Testing guide with SQL commands
- `DIRECT_IMAGE_UPLOAD_FIX.md` - Image processing flow
- `OCR_FIX_SUMMARY.md` - OCR integration documentation

---

## 💡 Key Takeaways

1. **Always verify database schema** before using fields in code
2. **Consistent naming conventions** across backend and frontend
3. **FREE users are valid users** with quota limits, not "no subscription"
4. **Response format consistency** critical for frontend display
5. **Edge function versioning** helps track changes and debug issues

---

**Status**: ✅ Complete
**Version**: auth-me v2, popup.js v2.1
**Date**: October 23, 2025
