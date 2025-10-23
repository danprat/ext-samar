# 🔧 QUICK FIX - Authentication Error

## ❌ Problem
```
[ERROR] Failed to send magic link
[WARN] No auth token found - login required
```

## ✅ Solution

### **Step 1: Get REAL Anon Key** ⚠️ CRITICAL!

The placeholder key in code is FAKE. Get the real one:

1. Open: https://supabase.com/dashboard/project/ekqkwtxpjqqwjovekdqp/settings/api
2. Copy **anon** / **public** key (looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
3. Replace in 2 files:

#### File 1: `api-client.js` (line ~7)
```javascript
const API_CONFIG = {
  SUPABASE_URL: 'https://ekqkwtxpjqqwjovekdqp.supabase.co',
  SUPABASE_ANON_KEY: 'PASTE_REAL_KEY_HERE', // ← Replace this
  FUNCTIONS_URL: 'https://ekqkwtxpjqqwjovekdqp.supabase.co/functions/v1',
  // ...
};
```

#### File 2: `background.js` (line ~13)
```javascript
const CONFIG = {
  ENVIRONMENT: 'production',
  SUPABASE_URL: 'https://ekqkwtxpjqqwjovekdqp.supabase.co',
  SUPABASE_ANON_KEY: 'PASTE_REAL_KEY_HERE', // ← Replace this
  FUNCTIONS_URL: 'https://ekqkwtxpjqqwjovekdqp.supabase.co/functions/v1'
};
```

---

### **Step 2: Verify Email Auth is Enabled**

1. Go to: https://supabase.com/dashboard/project/ekqkwtxpjqqwjovekdqp/auth/providers
2. Make sure **Email** is enabled (toggle ON)
3. Click on Email provider settings
4. For testing: **UNCHECK** "Confirm email"
5. Save changes

---

### **Step 3: Test Authentication**

After replacing the key:

1. Reload extension in Chrome: `chrome://extensions` → Click reload icon
2. Open extension popup
3. Enter your email
4. Click "Kirim Magic Link"
5. Check email for 6-digit code
6. Enter code and verify

---

## 🔍 How to Verify It's Working

### Check Console Logs:
```
✅ [INFO] Sending magic link { email: 'test@example.com' }
✅ [INFO] Magic link sent successfully { email: 'test@example.com' }
```

### Check Email:
You should receive email with:
```
Kode Login SOAL-AI
Gunakan kode ini untuk login:

123456

Kode valid selama 10 menit.
```

---

## 🚨 Common Issues

### Issue 1: "Failed to send magic link"
**Cause**: Invalid anon key or email auth disabled
**Solution**: 
- Double-check anon key is correct
- Verify email provider is enabled in Supabase dashboard

### Issue 2: "Email not confirmed"
**Cause**: "Confirm email" setting is ON
**Solution**: 
- Go to Auth → Providers → Email
- Uncheck "Confirm email" for testing
- Or setup SMTP for production

### Issue 3: "No email received"
**Cause**: Supabase using default email service (may be slow)
**Solution**: 
- Wait 1-2 minutes
- Check spam folder
- For production: setup custom SMTP in Supabase settings

---

## 📝 Key Changes Made

We now use **Native Supabase Auth API** instead of custom Edge Functions:

| Before | After |
|--------|-------|
| `/functions/v1/auth-send-magic-link` | `/auth/v1/otp` (Native) |
| `/functions/v1/auth-verify-otp` | `/auth/v1/verify` (Native) |
| Custom Edge Function | Built-in Supabase Auth |

**Benefits:**
- ✅ No custom code needed
- ✅ Battle-tested security
- ✅ Built-in rate limiting
- ✅ Automatic email delivery
- ✅ Less maintenance

---

## 🎯 Next Steps

1. Get real anon key ⚠️
2. Replace in both files
3. Reload extension
4. Test login flow
5. If working: Setup email templates
6. If working: Enable Google OAuth (optional)

---

**Need Help?**
- Check Supabase logs: https://supabase.com/dashboard/project/ekqkwtxpjqqwjovekdqp/logs
- Check extension console: Right-click extension → Inspect → Console
