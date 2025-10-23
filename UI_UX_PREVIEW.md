# UI/UX Preview - New Login Screen

## 🎨 Login Screen Design

### Header Section
```
┌─────────────────────────────────────┐
│  🤖 SOAL-AI                    v2.0 │
│  AI Assistant untuk Menjawab Soal  │
└─────────────────────────────────────┘
```
- Background: Purple gradient (#667eea → #764ba2)
- Text: White, semi-bold
- Border radius: Rounded bottom corners

### Login Form
```
┌─────────────────────────────────────┐
│                                     │
│  📧  [Email________________]       │
│                                     │
│  🔐  [Password____________] 👁️    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │         Masuk               │   │
│  └─────────────────────────────┘   │
│                                     │
│           ---- atau ----            │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  G  Login dengan Google     │   │
│  └─────────────────────────────┘   │
│                                     │
│  Belum punya akun?                  │
│  [Daftar disini]                    │
│                                     │
│  📚 Petunjuk Penggunaan             │
│                                     │
└─────────────────────────────────────┘
```

## 🎯 Key Features

### 1. Email Input
- Icon: 📧 (positioned left)
- Placeholder: "Email"
- Border: 2px solid #e5e7eb
- Focus state: Purple border with shadow
- Padding: 12px with 40px left for icon

### 2. Password Input
- Icon: 🔐 (positioned left)
- Toggle button: 👁️ (positioned right)
- Placeholder: "Password"
- Type toggle: text ↔ password
- Same styling as email input

### 3. Login Button
- Text: "Masuk"
- Background: Purple gradient
- Color: White
- Hover: Slight lift + shadow
- Loading: Spinner animation

### 4. Google Login Button
- Icon: Google logo (SVG)
- Text: "Login dengan Google"
- Background: White
- Border: 2px solid #e5e7eb
- Hover: Light gray background + shadow

### 5. Register Link
- Text: "Belum punya akun? Daftar disini"
- Link color: Purple (#667eea)
- Hover: Underline + darker purple
- Opens: https://app.soal-ai.web.id/auth/signup

### 6. Guide Button
- Icon: 📚
- Text: "Petunjuk Penggunaan"
- Background: Light gray
- Border: 1px solid #e2e8f0
- Opens: https://app.soal-ai.web.id/extension-guide

## 🎭 Interactive States

### Input States
```css
Default:  border-color: #e5e7eb
Focus:    border-color: #667eea
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1)
Disabled: background: #f3f4f6
          opacity: 0.6
```

### Button States
```css
Default:  background: gradient
Hover:    transform: translateY(-1px)
          box-shadow: larger
Active:   transform: translateY(0)
Disabled: opacity: 0.6
          cursor: not-allowed
```

### Password Toggle
```css
Default:  opacity: 0.6
Hover:    opacity: 1
          background: rgba(102, 126, 234, 0.1)
Active:   scale: 0.95
```

## 📱 Responsive Design

### Dimensions
- Width: 320px (fixed)
- Min-height: 480px
- Padding: 16px sides
- Gap between elements: 12px

### Breakpoints
- Works perfectly at 320px width
- Auto-scrolling for overflow content
- Touch-friendly (min 44px tap targets)

## 🎨 Color Palette

### Primary Colors
```
Purple Gradient:  #667eea → #764ba2
Purple Link:      #667eea
Purple Hover:     #764ba2
Purple Dark:      #5a4c9f
```

### Semantic Colors
```
Success:  #16a34a (green)
Error:    #dc2626 (red)
Info:     #2563eb (blue)
```

### Neutral Colors
```
Text Primary:    #1a1a1a
Text Secondary:  #6b7280
Border:          #e5e7eb
Border Dark:     #d1d5db
Background:      #ffffff
Gray Light:      #f3f4f6
```

## 🚀 Animations

### Alert Animations
```css
slideInDown:  0.3s ease
  from: opacity 0, translateY(-20px)
  to:   opacity 1, translateY(0)

slideOutUp:   0.3s ease
  from: opacity 1, translateY(0)
  to:   opacity 0, translateY(-20px)
```

### Button Animations
```css
hover:  all 0.2s ease
active: all 0.2s ease
```

### Input Animations
```css
focus:  all 0.2s ease
```

## 📊 Layout Structure

```
┌─────────────────────────────────────┐
│                                     │
│  ┌─────────────────────────────┐   │
│  │     HEADER (Gradient)       │   │
│  │  Logo + Title + Subtitle    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │     LOGIN CONTENT           │   │
│  │                             │   │
│  │  • Email Input              │   │
│  │  • Password Input           │   │
│  │  • Login Button             │   │
│  │  • Divider                  │   │
│  │  • Google Button            │   │
│  │  • Register Link            │   │
│  │  • Guide Button             │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

## ✨ Accessibility Features

1. **Keyboard Navigation**
   - Tab order: Email → Password → Toggle → Login → Google → Register → Guide
   - Enter key submits form
   - Escape closes popup

2. **Screen Reader Support**
   - aria-label for toggle button: "Show password"
   - Proper input labels
   - Error announcements

3. **Visual Feedback**
   - Clear focus indicators
   - High contrast text
   - Large tap targets (min 44px)

4. **Loading States**
   - Disabled inputs during loading
   - Spinner animation
   - Button text changes

## 🎯 User Flow

```
1. User opens popup
   ↓
2. Login screen appears
   ↓
3. User enters email
   ↓
4. User enters password
   ↓
5. Optional: Toggle password visibility
   ↓
6. Click "Masuk" or press Enter
   ↓
7. Loading state shown
   ↓
8. Success: Redirect to dashboard
   OR
   Error: Show error alert
```

## 💡 Best Practices Applied

1. ✅ Mobile-first design
2. ✅ Touch-friendly UI
3. ✅ Clear visual hierarchy
4. ✅ Consistent spacing
5. ✅ Smooth animations
6. ✅ Proper focus states
7. ✅ Error handling
8. ✅ Loading indicators
9. ✅ Semantic HTML
10. ✅ Modern CSS practices

---

**Design Inspiration:**
- Tailwind CSS design system
- Material Design principles
- Modern SaaS login pages
- Context7 documentation patterns
