# Quota System Update - Simple 20 Limit

## 📋 Overview
Changed from time-based rate limiting (per-minute/per-day/per-month) to simple fixed quota system:
- **FREE users**: 20 questions total (no automatic reset)
- **PREMIUM users**: Unlimited access
- **Upgrade CTA**: Prominent upgrade button when quota is exceeded

## 🔄 Changes Made

### 1. Edge Functions (Backend)
✅ **process-text-question** (v18)
- Removed time-based rate limiting
- Added simple quota check: `if (!isPremium && usage_count >= 20)`
- Returns `quota_info: { current, limit: 20, remaining, plan_type }`
- Action: `quota_exceeded` when limit reached

✅ **process-screenshot-question** (v21)
- Same quota logic as text function
- Server-side image cropping maintained
- Returns consistent `quota_info` format

### 2. Extension UI (Frontend)

#### **popup.js** - Rate Limit Display
**Function Updated**: `updateRateLimitDisplay(stats)`

**Before**: 3-column grid showing per-minute/per-day/per-month stats
```javascript
Per Menit    Per Hari    Per Bulan
  5/5         20/50       100/200
```

**After**: Simple quota display
```javascript
📊 Kuota Gratis     15/20
[████████████░░░░] 75%
15 soal tersisa dari 20 soal gratis

// When quota = 0:
🚫 Kuota habis!
[████████████████] 100%
🚀 Upgrade ke Premium
```

**PREMIUM Display**:
```javascript
✨ Premium    Unlimited    ✅ Aktif
```

#### **background.js** - Overlay Changes

**Function Updated**: `injectRateLimitOverlay()`

**Removed**:
- ❌ Countdown timer logic (per-minute/daily/monthly)
- ❌ Auto-remove overlay after countdown
- ❌ Reset time calculations
- ❌ Complex time-based messages

**Added**:
- ✅ Simple quota exceeded message
- ✅ Visual quota usage display with progress bar
- ✅ Prominent "Upgrade ke Premium" button
- ✅ "No automatic reset" message

**Display**:
```
🚫
Kuota Habis!

Anda telah menggunakan 20/20 soal gratis.
Upgrade ke Premium untuk unlimited access.

[Progress Bar: 100%]
Total Penggunaan Akun: 20 / 20
Tidak ada reset otomatis

[🚀 Upgrade ke Premium] [Tutup]
```

**Response Handling Updated** (3 locations):
1. ✅ Context menu click handler
2. ✅ Text selection shortcut handler (`processSelectedText`)
3. ✅ Scan area handler (`processScanArea`)

**Changed**:
```javascript
// OLD:
if (action.startsWith('rate_limit') || action === 'rate_limit')
  rateLimitInfo = result.rate_limit_info
  limitType = rateLimitInfo?.type || 'minute'
  // Complex time-based logic...

// NEW:
if (action === 'quota_exceeded')
  quotaInfo = result.quota_info
  await injectRateLimitOverlay(tab.id, error, 0, 'quota', quotaInfo)
```

## 📊 Response Format

### Backend Response (Edge Functions)
```json
{
  "success": false,
  "error": "Anda telah menggunakan 20/20 soal gratis. Upgrade ke Premium untuk unlimited access.",
  "action": "quota_exceeded",
  "quota_info": {
    "current": 20,
    "limit": 20,
    "remaining": 0,
    "plan_type": "FREE"
  },
  "upgrade_required": true
}
```

### Success Response
```json
{
  "success": true,
  "answer": "...",
  "quota_info": {
    "current": 15,
    "limit": 20,
    "remaining": 5,
    "plan_type": "FREE"
  }
}
```

### Premium User Response
```json
{
  "success": true,
  "answer": "...",
  "quota_info": {
    "current": 150,
    "limit": "unlimited",
    "remaining": "unlimited",
    "plan_type": "PREMIUM"
  }
}
```

## 🧪 Testing Checklist

### FREE User (usage_count < 20)
- [ ] Text selection shows answer successfully
- [ ] Scan area shows answer successfully
- [ ] Popup shows "X/20 soal tersisa" with progress bar
- [ ] Each request increments quota counter

### FREE User (usage_count = 20)
- [ ] Text selection shows quota exceeded overlay
- [ ] Scan area shows quota exceeded overlay
- [ ] Popup shows "0/20" with 100% progress bar
- [ ] Popup shows "Upgrade ke Premium" button
- [ ] Overlay shows upgrade CTA
- [ ] Clicking upgrade opens pricing page

### PREMIUM User
- [ ] Text selection works without quota check
- [ ] Scan area works without quota check
- [ ] Popup shows "✨ Premium - Unlimited"
- [ ] usage_count tracked but not limited

## 🔍 Key Differences

| Feature | OLD System | NEW System |
|---------|-----------|------------|
| **Limit Structure** | Per minute/day/month | Fixed 20 total |
| **Reset** | Automatic (time-based) | No automatic reset |
| **Countdown Timer** | Yes (complex) | No |
| **Overlay Type** | Time-based with reset info | Simple upgrade prompt |
| **Premium Message** | "Larger limits" | "Unlimited access" |
| **Client Tracking** | Complex time windows | Simple counter |
| **Backend Logic** | 3 separate limits | 1 simple check |

## 📝 Database Schema (No Changes)
```sql
-- profiles table structure (unchanged):
id UUID PRIMARY KEY
email TEXT
usage_count INTEGER DEFAULT 0
subscription_expires_at TIMESTAMP
created_at TIMESTAMP

-- FREE: subscription_expires_at IS NULL OR < NOW()
-- PREMIUM: subscription_expires_at > NOW()
```

## 🚀 Deployment Notes

### Edge Functions
```bash
# Already deployed:
✅ process-text-question (v18)
✅ process-screenshot-question (v21)
```

### Extension Files
```bash
# Modified files to reload:
- background.js (quota handling logic)
- popup.js (quota display UI)

# No manifest.json changes required
# No new permissions needed
```

## 💡 User Communication

### Messaging Strategy
1. **Initial Experience**: "20 soal gratis tersedia"
2. **During Usage**: "X soal tersisa dari 20 soal gratis"
3. **Quota Reached**: "Kuota habis! 🚫 Upgrade untuk unlimited"
4. **No Reset**: "Tidak ada reset otomatis"

### Upgrade Value Proposition
- ❌ OLD: "Limit yang lebih besar" (vague)
- ✅ NEW: "Unlimited access" (clear benefit)

## 📌 Important Notes

1. **No Client-Side Reset Logic**: Removed all countdown timers and time-based calculations
2. **Single Source of Truth**: Backend controls quota completely
3. **Simplified UX**: One clear message instead of multiple time windows
4. **Upgrade Focus**: Changed from "wait and retry" to "upgrade to continue"
5. **Premium Emphasis**: Clear differentiation between FREE (20 limit) and PREMIUM (unlimited)

## 🔗 Related Files
- `DIRECT_IMAGE_UPLOAD_FIX.md` - How images bypass local OCR
- `OCR_FIX_SUMMARY.md` - OCR processing documentation
- `grant_subscription.sql` - SQL for granting premium subscriptions
- `SUPABASE_MIGRATION.md` - Database migration notes

---

**Status**: ✅ Complete
**Version**: Extension UI v2.0 + Edge Functions v18/v21
**Date**: 2024
