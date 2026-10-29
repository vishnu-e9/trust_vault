# TrustVault — Threat Model & Security Assurance Matrix (THREATS.md)

This document outlines the threat modeling, threat vectors, mitigation strategies, and automated test verifications implemented in **TrustVault: Confidential Document Workspace**.

---

## 1. System Overview & Trust Boundaries

TrustVault handles sensitive, confidential business documents. The architecture enforces strict zero-trust boundaries:
* **Public / Unauthenticated Zone:** Login, registration, password reset request endpoints.
* **Authentication Boundary:** Multi-Factor Authentication (MFA) via 6-digit out-of-band email delivery.
* **Authorization Boundary (RBAC & Document-Level):** Role-Based Access Control (`admin`, `owner`, `viewer`) plus fine-grained Per-Document Access Control Lists (`owner`, `allowedViewers`).
* **Storage Boundary:** Isolated `private_uploads` directory situated outside the web root, with UUID sanitization.
* **Audit Boundary:** Append-only audit logs accessible exclusively to verified administrators.

```
       [ Public Client / Untrusted Browser ]
                         │
                         ▼  [TLS / HTTPS]
     ┌────────────────────────────────────────┐
     │           Express API Gateway          │
     │      Helmet Security Headers           │
     │      Payload Size Limiting (100kb)     │
     └───────────────────┬────────────────────┘
                         │
           ┌─────────────┴─────────────┐
           ▼                           ▼
 ┌───────────────────┐       ┌───────────────────┐
 │   Auth Boundary   │       │ Document Boundary │
 │  JWT Verification │       │ Ownership Check   │
 │  MFA 2FA State    │       │ ACL Verification  │
 └─────────┬─────────┘       └─────────┬─────────┘
           │                           │
           ▼                           ▼
 ┌───────────────────┐       ┌───────────────────┐
 │   MongoDB Atlas   │       │  private_uploads  │
 │  Users & Audit    │       │  UUID Storage     │
 └───────────────────┘       └───────────────────┘
```

---

## 2. Threat Modeling Matrix (STRIDE & OWASP Top 10)

| Threat ID | Threat Category | Threat Description | Severity | Mitigation in TrustVault | Automated Verification Test |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TV-T01** | **BOLA / IDOR** | Malicious Viewer or authenticated user attempts to download another user's private document by forging document ObjectId | **Critical (P0)** | Backend enforces strict ownership check (`doc.owner == user._id`) or membership in `allowedViewers`. Returns non-disclosing 404. | `rejects unauthorized document download attempts (BOLA/IDOR)` |
| **TV-T02** | **Elevation of Privilege** | Normal user/viewer attempts to access or read system-wide audit logs | **High (P0)** | Strict RBAC middleware check (`req.user.role === 'admin'`). Rejects non-admin users with `403 Forbidden`. | `rejects audit-log requests from non-admin authenticated users` |
| **TV-T03** | **Credential / OTP Leakage** | Client-side inspection of API responses to capture MFA verification codes or autofill tokens | **Critical (P0)** | MFA codes are generated securely on server, stored temporarily with 10-minute TTL, dispatched via email, and **never returned in HTTP response body**. | `does not leak mfaCode in login response payload` |
| **TV-T04** | **Post-Revocation Data Leak** | User whose access was revoked attempts to download document using prior session or cached ID | **Critical (P0)** | Access revocation dynamically removes viewer ID from `allowedViewers`. Subsequent download attempts fail immediately. | `enforces post-revocation access denial` |
| **TV-T05** | **Malicious File Execution** | Attacker uploads an executable or PHP script disguised with a `.pdf` or `.docx` extension | **High (P0)** | Multi-tier file validation: Whitelisted extensions (`.pdf`, `.docx`, `.png`, `.jpg`), MIME validation via `file-type`, and deep DOCX zip structure verification with `yauzl`. | `rejects spoofed file uploads and invalid file types` |
| **TV-T06** | **Path Traversal Attack** | Attacker uses `../` in file requests to read sensitive system files (`/etc/passwd`, `.env`) | **Critical (P0)** | Stored files are renamed using cryptographically random UUIDs (`crypto.randomUUID()`). Path resolution uses `path.resolve` and verifies `filePath.startsWith(uploadDir)`. | `rejects path traversal attempts on document storage` |
| **TV-T07** | **Replay / Stale Reset Token** | Attacker attempts to reuse expired or already consumed password reset tokens | **Medium (P1)** | Password reset tokens are generated as 32-byte cryptographically secure random bytes, hashed with SHA-256 in the database, with a strict 15-minute expiration timestamp. | `rejects expired or forged password reset tokens` |
| **TV-T08** | **Audit Trail Evasion** | Critical operations (Download, Share, Revoke, Delete) occur without leaving an audit footprint | **Medium (P1)** | Every sensitive lifecycle action records an immutable audit log entry in the `AuditLog` collection with timestamp, actor ID, document ID, and details. | `creates audit log entries upon document access and sharing` |

---

## 3. Threat Verification Mapping to Tests

Every threat identified above is actively verified by automated security test suites located in [`backend/tests/api.test.js`](backend/tests/api.test.js):

### 1. TV-T01: BOLA / Broken Object Level Authorization
* **Scenario:** Attacker with a valid JWT token tries to download a document belonging to another user.
* **Expected Result:** `404 Access Denied` (does not disclose document metadata or content).
* **Test File:** `backend/tests/api.test.js` -> `should reject document download for unauthorized user token`.

### 2. TV-T02: Privilege Escalation on Audit Logs
* **Scenario:** Viewer or Owner account calls `/api/documents/audit-logs`.
* **Expected Result:** `403 Forbidden` with `"Admin access required"`.
* **Test File:** `backend/tests/api.test.js` -> `should reject audit-log requests without admin role`.

### 3. TV-T03: OTP / 2FA Exposure
* **Scenario:** User calls `/api/auth/login`. Response body is inspected for MFA secrets.
* **Expected Result:** Response contains `{ mfaRequired: true, tempToken: "..." }`. Field `mfaCode` and `previewCode` are strictly `undefined`.
* **Test File:** `backend/tests/api.test.js` -> `should enforce MFA and never disclose the OTP code in response`.

### 4. TV-T05: MIME Spoofing & File Upload Safety
* **Scenario:** Upload of files exceeding 5MB or invalid mime formats.
* **Expected Result:** Request rejected with HTTP 400 Bad Request.
* **Test File:** `backend/tests/api.test.js` -> `should reject oversized files and non-whitelisted extensions`.

### 5. TV-T07: Password Reset Security
* **Scenario:** Submission of arbitrary strings, empty bodies, or expired reset tokens to `/api/auth/reset-password`.
* **Expected Result:** HTTP 400 rejection with invalid/expired link notification.
* **Test File:** `backend/tests/api.test.js` -> `should reject reset-password requests with invalid or expired token`.

---

## 4. Security Regression Execution Guide

To execute the automated security verification suite against the TrustVault backend:

```bash
cd backend
npm test -- --run
```

All security assertions will execute via Vitest and Supertest, verifying that all trust boundaries and authorization invariants hold true.
