# 🤖 SOAL-AI Asisten Jawab Soal

> Chrome Extension pintar untuk membantu menjawab soal dengan AI

[![Version](https://img.shields.io/badge/version-2.3.3-blue.svg)](https://github.com/danprat/ext-samar)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome](https://img.shields.io/badge/chrome-extension-orange.svg)](https://chrome.google.com/webstore)

## 📋 Deskripsi

SOAL-AI adalah Chrome Extension yang menggunakan kecerdasan buatan (AI) untuk membantu menjawab soal-soal ujian, kuis, atau tugas. Extension ini dilengkapi dengan fitur scan area layar dan pemrosesan teks yang dipilih.

### ✨ Fitur Utama

- 🔍 **Scan Area Tool** - Pilih area layar yang berisi soal
- 📝 **Text Selection** - Pilih teks soal dan dapatkan jawaban
- 👁️ **Samar Mode** - Mode privasi untuk menyembunyikan jawaban
- 📚 **History** - Simpan riwayat soal dan jawaban
- 🎯 **Quick Actions** - Akses cepat melalui context menu
- ⌨️ **Keyboard Shortcuts** - Shortcut untuk akses lebih cepat

---

## 🚀 Instalasi

### Cara 1: Dari Chrome Web Store (Recommended)
```
Coming soon...
```

### Cara 2: Manual Installation (Development)

1. **Clone repository**
   ```bash
   git clone https://github.com/danprat/ext-samar.git
   cd ext-samar
   ```

2. **Buka Chrome Extensions**
   - Buka Chrome browser
   - Ketik `chrome://extensions/` di address bar
   - Atau Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle "Developer mode" di pojok kanan atas

4. **Load Extension**
   - Klik "Load unpacked"
   - Pilih folder `ext-samar`
   - Extension siap digunakan! 🎉

---

## 🎯 Cara Penggunaan

### 1. Login

1. Klik icon SOAL-AI di toolbar Chrome
2. Login dengan Email & Password atau Google
3. Belum punya akun? [Daftar disini](https://app.soal-ai.web.id/auth/signup)

### 2. Scan Area (Recommended)

**Untuk soal dalam bentuk gambar atau screenshot:**

1. Tekan `Ctrl+Shift+A` (Windows) atau `Cmd+Shift+A` (Mac)
2. Klik tombol "Scan Area" di popup
3. Pilih area layar yang berisi soal
4. Tunggu beberapa detik
5. Jawaban akan muncul di floating window! ✅

### 3. Text Selection

**Untuk soal dalam bentuk teks:**

1. Pilih/select teks soal di halaman web
2. Klik kanan → **"Proses dengan SOAL-AI"**
   - Atau tekan `Ctrl+Shift+S` (Windows)
   - Atau tekan `Cmd+Shift+S` (Mac)
3. Jawaban akan muncul di floating window! ✅

### 4. Samar Mode (Privacy)

Sembunyikan jawaban dari pandangan orang lain:

1. Klik icon 👁️ **Samar** di popup dashboard
2. Jawaban akan ter-blur
3. Hover mouse untuk melihat jawaban
4. Klik lagi untuk disable

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Windows/Linux | Mac | Fungsi |
|----------|--------------|-----|--------|
| **Scan Area** | `Ctrl+Shift+A` | `Cmd+Shift+A` | Aktifkan Scan Area Tool |
| **Process Text** | `Ctrl+Shift+S` | `Cmd+Shift+S` | Proses teks yang dipilih |

> 💡 **Tip:** Shortcut bisa diubah di `chrome://extensions/shortcuts`

---

## 💎 Subscription Plans

### 🆓 FREE Plan
- ✅ 20 soal gratis (total)
- ✅ Fitur Scan Area
- ✅ Fitur Text Selection
- ✅ History soal & jawaban
- ❌ Unlimited questions

### 👑 PREMIUM Plan
- ✅ **Unlimited soal** (tanpa batas)
- ✅ Semua fitur FREE
- ✅ Priority support
- ✅ Akses ke model AI terbaru
- 💰 [Upgrade sekarang](https://app.soal-ai.web.id/pricing)

---

## 🔧 Teknologi

### Frontend
- **Vanilla JavaScript** - Core logic
- **Chrome Extension API** - Manifest V3
- **CSS3** - Modern styling dengan gradients & animations

### Backend (Supabase)
- **Supabase Auth** - User authentication
- **Supabase Storage** - Image storage untuk screenshots
- **Supabase Database** - PostgreSQL untuk users & history
- **Edge Functions** - Serverless functions untuk AI processing

### AI Integration
- **LiteLLM API** - Multi-model AI proxy
- **Groq** - Fast inference untuk text questions
- **Gemini Flash Lite** - Vision model untuk screenshot OCR

---

## 📁 Struktur Project

```
ext-samar/
├── manifest.json              # Chrome extension manifest
├── popup.html                 # Popup dashboard UI
├── popup.js                   # Popup logic & UI handlers
├── background.js              # Service worker & API handlers
├── api-client.js              # Supabase API client
├── content-area-selector.js   # Scan area tool logic
├── styles-new.css             # Modern UI styles
├── floating-windows.css       # Floating answer window styles
├── scan-area-styles.css       # Scan area overlay styles
├── icons/                     # Extension icons
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md                  # This file
```

---

## 🔐 Security & Privacy

### Data Security
- ✅ Semua komunikasi menggunakan HTTPS
- ✅ Token autentikasi tersimpan di Chrome local storage (encrypted)
- ✅ Screenshot hanya diupload saat proses scan area
- ✅ Data tidak dibagikan ke pihak ketiga

### Privacy Features
- 🔒 **Samar Mode** - Blur jawaban untuk privasi
- 🗑️ **History Management** - User bisa hapus history kapan saja
- 👁️ **No Tracking** - Tidak ada analytics atau tracking external

---

## 🐛 Troubleshooting

### Extension tidak muncul
```bash
1. Pastikan extension sudah di-enable di chrome://extensions/
2. Refresh halaman web (F5)
3. Restart Chrome browser
```

### Scan Area tidak bekerja
```bash
1. Pastikan sudah login
2. Check quota: FREE users = 20 soal total
3. Pastikan tidak ada extension lain yang konflik
4. Try reload extension
```

### Login error "Unauthorized"
```bash
1. Pastikan email & password benar
2. Check internet connection
3. Try logout dan login ulang
4. Clear browser cache
```

### CSS tidak load / UI tampak rusak
```bash
1. Hard refresh: Ctrl+Shift+R (Windows) atau Cmd+Shift+R (Mac)
2. Reload extension di chrome://extensions/
3. Clear Chrome cache
```

### Subscription expired tapi tidak bisa pakai
```bash
KNOWN ISSUE: Jika usage_count > 20 saat subscription expired, 
user akan terblock sampai subscribe lagi atau admin reset usage_count.

Solusi sementara: Contact admin untuk reset quota.
```

---

## 🛠️ Development

### Setup Development Environment

1. **Clone & Install**
   ```bash
   git clone https://github.com/danprat/ext-samar.git
   cd ext-samar
   # No npm install needed (vanilla JS)
   ```

2. **Load Extension**
   - Buka `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select project folder

3. **Development Workflow**
   ```bash
   # Edit code
   # Reload extension (click reload icon di chrome://extensions/)
   # Test changes
   ```

### Testing

```bash
# Manual testing checklist
- [ ] Login dengan email/password
- [ ] Login dengan Google
- [ ] Scan area functionality
- [ ] Text selection processing
- [ ] Samar mode toggle
- [ ] Keyboard shortcuts
- [ ] History save & display
- [ ] Logout functionality
- [ ] Quota limits (FREE vs PREMIUM)
```

### API Endpoints (Supabase Edge Functions)

```javascript
// Production
const API_BASE = 'https://ekqkwtxpjqqwjovekdqp.supabase.co/functions/v1';

// Endpoints
POST /process-text-question      // Process text questions
POST /process-screenshot-question // Process scan area screenshots
GET  /auth-me                     // Get current user info
POST /auth-send-magic-link        // Send magic link (legacy)
POST /auth-verify-otp             // Verify OTP (legacy)
```

---

## 📝 Known Issues & Limitations

### Subscription Logic Bug (CRITICAL)
**Issue:** User dengan expired subscription dan `usage_count > 20` akan ter-block total.

**Explanation:**
- Premium user menggunakan 100 soal → `usage_count = 100`
- Subscription expired → `isPremium = false`
- System check: `usage_count (100) >= FREE_QUOTA_LIMIT (20)`
- Result: User **BLOCKED** completely ❌

**Workaround:**
- Admin manual reset `usage_count` di database
- User subscribe lagi untuk unlimited access

**Fix Required:**
- Add separate `free_usage_count` counter
- Reset free counter when downgrade from premium
- Or implement time-based reset (daily/monthly)

### Other Limitations
- Scan area hanya work di tab aktif
- Screenshot size limit: ~5MB
- FREE users: 20 soal total (tidak reset)
- Processing time: 3-10 detik tergantung AI model

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### Coding Standards
- Use **vanilla JavaScript** (no frameworks)
- Follow existing code style
- Add comments untuk logic yang complex
- Test semua changes sebelum PR

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Dany Pratmanto**
- GitHub: [@danprat](https://github.com/danprat)
- Email: danybms@gmail.com

---

## 🔗 Links

- 🌐 **Website**: [https://app.soal-ai.web.id](https://app.soal-ai.web.id)
- 📚 **Petunjuk**: [https://app.soal-ai.web.id/extension-guide](https://app.soal-ai.web.id/extension-guide)
- 💰 **Pricing**: [https://app.soal-ai.web.id/pricing](https://app.soal-ai.web.id/pricing)
- 🆕 **Sign Up**: [https://app.soal-ai.web.id/auth/signup](https://app.soal-ai.web.id/auth/signup)

---

## 📞 Support

Butuh bantuan? Hubungi kami:

- 📧 Email: support@soal-ai.web.id
- 💬 Website: [app.soal-ai.web.id](https://app.soal-ai.web.id)
- 🐛 Bug Report: [GitHub Issues](https://github.com/danprat/ext-samar/issues)

---

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) - Backend as a Service
- [LiteLLM](https://litellm.ai) - AI Model Proxy
- [Groq](https://groq.com) - Fast AI Inference
- [Google Gemini](https://ai.google.dev) - Vision AI Model

---

<div align="center">

**Made with ❤️ by Dany Pratmanto**

⭐ Star repository ini jika membantu! ⭐

</div>
