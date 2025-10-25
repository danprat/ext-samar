# 📋 Chrome Web Store - Quick Copy Justifications

## Single Purpose Description (Required)
```
SOAL-AI is an AI-powered question answering assistant that helps students solve academic questions quickly using artificial intelligence.
```

---

## Permission Justifications (Copy-Paste Ready)

### storage
```
Required to store user authentication tokens, preferences, and cached data locally. Stores Supabase access/refresh tokens, user profile data, subscription status, and settings. Essential for maintaining user session across browser restarts.
```

### activeTab
```
Required to access selected text on the currently active webpage when user explicitly triggers the context menu or keyboard shortcut. Only accesses the active tab when user initiates an action.
```

### scripting
```
Required to inject content scripts for displaying floating answer windows on web pages. Used to show AI-generated answers in a non-intrusive overlay window after user requests question processing.
```

### tabs
```
Required to create new tabs for external authentication flows and subscription pages. Used to open app.soal-ai.web.id for user registration, subscription management, and documentation.
```

### contextMenus
```
Required to add context menu item "Jawab dengan SOAL-AI" that appears when user selects text. This is the primary interaction method, allowing users to right-click selected text to get AI-powered answers.
```

### notifications
```
Required to show completion notifications when AI processing finishes. Provides user feedback for long-running operations without interrupting workflow. Notifications are informational and dismissible.
```

### identity
```
Required for secure Google OAuth authentication flow. Uses chrome.identity.launchWebAuthFlow() to authenticate users with their Google accounts via Supabase Auth. Only used when user clicks "Login with Google".
```

---

## Host Permission Justifications (Copy-Paste Ready)

### https://ekqkwtxpjqqwjovekdqp.supabase.co/*
```
Required to communicate with Supabase backend for authentication, user data, and AI question processing. Handles user login/logout, profile management, subscription verification, and AI answer generation via Edge Functions. All requests use HTTPS with API key authentication.
```

### https://soal-ai.web.id/*
```
Required to open official website links for user registration, subscription management, and documentation. Used only for navigation when user clicks buttons like "Upgrade to Premium". Does not send or receive data, only used for navigation purposes.
```

---

## Privacy Practice Disclosure

### Data Usage
**What data do you collect?**
```
We collect:
- User email and authentication tokens (for login)
- Usage count (for quota management)
- Subscription status (for access control)
All data is stored locally via chrome.storage and on our secure Supabase backend.
```

**How do you use the data?**
```
- Authentication: Verify user identity and maintain sessions
- Quota tracking: Monitor free tier usage (20 questions limit)
- Subscription management: Enable premium features for paid users
- AI processing: Send selected questions to our AI service for answers
```

**Do you share data with third parties?**
```
No. We do not share, sell, or transmit user data to any third parties. 
All data processing occurs between the extension and our Supabase backend.
```

### Data Handling Certification
- [x] Not selling user data to third parties
- [x] Not using or transferring user data for purposes unrelated to the extension's single purpose
- [x] Not using or transferring user data to determine creditworthiness or for lending purposes

---

## Remote Code Disclosure

### Does your extension execute remote code?
**Answer**: No

**Explanation**:
```
The extension does not execute remote code. All JavaScript code is packaged 
within the extension bundle. The extension only sends user questions to our 
Supabase Edge Function API and receives text responses (answers). No remote 
code is fetched, evaluated, or executed.
```

---

## Store Listing - Description (132 char summary)
```
Asisten AI untuk membantu kamu menjawab soal dengan cepat dan akurat menggunakan teknologi AI terbaru.
```

## Store Listing - Detailed Description
```
SOAL-AI adalah extension Chrome yang membantu kamu menjawab berbagai jenis soal dengan bantuan AI.

✨ Fitur Utama:
• Context Menu - Klik kanan pada soal untuk langsung mendapatkan jawaban
• Scan Area - Pilih area layar untuk menganalisis soal
• Secure Authentication - Login dengan email/password atau Google
• Free & Premium Plans - 20 soal gratis untuk memulai
• Samar Mode - Mode rahasia untuk privasi maksimal

🚀 Cara Menggunakan:
1. Pilih teks soal di halaman web
2. Klik kanan dan pilih "Jawab dengan SOAL-AI"
3. Atau gunakan shortcut Ctrl+Shift+S
4. Dapatkan jawaban lengkap dengan penjelasan

⌨️ Keyboard Shortcuts:
• Ctrl+Shift+S - Proses teks terpilih
• Ctrl+Shift+A - Aktifkan Scan Area

🔒 Privacy & Security:
• Data aman dengan enkripsi
• No tracking, no ads
• Compliance dengan Google policies
• Manifest V3 compliant

📦 Plans:
• FREE: 20 soal gratis (no reset)
• PREMIUM: Unlimited soal tanpa batas

💡 Perfect untuk:
• Pelajar dan mahasiswa
• Mengerjakan tugas dan PR
• Belajar mandiri
• Persiapan ujian

📞 Support: support@soal-ai.web.id
🌐 Website: https://app.soal-ai.web.id
```

---

## Category & Language

**Category**: Productivity  
**Primary Language**: Indonesian (Bahasa Indonesia)  
**Additional Languages**: English (for international users)

---

## Pricing & Distribution

**Pricing Model**: Free with in-app purchases  
**In-App Products**: Premium Subscription  
**Distribution**: Public  
**Regions**: Worldwide (focus on Indonesia)

---

## Developer Information

**Developer Name**: SOAL-AI Team  
**Developer Email**: support@soal-ai.web.id  
**Official Website**: https://app.soal-ai.web.id  
**Privacy Policy URL**: https://app.soal-ai.web.id/privacy  
**Terms of Service URL**: https://app.soal-ai.web.id/terms

---

## Screenshot Recommendations (5 required, 1280x800 px)

1. **Main Feature**: Context menu in action showing "Jawab dengan SOAL-AI"
2. **Answer Display**: Floating window with AI-generated answer
3. **Scan Area**: Screen capture tool selecting question area
4. **Dashboard**: User profile with subscription status
5. **Login Screen**: Clean authentication interface

---

## Review Response Template

If reviewers ask for clarification:

```
Thank you for reviewing SOAL-AI extension.

Regarding [permission/host]:
[Copy relevant justification from above]

We have:
✅ Removed all unused permissions
✅ Verified each permission is actively used in code
✅ Followed minimum permission principle
✅ Complied with Manifest V3 requirements
✅ No development artifacts in production

Code references are available in our PERMISSION_JUSTIFICATIONS.md 
documentation file. We're happy to provide additional clarification 
or make any necessary adjustments.

Best regards,
SOAL-AI Team
```

---

**Quick Tip**: Keep this document open while filling out the Chrome Web Store 
submission form. Simply copy-paste the relevant sections for each field.
