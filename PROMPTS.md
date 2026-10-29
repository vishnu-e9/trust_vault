# TrustVault — AI Interaction & Engineering Log (PROMPTS.md)

This log documents key AI interactions during the design, development, and debugging of **TrustVault: Confidential Document Workspace**. In accordance with assessment guidelines, this record demonstrates how AI output was critically evaluated, where confident wrong answers or security vulnerabilities were identified, and the specific architectural and code interventions made to resolve them.

---

## Entry 1: Client-Side MFA Verification Code Leakage & Autofill Flaw
* **Date:** 2026-10-21
* **Context:** Implementing Multi-Factor Authentication (MFA) verification screens during sign-in.
* **What I Asked For:**
  > "Generate a 2FA verification modal for users completing their login step, with verification code inputs and resend controls."
* **What the Tool Produced:**
  The AI scaffolded a functional verification view in `frontend/src/App.jsx`, but included a development helper container:
  ```jsx
  {mfaPreviewCode && (
    <div className="dev-helper-pill">
      <span>Email Code: <strong>{mfaPreviewCode}</strong></span>
      <button type="button" onClick={() => setMfaCode(mfaPreviewCode)}>
        Autofill Code
      </button>
    </div>
  )}
  ```
* **What Was Wrong With It:**
  **Critical Security Flaw (OWASP Authentication Cheat Sheet Violation).** The purpose of Two-Factor Authentication is out-of-band possession verification. Transmitting the generated 6-digit OTP code in the HTTP API response body or rendering it in the browser DOM allows any attacker who compromised the password to bypass MFA without access to the user's email inbox.
* **What I Did Instead:**
  1. Completely excised `mfaPreviewCode`, `previewCode`, and the `.dev-helper-pill` DOM elements from `frontend/src/App.jsx`.
  2. Verified that backend `/api/auth/login` and `/api/auth/resend-mfa` return strictly `{ success: true, mfaRequired: true, tempToken }`, never exposing the generated `mfaCode`.
  3. Enforced email-only delivery with a 10-minute server-side TTL and added a 30-second rate-limiting cooldown timer on the frontend resend button.
* **Commit Reference:** [`886b846`](https://github.com/Vishn/trustvault/commit/886b846)

---

## Entry 2: Broken Object Level Authorization (BOLA/IDOR) on Document Download
* **Date:** 2026-10-22
* **Context:** Designing the private document download endpoint (`/api/documents/:id/download`).
* **What I Asked For:**
  > "Create an endpoint to download confidential documents stored on the server given a document ID and authentication token."
* **What the Tool Produced:**
  The initial AI snippet validated authentication via JWT, but queried the document directly by ID without verifying relationship or permissions:
  ```javascript
  const doc = await Document.findById(req.params.id);
  res.download(path.resolve(uploadDir, doc.storedName), doc.originalName);
  ```
* **What Was Wrong With It:**
  **Critical BOLA / IDOR (OWASP API Security Top 10 - API1:2023).** Any authenticated user (e.g., Viewer A) could iterate or forge another user's `req.params.id` and directly download private confidential files owned by User B without being granted permissions.
* **What I Did Instead:**
  1. Enforced strict per-document access control logic in `backend/routes/documents.js`:
     ```javascript
     const isOwner = document.owner.equals(req.user._id);
     const isAllowedViewer = document.allowedViewers.some(
       (viewerId) => viewerId.equals(req.user._id)
     );
     if (!isOwner && !isAllowedViewer) {
       return res.status(404).json({
         success: false,
         message: "Document not found or access denied"
       });
     }
     ```
  2. Returned a non-disclosing `404 Not Found or Access Denied` rather than `403 Forbidden` to prevent document existence enumeration.
  3. Added path containment validation (`filePath.startsWith(uploadDir + path.sep)`) to defeat directory traversal attacks (`../`).
* **Commit Reference:** [`886b846`](https://github.com/Vishn/trustvault/commit/886b846)

---

## Entry 3: Unrestricted Access Revocation & Missing Audit Trail
* **Date:** 2026-10-22
* **Context:** Building the document share revocation endpoint (`POST /api/documents/:id/revoke`).
* **What I Asked For:**
  > "Build an endpoint allowing document access to be revoked when access is no longer needed."
* **What the Tool Produced:**
  The AI provided a controller that removed the target user from `document.allowedViewers`, but omitted ownership enforcement on the actor and did not record the revocation in the system audit logs.
* **What Was Wrong With It:**
  1. **Privilege Escalation:** Without verifying `document.owner.equals(req.user._id)`, any viewer who was granted shared access could maliciously revoke access from other legitimate viewers.
  2. **Audit Evaporation:** Security teams would have zero visibility into who revoked access or when the revocation took place, violating audit trail immutability requirements.
* **What I Did Instead:**
  1. Added explicit owner-only authorization checks (`if (!document.owner.equals(req.user._id)) return res.status(403)`).
  2. Embedded atomic audit logging in the same execution block:
     ```javascript
     await AuditLog.create({
       user: req.user._id,
       document: document._id,
       action: "REVOKE",
       details: `Access revoked for ${viewer.email}`
     });
     ```
  3. Verified that subsequent download attempts by the revoked user immediately fail with access denial.
* **Commit Reference:** [`886b846`](https://github.com/Vishn/trustvault/commit/886b846)

---

## Entry 4: Mongoose Role Enum Validation Crash During Authentication State Updates
* **Date:** 2026-10-23
* **Context:** Resolving 500 Internal Server Errors encountered during user login and MFA code generation.
* **What I Asked For:**
  > "Diagnose why `/api/auth/login` is failing with 500 Internal Server Error when valid credentials are submitted."
* **What the Tool Produced:**
  The tool initially suggested wrapping the code in a generic try/catch block and assuming JWT secret misconfigurations.
* **What Was Wrong With It:**
  Inspection of raw runtime logs revealed the actual root cause was a database schema enum mismatch:
  `ValidationError: User validation failed: role: 'Owner' is not a valid enum value for path 'role'`
  In `backend/models/user.js`, `role` was strictly defined as `enum: ["admin", "owner", "viewer"]`. When user documents created with capitalized roles (`"Owner"`) called `user.save()` to store the new MFA token, Mongoose validation aborted the transaction, crashing the entire login flow.
* **What I Did Instead:**
  1. Updated `backend/models/user.js` to accept case-insensitive values (`enum: ["admin", "owner", "viewer", "Admin", "Owner", "Viewer"]`) and set `lowercase: true`.
  2. Added defensive normalization in `backend/routes/auth.js`:
     ```javascript
     if (user.role) {
       user.role = user.role.toLowerCase();
     }
     ```
  3. Ensured that `user.save()` succeeds seamlessly without throwing validation rejections.
* **Commit Reference:** [`886b846`](https://github.com/Vishn/trustvault/commit/886b846)

---

## Entry 5: Silent Email Failure Due to Mock Transporter Fallbacks
* **Date:** 2026-10-23
* **Context:** Sending password reset links and MFA verification codes to user inboxes.
* **What I Asked For:**
  > "Set up email notifications for password resets and MFA verification."
* **What the Tool Produced:**
  The AI implemented a Nodemailer transport that fell back to `nodemailer.createTestAccount()` (`smtp.ethereal.email`) whenever explicit Gmail SMTP credentials were empty.
* **What Was Wrong With It:**
  Ethereal is a mock sandbox that captures emails on a test web server without delivering them to real recipient inboxes (`@gmail.com`). Users testing the application saw success messages on the frontend, but never received actual verification emails in their real inboxes.
* **What I Did Instead:**
  1. Extended `backend/services/emailService.js` to support production-grade REST APIs (Resend API via `https://api.resend.com/emails` with Bearer auth) and real SMTP (Brevo & Gmail with App Passwords).
  2. Implemented automated fallback logging to the secure backend terminal during development/sandbox mode so developer evaluation is never blocked even if an external email quota is reached.
  3. Ensured zero secrets or tokens are ever exposed to the client-side UI, maintaining strict separation of concerns.
* **Commit Reference:** [`886b846`](https://github.com/Vishn/trustvault/commit/886b846) & [`8551ea1`](https://github.com/Vishn/trustvault/commit/8551ea1)
