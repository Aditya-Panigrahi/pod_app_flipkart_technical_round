# POD App - Proof of Delivery

A Progressive Web Application for logistics delivery drivers to scan AWB numbers and capture delivery proof.

## 🚀 Quick Start

> **Note**: Commands are for PowerShell on Windows. For Bash/Linux, you can use `npm install && npm start`

### Option 1: Manual Setup
```powershell
# Terminal 1: Frontend Server
cd "c:\Projects\Testing\POD app"
python -m http.server 8000

# Terminal 2: Backend Server  
cd "c:\Projects\Testing\POD app\backend"
npm install
npm start
```

### Option 2: Using npm scripts (Alternative)
```powershell
# Setup backend dependencies (one-time)
npm run setup

# Terminal 1: Frontend
npm start

# Terminal 2: Backend
npm run backend
```

**Access:** http://localhost:8000

## ✨ Features

- 📱 Progressive Web App (works on mobile and desktop)
- 📷 Camera-based barcode/QR code scanning
- 📸 Photo and video capture for proof of delivery
- 💾 Offline support with local storage
- 🔄 Service worker for caching

## 🏗️ Project Structure

```
POD app/
├── src/                    # Source code
│   ├── js/app.js          # Main application logic
│   ├── css/styles.css     # Stylesheets
│   └── assets/            # Images, icons
├── public/                 # PWA assets
│   ├── manifest.json      # PWA manifest
│   └── sw.js              # Service worker
├── backend/                # API server
├── docs/                   # Documentation
└── index.html             # Entry point
```

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Scanning:** QuaggaJS for barcode detection
- **Storage:** LocalStorage (S3 integration planned for v2.0)
- **Backend:** Node.js/Express
- **PWA:** Service Worker, Web App Manifest

## 📖 Documentation

- [Version History](./docs/CHANGELOG.md)
- [Project Structure Details](./STRUCTURE.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

## 🧪 Testing

1. **Start servers** (see Quick Start above)
2. **Open app** at http://localhost:8000
3. **Test workflow:**
   - Click "Start Scanning"
   - Allow camera permissions
   - Scan barcode or use "Manual Entry"
   - Capture photo/video
   - Save offline (S3 not configured)

## 📋 Current Status

**Version 1.0.0** - Local storage implementation
- ✅ All core features working
- ✅ Offline-first approach
- ⏳ S3 integration planned for v2.0
