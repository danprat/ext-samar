# 🔒 Permission Justifications for Chrome Web Store

Extension: **SOAL-AI Asisten Jawab Soal**  
Version: **2.4.0**  
Manifest Version: **3**

---

## 📋 Permissions Required

### 1. **storage**
**API Used**: `chrome.storage.local`

**Justification**:
```
Required to store user authentication tokens, preferences, and cached data locally. 
Stores: Supabase access/refresh tokens, user profile data, subscription status, 
quota information, and Samar Mode settings. Essential for maintaining user session 
across browser restarts without requiring repeated logins.
```

**Code Usage**:
- `chrome.storage.local.get()` - Retrieve user data, auth tokens, settings
- `chrome.storage.local.set()` - Save authentication tokens, cache user profile
- `chrome.storage.local.remove()` - Clear data on logout

**Files**: background.js, popup.js

---

### 2. **activeTab**
**API Used**: `chrome.tabs` with activeTab permission

**Justification**:
```
Required to access selected text on the currently active webpage when user 
explicitly triggers the context menu or keyboard shortcut. Only accesses the 
active tab and only when user initiates an action. Does not read or modify 
content without explicit user action.
```

**Code Usage**:
- Access selected text when user right-clicks and chooses "Jawab dengan SOAL-AI"
- Capture screenshot of selected area when user activates Scan Area tool
- Only operates on active tab when triggered by user

**Files**: background.js, content-area-selector.js

---

### 3. **scripting**
**API Used**: `chrome.scripting.executeScript()`

**Justification**:
```
Required to inject content scripts for displaying floating answer windows and 
UI overlays on web pages. Used to show AI-generated answers in a non-intrusive 
overlay window after user requests question processing. Essential for delivering 
answers without navigating away from the current page.
```

**Code Usage**:
- `chrome.scripting.executeScript()` - Inject floating window with AI answer
- Display answer overlay on current page
- Show scan area selection tool

**Files**: background.js

---

### 4. **tabs**
**API Used**: `chrome.tabs`

**Justification**:
```
Required to create new tabs for external authentication flows and subscription 
pages. Used to open app.soal-ai.web.id for user registration, subscription 
management, and documentation. Does not read tab content or track browsing history.
```

**Code Usage**:
- `chrome.tabs.create()` - Open signup page, subscription page, guide
- Open external authentication pages
- Navigate to help documentation

**Files**: background.js, popup.js

---

### 5. **contextMenus**
**API Used**: `chrome.contextMenus`

**Justification**:
```
Required to add context menu item "Jawab dengan SOAL-AI" that appears when user 
selects text on a webpage. This is the primary interaction method for the extension, 
allowing users to right-click selected text to get AI-powered answers. Menu only 
appears when text is selected.
```

**Code Usage**:
- `chrome.contextMenus.create()` - Create "Jawab dengan SOAL-AI" menu item
- `chrome.contextMenus.onClicked` - Handle user menu selection
- Menu appears only on text selection

**Files**: background.js

---

### 6. **notifications**
**API Used**: `chrome.notifications`

**Justification**:
```
Required to show completion notifications when AI processing finishes. Provides 
user feedback for long-running operations (e.g., "Jawaban berhasil ditampilkan") 
without interrupting their workflow. Notifications are informational and can be 
dismissed by user.
```

**Code Usage**:
- `chrome.notifications.create()` - Show success/error notifications
- Notify when answer processing completes
- Alert on quota exceeded or errors

**Files**: background.js

---

### 7. **identity**
**API Used**: `chrome.identity`

**Justification**:
```
Required for secure Google OAuth authentication flow. Uses chrome.identity.launchWebAuthFlow() 
to authenticate users with their Google accounts via Supabase Auth. Provides a 
seamless and secure single sign-on experience. Only used when user explicitly 
clicks "Login with Google" button.
```

**Code Usage**:
- `chrome.identity.getRedirectURL()` - Get OAuth callback URL
- `chrome.identity.launchWebAuthFlow()` - Launch Google OAuth popup
- Secure authentication without exposing credentials

**Files**: background.js

---

## 🌐 Host Permissions Required

### 1. **https://ekqkwtxpjqqwjovekdqp.supabase.co/***
**Justification**:
```
Required to communicate with Supabase backend for authentication, user data, 
and AI question processing. This is the primary backend API for the extension. 
Handles: user login/logout, profile management, subscription verification, 
quota tracking, and AI answer generation via Edge Functions.
```

**API Endpoints Used**:
- `/auth/v1/*` - Authentication (login, logout, token refresh)
- `/functions/v1/auth-me` - User profile and subscription status
- `/functions/v1/process-question` - AI question processing
- `/functions/v1/process-screenshot` - Image-based question processing

**Security**: All requests use HTTPS with API key authentication

**Files**: background.js, popup.js, api-client.js

---

### 2. **https://soal-ai.web.id/***
**Justification**:
```
Required to open official website links for user registration, subscription 
management, and documentation. Used only for navigation via chrome.tabs.create() 
when user clicks buttons like "Upgrade to Premium" or "Petunjuk Penggunaan". 
Does not send or receive data, only used for navigation.
```

**Usage**:
- `https://app.soal-ai.web.id/auth/signup` - User registration page
- `https://app.soal-ai.web.id/subscription` - Subscription upgrade page
- `https://app.soal-ai.web.id/extension-guide` - User documentation

**Note**: Read-only for navigation purposes, no data transmission

**Files**: background.js, popup.js

---

## 🔐 Privacy & Security Commitments

### Data Collection
- ✅ Only collects data necessary for functionality
- ✅ Authentication tokens stored locally (chrome.storage.local)
- ✅ No tracking or analytics
- ✅ No third-party data sharing
- ✅ No ads or advertising networks

### User Control
- ✅ All actions require explicit user interaction
- ✅ Clear logout functionality to remove all data
- ✅ Transparent subscription and quota display
- ✅ No background operations without user knowledge

### Security Measures
- ✅ All network requests use HTTPS
- ✅ API keys are not exposed to content scripts
- ✅ OAuth via chrome.identity API (secure)
- ✅ No eval() or remote code execution
- ✅ Content Security Policy enforced

### Compliance
- ✅ Manifest V3 compliant
- ✅ Minimum permission principle followed
- ✅ No unused permissions or hosts
- ✅ Clear single purpose: AI-powered question answering

---

## 📝 Single Purpose Description

**Single Purpose**:
```
SOAL-AI is an AI-powered question answering assistant that helps students 
solve academic questions quickly using artificial intelligence.
```

**Detailed Explanation**:
```
The extension provides a context menu and keyboard shortcuts to process 
selected text (questions) through an AI model, returning detailed answers 
and explanations. Users can select text on any webpage, right-click to 
invoke the extension, and receive AI-generated answers in a floating overlay 
window. Supports both text selection and screen capture for question input.
```

---

## ✅ Verification Checklist

- [x] All permissions have clear justification
- [x] All permissions are actively used in code
- [x] No development/testing permissions included
- [x] No unused host permissions
- [x] API usage documented for each permission
- [x] Privacy policy compliant
- [x] Minimum permission principle followed
- [x] Code references provided for transparency

---

## 📞 Additional Information

**Developer**: SOAL-AI Team  
**Support Email**: support@soal-ai.web.id  
**Website**: https://app.soal-ai.web.id  
**Privacy Policy**: https://app.soal-ai.web.id/privacy  
**Terms of Service**: https://app.soal-ai.web.id/terms  

---

**Last Updated**: October 25, 2025  
**Document Version**: 1.0  
**Extension Version**: 2.4.0
