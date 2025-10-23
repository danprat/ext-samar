# 🚀 Migrasi ke Supabase Edge Functions

## 📋 Ringkasan Perubahan

Extension SOAL-AI telah berhasil dimigrasi dari Laravel backend ke **Supabase Edge Functions**.

### **Supabase Project Info**
- **Project ID**: `ekqkwtxpjqqwjovekdqp`
- **Project URL**: `https://ekqkwtxpjqqwjovekdqp.supabase.co`
- **Region**: Singapore (ap-southeast-1)
- **Status**: ACTIVE_HEALTHY

---

## 🔄 Endpoint Mapping

### **Authentication**

| Laravel Endpoint | Supabase Endpoint | Method | Status |
|-----------------|-------------------|---------|---------|
| `/login` | Supabase Auth API (`/auth/v1/token`) | POST | ✅ Updated |
| `/me` | `/functions/v1/auth-me` | GET | ✅ Deployed |

### **AI Processing**

| Laravel Endpoint | Supabase Function | Method | Status |
|-----------------|-------------------|---------|---------|
| `/ai/process-text` | `/functions/v1/process-text-question` | POST | ✅ Updated |
| `/ai/process-scan` | `/functions/v1/process-screenshot-question` | POST | ✅ Updated |
| `/ai/rate-limit-stats` | Included in response | - | ✅ Modified |

---

## 🔑 Authentication Changes

### **Sebelum (Laravel)**
```javascript
// Bearer token dari Laravel dengan email/password
auth_token: "laravel_bearer_token"
```

### **Sesudah (Supabase)**
```javascript
// JWT token dari Supabase Auth
supabase_access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
supabase_refresh_token: "refresh_token_here"
```

### **Login Methods**

#### **Method 1: Magic Link (Email OTP)** ✨ RECOMMENDED
1. User input email
2. Extension calls **Supabase Auth API** `/auth/v1/otp`
3. Supabase sends 6-digit OTP to email (built-in email system)
4. User input OTP code
5. Extension calls **Supabase Auth API** `/auth/v1/verify`
6. Supabase returns `access_token` dan `refresh_token`
7. Token disimpan di `chrome.storage.local`

**✅ Advantages:**
- No custom Edge Functions needed for auth
- Uses Supabase's battle-tested auth system
- Built-in email templates and delivery
- Automatic rate limiting and security

#### **Method 2: Google SSO** 🔐
1. User clicks "Login dengan Google"
2. Extension calls **Supabase Auth API** `/auth/v1/authorize?provider=google`
3. Opens OAuth popup via `chrome.identity.launchWebAuthFlow`
4. User login dengan Google account
5. Supabase handles OAuth flow and returns tokens
6. Extension stores token dan user data
7. Profile auto-created by database trigger

**✅ Advantages:**
- Native Supabase OAuth integration
- No custom code needed
- Automatic profile creation via triggers
- Secure token handling

### **Login Flow Diagram**
```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ├─ Method 1: Magic Link
       │  ├─► Input Email
       │  ├─► Receive OTP (email)
       │  ├─► Input 6-digit code
       │  └─► ✅ Authenticated
       │
       └─ Method 2: Google SSO
          ├─► Click "Google Login"
          ├─► OAuth Popup
          ├─► Google Authentication
          └─► ✅ Authenticated
```

---

## 📝 Edge Functions yang Telah Di-Deploy

### 🔐 **Authentication (Direct Supabase Auth API)** ✨

#### 1. **Send Magic Link (OTP)**
- **Endpoint**: `/auth/v1/otp` (Native Supabase Auth)
- **Method**: POST
- **Input**:
  ```json
  {
    "email": "user@example.com",
    "options": {
      "emailRedirectTo": "https://ekqkwtxpjqqwjovekdqp.supabase.co/auth/v1/verify"
    }
  }
  ```
- **Output**: Supabase automatically sends 6-digit OTP email
- **Description**: Uses Supabase's built-in OTP system

#### 2. **Verify OTP**
- **Endpoint**: `/auth/v1/verify` (Native Supabase Auth)
- **Method**: POST
- **Input**:
  ```json
  {
    "type": "email",
    "email": "user@example.com",
    "token": "123456"
  }
  ```
- **Output**:
  ```json
  {
    "access_token": "eyJhbGc...",
    "refresh_token": "refresh_token_here",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "aud": "authenticated",
      "role": "authenticated"
    }
  }
  ```
- **Description**: Verifies OTP and returns JWT tokens
- **Note**: Profile auto-created by Supabase trigger atau RLS

#### 3. **Google OAuth**
- **Endpoint**: `/auth/v1/authorize?provider=google` (Native Supabase Auth)
- **Method**: GET with chrome.identity.launchWebAuthFlow
- **Description**: Uses Supabase's built-in OAuth integration
- **Callback**: Returns tokens in URL hash fragment

#### 3. **auth-me** (v1)
- **Endpoint**: `/functions/v1/auth-me`
- **Method**: GET
- **Output**:
  ```json
  {
    "success": true,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "expired_at": null,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    },
    "subscription": {
      "is_active": true,
      "plan_type": "lifetime",
      "status": "active",
      "expires_at": "2075-01-01T00:00:00Z",
      "usage_count": 10
    }
  }
  ```

---

### 🤖 **AI Processing Functions**

#### 4. **process-text-question** (v16)
- **Endpoint**: `/functions/v1/process-text-question`
- **Method**: POST
- **Input**:
  ```json
  {
    "question": "string",
    "user_type": "TEXT" // optional
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "answer": "AI generated answer",
    "formatted_answer": "Formatted answer",
    "confidence": 95,
    "processing_time": 1234,
    "model_used": "groq/llama-3.1-8b-instant",
    "user_type": "TEXT",
    "rate_limit_info": {
      "current_count": 1,
      "limit": 5,
      "remaining": 4
    }
  }
  ```

### 2. **process-screenshot-question** (v18) ✅ UPDATED
- **Endpoint**: `/functions/v1/process-screenshot-question`
- **Method**: POST
- **Changes in v18**:
  - ✅ Screenshot uploaded to Supabase Storage (`question-images` bucket)
  - ✅ Single AI call using LiteLLM with `gemini/gemini-flash-lite-latest`
  - ✅ No separate OCR step (vision model handles OCR + answering)
  - ✅ Image URL stored in history for persistent access
- **Input**:
  ```json
  {
    "image_data": "base64_string",
    "coordinates": { // optional
      "x": 0,
      "y": 0,
      "width": 100,
      "height": 100
    },
    "extracted_text": "optional pre-extracted text"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "answer": "AI generated answer",
    "formatted_answer": "Formatted answer",
    "scan_area_data": {
      "extracted_text": "OCR extracted text",
      "coordinates": {...},
      "image_url": "https://ekqkwtxpjqqwjovekdqp.supabase.co/storage/v1/object/public/question-images/screenshots/{user_id}/{timestamp}.png"
    },
    "confidence": 90,
    "processing_time": 2345,
    "model_used": "gemini/gemini-flash-lite-latest",
    "user_type": "SCAN",
    "rate_limit_info": {
      "type": "PREMIUM",
      "minute": { "current": 1, "limit": 10, "remaining": 9 },
      "daily": { "current": 5, "limit": 1000, "remaining": 995 },
      "monthly": { "current": 50, "limit": 10000, "remaining": 9950 }
    }
  }
  ```

### 3. **auth-me** (v1)
- **Endpoint**: `/functions/v1/auth-me`
- **Method**: GET
- **Output**:
  ```json
  {
    "success": true,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "expired_at": null,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    },
    "subscription": {
      "is_active": true,
      "plan_type": "lifetime",
      "status": "active",
      "expires_at": "2075-01-01T00:00:00Z",
      "usage_count": 10
    }
  }
  ```

---

## 🛠️ Files yang Telah Diupdate

### 1. **api-client.js** 
- ✅ Changed `BACKEND_URL` → `FUNCTIONS_URL`
- ✅ Added `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- ✅ Updated `getAuthToken()` untuk use `supabase_access_token`
- ✅ Updated `makeRequest()` header untuk include `apikey`
- ✅ Updated endpoint paths:
  - `/ai/process-text` → `/process-text-question`
  - `/ai/process-scan` → `/process-screenshot-question`
- ✅ Modified `getRateLimitStats()` untuk use cached data
- ✅ **Added `sendMagicLink(email)` method**
- ✅ **Added `verifyOTP(email, token)` method**

### 2. **background.js**
- ✅ Updated `CONFIG` dengan Supabase URLs
- ✅ Modified `validateAuthToken()` untuk use `/auth-me`
- ✅ **Added `sendMagicLink(email)` function**
- ✅ **Added `verifyOTP(email, token)` function**
- ✅ **Added `loginWithGoogle()` function untuk Google SSO**
- ✅ Deprecated `loginUser(email, password)` - password login no longer supported
- ✅ Changed storage keys dari `auth_token` → `supabase_access_token`
- ✅ **Added message handlers**:
  - `send_magic_link`
  - `verify_otp`
  - `login_google`

### 3. **manifest.json**
- ✅ Added host permission: `https://ekqkwtxpjqqwjovekdqp.supabase.co/*`
- ✅ **Added `identity` permission** untuk Google OAuth

### 4. **popup.html** ✨ COMPLETELY REDESIGNED
- ✅ **Removed password field** - no more password login
- ✅ **Added Magic Link form** dengan email input
- ✅ **Added OTP verification form** (6-digit code)
- ✅ **Added Google Sign-In button** dengan official Google branding
- ✅ **Two-step authentication flow**:
  1. Enter email → Send magic link
  2. Enter OTP → Verify & login
- ✅ Clean, modern UI dengan proper spacing

### 5. **popup.js**
- ✅ **Added `handleSendMagicLink()`** - send magic link request
- ✅ **Added `handleVerifyOTP()`** - verify OTP code
- ✅ **Added `handleGoogleLogin()`** - initiate Google OAuth
- ✅ **Added `handleBackToEmail()`** - back to email form
- ✅ Updated DOM element references
- ✅ Improved error handling dengan `showAlert()`
- ✅ Auto-reload after successful login

---

## ⚠️ PENTING: Anon Key Security

**PERHATIAN**: File-file berikut mengandung `SUPABASE_ANON_KEY` yang ter-commit:
- `api-client.js`
- `background.js`

### **Anon Key Saat Ini** (Placeholder - HARUS DIGANTI!)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrcWt3dHhwanFxd2pvdmVrZHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg5NzAxNzQsImV4cCI6MjA0NDU0NjE3NH0.RLZyKdBLFJxY5iJ6UD_jXoQoYVB0Ek-Fhf2UH5c0Rj8
```

### **Cara Mendapatkan Real Anon Key**:
1. Buka [Supabase Dashboard](https://supabase.com/dashboard/project/ekqkwtxpjqqwjovekdqp)
2. Pergi ke **Settings** → **API**
3. Copy **anon/public key**
4. Replace placeholder di kedua file

---

## 🧪 Testing Plan

### **1. Test Magic Link Authentication** ✨
```javascript
// Step 1: Send magic link
chrome.runtime.sendMessage({
  action: 'send_magic_link',
  email: 'test@example.com'
}, (response) => {
  console.log('Magic link sent:', response);
});

// Step 2: Verify OTP (after receiving email)
chrome.runtime.sendMessage({
  action: 'verify_otp',
  email: 'test@example.com',
  token: '123456' // 6-digit code from email
}, (response) => {
  console.log('OTP verified:', response);
});

// Test token validation
const isValid = await validateAuthToken();
console.log('Token valid:', isValid);
```

### **2. Test Google SSO**
```javascript
// Initiate Google login
chrome.runtime.sendMessage({
  action: 'login_google'
}, (response) => {
  console.log('Google login:', response);
});
```

### **3. Test Text Processing**
```javascript
const result = await backendAPI.processText('Apa itu photosynthesis?', 'TEXT');
console.log(result);
```

### **4. Test Scan Area**
```javascript
const imageData = 'data:image/png;base64,iVBOR...';
const result = await backendAPI.processScanArea(imageData);
console.log(result);
```

### **5. Test Rate Limit**
```javascript
const stats = await backendAPI.getRateLimitStats();
console.log(stats);
```

---

## 🎨 UI/UX Changes

### **Login Screen - Before vs After**

#### **BEFORE (Password Login)**
```
📧 Email: ___________
🔒 Password: ___________
[ ] Remember me
[    Login Button    ]
```

#### **AFTER (Magic Link + Google SSO)** ✨
```
📧 Email: ___________
[ Send Magic Link ]

────── atau ──────

[🔵 Login dengan Google]
```

#### **OTP Verification Screen** (Step 2)
```
✉️ Magic link telah dikirim ke:
   user@example.com
   
Masukkan 6 digit kode dari email:

🔐 Code: ______
[ Verify & Login ]
[  ← Kembali  ]
```

### **Login Flow Benefits**
- ✅ **No password required** - more secure & user-friendly
- ✅ **Email verification** - ensures valid email addresses
- ✅ **Google SSO** - one-click login for Google users
- ✅ **Auto-profile creation** - seamless onboarding
- ✅ **Modern UX** - follows best practices (passwordless auth)

---

## 📊 Database Schema Requirements

Pastikan Supabase database Anda memiliki tabel:

### **profiles**
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  subscription_expires_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  expired_at TIMESTAMPTZ, -- untuk admin suspension
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **history**
```sql
CREATE TABLE history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  question_text TEXT,
  answer_text TEXT,
  question_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔧 Environment Variables untuk Edge Functions

Pastikan semua Edge Functions memiliki environment variables:

```bash
SUPABASE_URL=https://ekqkwtxpjqqwjovekdqp.supabase.co
SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
LITELLM_API_KEY=<your_litellm_key>
LITELLM_MODEL=groq/llama-3.1-8b-instant
MISTRAL_API_KEY=<your_mistral_key>
```

Set via Supabase Dashboard:
1. Go to **Functions** → Select function
2. Click **Settings**
3. Add **Secrets**

---

## ✅ Next Steps

### **CRITICAL - Setup Required**

1. **Get Real Anon Key** ⚠️ MUST DO FIRST!
   - Go to [Supabase Dashboard](https://supabase.com/dashboard/project/ekqkwtxpjqqwjovekdqp/settings/api)
   - Copy **anon/public key**
   - Replace in `api-client.js` (line ~7)
   - Replace in `background.js` (line ~13)

2. **Enable Email Auth** 📧
   - Go to Authentication → Settings
   - Verify **Email** provider is enabled (default: ON)
   - **IMPORTANT**: Confirm email is NOT required for OTP
     - Go to Authentication → Settings → Auth Providers → Email
     - Uncheck "Confirm email" (untuk testing)
     - Or setup SMTP untuk production email delivery

3. **Configure Email Templates** 📧
   - Go to Authentication → Email Templates
   - Click on "Magic Link" template
   - Customize template:
     ```html
     <h2>Kode Login SOAL-AI</h2>
     <p>Gunakan kode ini untuk login:</p>
     <h1>{{ .Token }}</h1>
     <p>Kode valid selama 10 menit.</p>
     ```
   - Set token expiration: 600 seconds (10 minutes)

4. **Enable Google OAuth Provider** 🔐 (Optional)
   - Go to Authentication → Providers
   - Enable "Google" provider
   - Add Google OAuth credentials:
     - Get from [Google Cloud Console](https://console.cloud.google.com/)
     - Create OAuth 2.0 Client ID
     - Add Client ID & Client Secret
   - Add authorized redirect URIs:
     ```
     https://ekqkwtxpjqqwjovekdqp.supabase.co/auth/v1/callback
     ```
   - Add authorized JavaScript origins:
     ```
     chrome-extension://[YOUR_EXTENSION_ID]
     ```

5. **Setup Database Trigger** (Auto-create Profile) 🔧
   ```sql
   -- Function to auto-create profile on signup
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS trigger AS $$
   BEGIN
     INSERT INTO public.profiles (id, full_name, subscription_expires_at, usage_count)
     VALUES (
       new.id,
       COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
       NULL,
       0
     );
     RETURN new;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   -- Trigger on auth.users insert
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
   ```

4. **Configure Chrome Extension OAuth** 
   - Add to `manifest.json`:
     ```json
     "oauth2": {
       "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
       "scopes": ["email", "profile"]
     }
     ```

5. **Test Authentication Flows**
   - ✅ Test Magic Link flow
   - ✅ Test OTP verification
   - ✅ Test Google SSO
   - ✅ Test auto-profile creation

6. **Test AI Processing**
   - ✅ Test text processing
   - ✅ Test scan area processing
   - ✅ Verify rate limiting

7. **Monitor Logs**
   - Check Edge Function logs
   - Monitor authentication attempts
   - Track error rates

8. **Update Extension Version**
   - Update `version` in manifest.json: `2.3.2` → `2.4.0`
   - Create release notes
   - Package extension
   - Upload to Chrome Web Store

---

## 🆘 Troubleshooting

### **Error: "Unauthorized"**
- Check apakah `supabase_access_token` ada di storage
- Verify token belum expired (default 1 hour)
- Implement token refresh mechanism

### **Error: "Failed to fetch user profile"**
- Pastikan `profiles` table exists
- Check RLS policies di Supabase
- Verify user ID matches auth.users

### **Error: "Quota exceeded"**
- Check `usage_count` di profiles table
- Verify subscription status
- Check `subscription_expires_at` date

---

## 📚 Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Chrome Extension Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)

---

**Migration completed on**: October 23, 2025
**Project**: SOAL-AI Chrome Extension
**Version**: 2.3.2 → 2.4.0 (Supabase)
