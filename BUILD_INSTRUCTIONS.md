# 🚀 SOAL-AI Extension - Build Instructions

## 📦 Build Information
- **Version**: 2.4.0
- **Build Date**: October 25, 2025
- **Package Size**: ~62 KB (compressed)
- **Manifest Version**: 3

## 📋 Pre-Upload Checklist

### ✅ Completed
- [x] Removed unused permissions (desktopCapture)
- [x] Removed development hosts (localhost, 127.0.0.1)
- [x] Removed legacy API hosts (litellm.bisakerja.id)
- [x] Cleaned up dead code (~559 lines removed)
- [x] Verified all permissions are used
- [x] Verified all host_permissions are used
- [x] Removed .DS_Store files
- [x] Production-ready manifest.json

### 📦 Build Contents
```
soal-ai-extension-v2.4.0.zip (62 KB)
├── manifest.json (1.7 KB)
├── background.js (108 KB → 21 KB compressed)
├── popup.html (22 KB → 4 KB compressed)
├── popup.js (32 KB → 8 KB compressed)
├── api-client.js (9 KB)
├── content-area-selector.js (14 KB)
├── floating-windows.css (8 KB)
├── scan-area-styles.css (9 KB)
├── styles-new.css (35 KB)
└── icons/
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-48.png
    └── icon-128.png
```

## 🔒 Security & Privacy

### Permissions Used (All Verified)
- ✅ `storage` - Local data storage
- ✅ `activeTab` - Content script injection
- ✅ `scripting` - Execute scripts
- ✅ `tabs` - Tab management
- ✅ `contextMenus` - Context menu
- ✅ `notifications` - User notifications
- ✅ `identity` - Google OAuth login

### Host Permissions (All Verified)
- ✅ `https://ekqkwtxpjqqwjovekdqp.supabase.co/*` - Supabase backend
- ✅ `https://soal-ai.web.id/*` - Website links

## 📤 Upload to Chrome Web Store

### Step 1: Login
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Login with developer account

### Step 2: Upload
1. Click "New Item" or select existing extension
2. Upload: `soal-ai-extension-v2.4.0.zip`
3. Fill in store listing information

### Step 3: Store Listing
**Name**: SOAL-AI Asisten Jawab Soal

**Summary** (132 characters max):
```
Asisten AI untuk membantu kamu menjawab soal dengan cepat dan akurat menggunakan teknologi AI terbaru.
```

**Description**:
```
SOAL-AI adalah extension Chrome yang membantu kamu menjawab berbagai jenis soal dengan bantuan AI.

Fitur Utama:
✨ Context Menu - Klik kanan pada soal untuk langsung mendapatkan jawaban
📷 Scan Area - Pilih area layar untuk menganalisis soal
🔐 Secure Authentication - Login dengan email/password atau Google
💳 Free & Premium Plans - 20 soal gratis untuk memulai
🎯 Samar Mode - Mode rahasia untuk privasi maksimal

Cara Menggunakan:
1. Pilih teks soal di halaman web
2. Klik kanan dan pilih "Jawab dengan SOAL-AI"
3. Atau gunakan shortcut Ctrl+Shift+S
4. Dapatkan jawaban lengkap dengan penjelasan

Keyboard Shortcuts:
• Ctrl+Shift+S - Proses teks terpilih
• Ctrl+Shift+A - Aktifkan Scan Area

Privacy & Security:
🔒 Data aman dengan enkripsi
🔒 No tracking, no ads
🔒 Compliance dengan Google policies
```

**Category**: Productivity

**Language**: Indonesian (Bahasa Indonesia)

### Step 4: Privacy
**Single Purpose Description**:
```
SOAL-AI is an AI-powered question answering assistant that helps students solve academic questions quickly using artificial intelligence.
```

**Permission Justifications**:
- `storage`: Store user authentication tokens and preferences
- `activeTab`: Access selected text on active webpage
- `scripting`: Inject content scripts for UI overlay
- `tabs`: Create tabs for authentication and subscription pages
- `contextMenus`: Add context menu for question processing
- `notifications`: Show completion notifications
- `identity`: Google OAuth authentication flow

**Host Permission Justifications**:
- `ekqkwtxpjqqwjovekdqp.supabase.co`: Backend API for authentication and AI processing
- `soal-ai.web.id`: Official website for subscription and documentation

### Step 5: Screenshots
Upload these screenshots (1280x800 or 640x400):
1. Context menu in action
2. Floating window with answer
3. Scan area tool
4. Profile dashboard
5. Login screen

### Step 6: Pricing & Distribution
- **Pricing**: Free (with in-app purchases)
- **Distribution**: Public
- **Countries**: Indonesia (or Worldwide)

## 🔄 Build Script (for future builds)

Create a new build:
```bash
cd /Users/danypratmanto/Documents/GitHub/extension-samar

# Clean and create build directory
rm -rf build
mkdir build

# Copy production files
cp -r icons build/
cp manifest.json background.js popup.html popup.js api-client.js \
   content-area-selector.js floating-windows.css scan-area-styles.css \
   styles-new.css build/

# Remove .DS_Store files
find build -name ".DS_Store" -delete

# Create ZIP
cd build
zip -r ../soal-ai-extension-v2.4.0.zip . -x "*.DS_Store" -x "__MACOSX/*"
cd ..

# Verify
unzip -l soal-ai-extension-v2.4.0.zip
ls -lh soal-ai-extension-v2.4.0.zip
```

## 📝 Version History

### v2.4.0 (Current)
- ✅ Removed unused permissions (desktopCapture)
- ✅ Removed development hosts
- ✅ Cleaned up dead code (~559 lines)
- ✅ Simplified UI (show answered questions only)
- ✅ Removed version numbers from UI
- ✅ Google policy compliance

### Previous Versions
- v2.3.x - Profile improvements
- v2.2.x - Auth system overhaul
- v2.1.x - Supabase migration
- v2.0.x - Complete redesign

## 🐛 Testing Before Upload

1. **Load Unpacked**: Test in Chrome (chrome://extensions/)
2. **Test Authentication**: Email/password + Google login
3. **Test Context Menu**: Select text and process
4. **Test Scan Area**: Ctrl+Shift+A functionality
5. **Test Quota System**: Verify free/premium flow
6. **Test Samar Mode**: Toggle privacy mode
7. **Check Console**: No errors in background/popup

## 📞 Support

- **Website**: https://app.soal-ai.web.id
- **Email**: support@soal-ai.web.id
- **GitHub**: https://github.com/danprat/ext-samar

---

✅ **Ready for Chrome Web Store Upload!**

File: `soal-ai-extension-v2.4.0.zip` (62 KB)
