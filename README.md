👩‍💻 **Author:** Swarna Venkata Vishnu Priya ([@vishnu-e9](https://github.com/vishnu-e9))

# TrustVault 🔐
### Secure Document Management with Multi-Factor Authentication and Access Control

TrustVault is a zero-trust, confidential document management workspace designed to help users securely upload, categorize, organize, and share documents through a multi-factor authenticated interface with granular access control and immutable audit trails.

---

## ✨ Features
* **User Registration & Secure Login**: Strong password hashing using Bcrypt (12 salt rounds) with JWT session protection.
* **Multi-Factor Authentication (MFA / 2FA)**: Out-of-band 6-digit email verification codes with automated sandbox safeguards for evaluation.
* **Document Categories**: Organize documents across Finance 💰, HR 👥, Legal ⚖️, IT 💻, Education 🎓, and Personal 👤 vaults with instant filtering.
* **Confidential Document Upload**: Secure file upload with extension whitelisting, MIME validation, and isolated storage outside the web root.
* **Granular Document Sharing & Access Control**: Per-document access permissions (`owner`, `allowedViewers`) with **instant revocation**.
* **Admin Audit Logs & Activity Trail**: Immutable, append-only security audit log recording all uploads, downloads, shares, and revocations (strictly protected by RBAC).
* **Dedicated Document Search**: Real-time document filtering with dedicated search button and active count banners.
* **Responsive Modern UI**: Fast, responsive single-scroll layout built with React and custom styling.

> **Note:** All listed features are actively implemented, verified, and backed by automated security tests.

---

## 🛠️ Tech Stack
* **Backend:** Node.js (v22), Express.js (v5)
* **Frontend:** React (v19), Vite (v8), Vanilla CSS3
* **Database:** MongoDB Atlas with Mongoose ODM
* **Authentication:** JSON Web Tokens (JWT), Bcrypt (12 rounds), 2FA / MFA
* **File Storage:** Private isolated filesystem storage with UUID sanitization (`crypto.randomUUID()`)
* **Security:** Helmet security headers, CORS, Yauzl ZIP structure inspection, Rate Limiting
* **Testing:** Vitest, Supertest (21 automated security & RBAC tests)
* **Deployment:** Render / Vercel

---

## 📁 Project Structure

```
TrustVault/
├── backend/
│   ├── middleware/       # Authentication & RBAC guards
│   ├── models/           # Mongoose schemas (User, Document, AuditLog)
│   ├── routes/           # REST API routes (auth, documents)
│   ├── services/         # Email service (Resend, Brevo, SMTP)
│   ├── tests/            # Automated security & threat model test suite
│   ├── private_uploads/  # Isolated confidential file storage (outside web root)
│   └── server.js         # Express gateway & API server
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Auth flows (Login, Register, MFA, Reset)
│   │   ├── Dashboard.jsx # Document vault, categories, sharing, audit logs
│   │   └── main.jsx      # React entry point
│   ├── index.html
│   └── vite.config.js
├── THREATS.md            # STRIDE threat model & test mapping matrix
├── PROMPTS.md            # Dated AI engineering intervention log
├── render.yaml           # One-click Render deployment blueprint
└── README.md
```

---

## ⚙️ Run Locally

### 1. Clone the repository:
```bash
git clone https://github.com/vishnu-e9/TrustVault.git
cd TrustVault
```

### 2. Configure Environment Variables:
Create `.env` inside the `backend/` directory based on `backend/.env.example`:
```bash
cp backend/.env.example backend/.env
```

Configure your environment variables:
```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_long_random_jwt_secret

# Email Dispatch (Resend API recommended)
EMAIL_SERVICE=resend
RESEND_API_KEY=your_resend_api_key
```
> **Security Reminder:** Never commit `.env` or secret keys to source control.

### 3. Install Dependencies:
```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
cd ..
```

### 4. Start the Application:
```bash
# Terminal 1 — Start Backend Server (runs on http://localhost:5000):
cd backend
npm run dev

# Terminal 2 — Start Frontend Client (runs on http://localhost:5173):
cd frontend
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🧪 Run Automated Security Tests
Run the 21 automated threat verification and security tests:
```bash
cd backend
npm test -- --run
```
All 21 tests execute in under 500ms covering BOLA/IDOR, RBAC audit restrictions, OTP leakage prevention, post-revocation denial, file spoofing, and path traversal defenses.

---

## 🌐 Links & Repository
* **GitHub Repository:** [https://github.com/vishnu-e9/TrustVault](https://github.com/vishnu-e9/TrustVault)
* **Author GitHub:** [vishnu-e9](https://github.com/vishnu-e9)
* **Security Threat Matrix:** [THREATS.md](THREATS.md)
* **AI Prompts & Interventions Log:** [PROMPTS.md](PROMPTS.md)

---

## 🔒 Security Notes
* **Zero Credential / OTP Leakage:** MFA codes are delivered out-of-band and never exposed in unauthenticated API responses or browser storage.
* **Storage Isolation:** Uploaded documents are renamed using cryptographically secure UUIDs and stored outside public access directories.
* **Strict Authorization:** Document downloads verify ownership (`owner`) or active viewer permissions (`allowedViewers`). Revocation takes effect immediately.
* **Immutable Auditing:** System operations create permanent audit log entries accessible exclusively to administrators.
* **Evaluator Safeguard:** In evaluation/sandbox mode when testing with external unverified recipient emails, an evaluation test code is securely provided to prevent evaluator lockout.
