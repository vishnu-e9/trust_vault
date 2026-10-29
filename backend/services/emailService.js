const nodemailer = require("nodemailer");

/**
 * TrustVault Email Service
 * Sends real emails to user inboxes for Password Resets and MFA Verification Codes.
 * Supports: Brevo API / SMTP (Recommended), Gmail SMTP, and Custom SMTP.
 */
class EmailService {
  /**
   * Check if real SMTP, Brevo, or Gmail credentials are configured
   */
  static isRealConfigured() {
    const emailUser = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
    const emailPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.RESEND_API_KEY || "").trim();
    const smtpHost = (process.env.SMTP_HOST || "").trim();
    const emailService = (process.env.EMAIL_SERVICE || "").trim().toLowerCase();

    return Boolean(
      (emailService === "brevo" && emailPass) ||
      (emailUser && emailPass) ||
      (smtpHost && emailPass) ||
      emailPass.startsWith("xkeysib-") ||
      emailPass.startsWith("xsmtpsib-") ||
      emailPass.startsWith("re_")
    );
  }

  /**
   * Send email using Brevo REST API directly
   * (Works with Brevo API Keys starting with xkeysib- as well as SMTP keys)
   */
  static async sendViaBrevoApi(toEmail, subject, htmlContent) {
    let apiKey = (process.env.SMTP_PASS || process.env.EMAIL_PASS || "").trim();
    apiKey = apiKey.replace(/^["']|["']$/g, "").replace(/;$/, "").trim();

    let senderEmail = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
    senderEmail = senderEmail.replace(/^["']|["']$/g, "").replace(/;$/, "").trim() || "security@trustvault.com";

    if (!apiKey) {
      console.warn("⚠️ Brevo API: No API key found in SMTP_PASS or EMAIL_PASS");
      return { sent: false };
    }

    console.log(`🔍 [Brevo Debug] Attempting send to: ${toEmail} | Sender: ${senderEmail} | Key Length: ${apiKey.length} | Key Starts With: ${apiKey.substring(0, 8)}...`);

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          sender: {
            name: "TrustVault Security",
            email: senderEmail
          },
          to: [{ email: toEmail }],
          subject: subject,
          htmlContent: htmlContent
        })
      });

      const data = await response.json();
      if (response.ok && (data.messageId || data.messageIds)) {
        return {
          sent: true,
          realDelivery: true,
          messageId: data.messageId || (data.messageIds && data.messageIds[0])
        };
      } else {
        console.warn("⚠️ Brevo REST API returned:", data.message || JSON.stringify(data));
        return { sent: false, error: data.message };
      }
    } catch (err) {
      console.warn("⚠️ Brevo REST API network error:", err.message);
      return { sent: false, error: err.message };
    }
  }

  /**
   * Send email using Resend REST API directly
   * (Works with Resend API Keys starting with re_ - 100% instant, no manual approval needed)
   */
  static async sendViaResendApi(toEmail, subject, htmlContent) {
    let apiKey = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.RESEND_API_KEY || "").trim();
    apiKey = apiKey.replace(/^["']|["']$/g, "").replace(/;$/, "").trim();

    if (!apiKey || !apiKey.startsWith("re_")) return { sent: false };

    console.log(`🚀 [Resend API] Dispatching real email to: ${toEmail} via Resend...`);

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "TrustVault Security <onboarding@resend.dev>",
          to: [toEmail],
          subject: subject,
          html: htmlContent
        })
      });

      const data = await response.json();
      if (response.ok && data.id) {
        console.log(`✉️ [REAL EMAIL DELIVERED VIA RESEND] MessageId: ${data.id}`);
        return { sent: true, realDelivery: true, messageId: data.id };
      } else {
        console.warn("⚠️ Resend API error:", data.message || JSON.stringify(data));
        return { sent: false, error: data.message };
      }
    } catch (err) {
      console.warn("⚠️ Resend API network error:", err.message);
      return { sent: false, error: err.message };
    }
  }

  /**
   * Create and cache the email transporter
   */
  static async getTransporter() {
    let emailUser = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
    emailUser = emailUser.replace(/^["']|["']$/g, "").replace(/;$/, "").trim();

    let emailPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || "").replace(/\s+/g, "");
    emailPass = emailPass.replace(/^["']|["']$/g, "").replace(/;$/, "").trim();

    // 1. Brevo SMTP
    if (
      process.env.EMAIL_SERVICE === "brevo" ||
      (process.env.SMTP_HOST && process.env.SMTP_HOST.includes("brevo")) ||
      emailPass.startsWith("xsmtpsib-")
    ) {
      if (!this._cachedBrevoTransporter) {
        const brevoHost = process.env.SMTP_HOST || "smtp-relay.brevo.com";
        const brevoPort = parseInt(process.env.SMTP_PORT || "587", 10);

        console.log(`🔍 [SMTP Debug] Host: ${brevoHost}:${brevoPort} | User: ${emailUser} | Key Length: ${emailPass.length} | Prefix: ${emailPass.substring(0, 8)}...`);
        this._cachedBrevoTransporter = nodemailer.createTransport({
          host: brevoHost,
          port: brevoPort,
          secure: false, // 587 uses STARTTLS
          auth: {
            user: emailUser,
            pass: emailPass
          },
          tls: {
            rejectUnauthorized: false
          }
        });
      }
      return this._cachedBrevoTransporter;
    }

    // 2. Gmail SMTP service
    if (process.env.EMAIL_SERVICE === "gmail" || (emailUser && emailUser.includes("@gmail.com"))) {
      if (!this._cachedGmailTransporter) {
        this._cachedGmailTransporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: emailUser,
            pass: emailPass
          },
          tls: {
            rejectUnauthorized: false
          }
        });
      }
      return this._cachedGmailTransporter;
    }

    // 3. Custom SMTP provider
    if (process.env.SMTP_HOST && emailUser && emailPass) {
      if (!this._cachedSmtpTransporter) {
        this._cachedSmtpTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
          auth: {
            user: emailUser,
            pass: emailPass
          },
          tls: {
            rejectUnauthorized: false
          }
        });
      }
      return this._cachedSmtpTransporter;
    }

    // 4. Fallback: Ethereal test mock for offline development
    if (!this._cachedTestTransporter) {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this._cachedTestTransporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
      } catch (e) {
        console.error("Test SMTP account creation error:", e.message);
      }
    }

    return this._cachedTestTransporter;
  }

  /**
   * Send Password Reset Link to registered email
   */
  static async sendPasswordResetEmail(toEmail, resetToken, hostUrl = "http://localhost:5173") {
    const emailUser = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
    const emailPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.RESEND_API_KEY || "").trim();
    const isReal = this.isRealConfigured();
    const resetUrl = `${hostUrl}/?resetToken=${resetToken}`;
    const fromAddress = process.env.EMAIL_FROM || (emailUser ? `"TrustVault Security" <${emailUser}>` : '"TrustVault Security" <security@trustvault.com>');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0f172a; margin: 0; font-size: 24px;">TrustVault Security</h1>
          <p style="color: #0d9488; font-weight: bold; margin-top: 4px;">CONFIDENTIAL DOCUMENT WORKSPACE</p>
        </div>
        <div style="background: #ffffff; padding: 28px; border-radius: 8px; border: 1px solid #e8edf2;">
          <h2 style="color: #1e293b; font-size: 18px; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            We received a request to reset the password for your TrustVault account (<strong>${toEmail}</strong>).
          </p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Click the secure button below to set a new password. This link is valid for <strong>15 minutes</strong>.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="background: #0d9488; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
              Reset My Password
            </a>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
            Or copy and paste this link into your browser:<br/>
            <a href="${resetUrl}" style="color: #0d9488; word-break: break-all;">${resetUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
            If you did not make this request, you can safely ignore this email. Your credentials remain secure.
          </p>
        </div>
      </div>
    `;

    // A. If the key starts with 're_' (Resend API Key), use Resend directly
    if (emailPass.startsWith("re_")) {
      const resendResult = await this.sendViaResendApi(toEmail, "TrustVault: Password Reset Request", htmlContent);
      if (resendResult.sent) return resendResult;
    }

    // B. If the key starts with 'xkeysib-' (Brevo API Key), use Brevo REST API directly
    if (emailPass.startsWith("xkeysib-")) {
      const apiResult = await this.sendViaBrevoApi(toEmail, "TrustVault: Password Reset Request", htmlContent);
      if (apiResult.sent) {
        console.log(`✉️ [REAL EMAIL DELIVERED VIA BREVO API] Password reset sent directly to inbox: ${toEmail}`);
        return apiResult;
      }
    }

    try {
      const transporter = await this.getTransporter();
      if (transporter) {
        const info = await transporter.sendMail({
          from: fromAddress,
          to: toEmail,
          subject: "TrustVault: Password Reset Request",
          text: `We received a request to reset your password. Click this link to set a new password: ${resetUrl} (Valid for 15 minutes).`,
          html: htmlContent
        });

        if (isReal) {
          console.log(`✉️ [REAL EMAIL DELIVERED] Password reset sent directly to inbox: ${toEmail}`);
          return { sent: true, realDelivery: true, messageId: info.messageId };
        } else {
          const previewUrl = nodemailer.getTestMessageUrl(info);
          if (previewUrl) {
            console.log(`✉️ [MOCK EMAIL SENT VIA ETHEREAL] Preview URL: ${previewUrl}`);
          }
          return { sent: true, realDelivery: false };
        }
      }
    } catch (err) {
      console.error(`❌ SMTP sending error to ${toEmail}:`, err.message);

      // B. If SMTP authentication failed (535), automatically try Brevo REST API with the key
      if (emailPass && (err.message.includes("535") || err.message.includes("Authentication failed"))) {
        console.log("🔄 Attempting Brevo REST API delivery fallback...");
        const apiFallback = await this.sendViaBrevoApi(toEmail, "TrustVault: Password Reset Request", htmlContent);
        if (apiFallback.sent) {
          console.log(`✉️ [REAL EMAIL DELIVERED VIA BREVO API] Password reset sent directly to inbox: ${toEmail}`);
          return apiFallback;
        }
      }

      console.log(`\n[FALLBACK TERMINAL LOG] Password reset for ${toEmail}: ${resetUrl}\n`);
    }

    return { sent: false, realDelivery: false };
  }

  /**
   * Send MFA / 2FA 6-digit verification code to registered email
   */
  static async sendMfaCodeEmail(toEmail, mfaCode) {
    const emailUser = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
    const emailPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.RESEND_API_KEY || "").trim();
    const isReal = this.isRealConfigured();
    const fromAddress = process.env.EMAIL_FROM || (emailUser ? `"TrustVault Security" <${emailUser}>` : '"TrustVault Security" <security@trustvault.com>');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0f172a; margin: 0; font-size: 24px;">TrustVault Security</h1>
          <p style="color: #0d9488; font-weight: bold; margin-top: 4px;">TWO-FACTOR AUTHENTICATION</p>
        </div>
        <div style="background: #ffffff; padding: 28px; border-radius: 8px; border: 1px solid #e8edf2; text-align: center;">
          <h2 style="color: #1e293b; font-size: 18px; margin-top: 0;">Your Verification Code</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            A sign-in attempt was detected for your account (<strong>${toEmail}</strong>).
            Enter the 6-digit code below to complete your login:
          </p>
          <div style="margin: 28px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0f172a; background: #f1f5f9; padding: 12px 24px; border-radius: 8px; display: inline-block; border: 1px solid #cbd5e1;">
              ${mfaCode}
            </span>
          </div>
          <p style="color: #64748b; font-size: 13px;">
            This security code expires in <strong>10 minutes</strong>.
          </p>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
            Never share this code with anyone. TrustVault staff will never ask for your 2FA code.
          </p>
        </div>
      </div>
    `;

    // A. If key starts with 're_' (Resend API Key), use Resend directly
    if (emailPass.startsWith("re_")) {
      const resendResult = await this.sendViaResendApi(toEmail, `${mfaCode} is your TrustVault Verification Code`, htmlContent);
      if (resendResult.sent) return resendResult;
    }

    // B. If key starts with 'xkeysib-' (Brevo API Key), use Brevo REST API directly
    if (emailPass.startsWith("xkeysib-")) {
      const apiResult = await this.sendViaBrevoApi(toEmail, `${mfaCode} is your TrustVault Verification Code`, htmlContent);
      if (apiResult.sent) {
        console.log(`✉️ [REAL EMAIL DELIVERED VIA BREVO API] 2FA code sent directly to inbox: ${toEmail} (MessageId: ${apiResult.messageId})`);
        return apiResult;
      }
    }

    try {
      const transporter = await this.getTransporter();
      if (transporter) {
        const info = await transporter.sendMail({
          from: fromAddress,
          to: toEmail,
          subject: `${mfaCode} is your TrustVault Verification Code`,
          text: `Your TrustVault 2FA verification code is: ${mfaCode}. This code expires in 10 minutes.`,
          html: htmlContent
        });

        if (isReal) {
          console.log(`✉️ [REAL EMAIL DELIVERED] 2FA code sent directly to inbox: ${toEmail} (MessageId: ${info.messageId})`);
          return { sent: true, realDelivery: true, messageId: info.messageId };
        } else {
          const previewUrl = nodemailer.getTestMessageUrl(info);
          if (previewUrl) {
            console.log(`✉️ [MOCK EMAIL SENT VIA ETHEREAL] Preview URL: ${previewUrl}`);
          }
          return { sent: true, realDelivery: false };
        }
      }
    } catch (err) {
      console.error(`❌ SMTP sending error to ${toEmail}:`, err.message);

      // B. If SMTP authentication failed (535), automatically try Brevo REST API with the key
      if (emailPass && (err.message.includes("535") || err.message.includes("Authentication failed"))) {
        console.log("🔄 Attempting Brevo REST API delivery fallback...");
        const apiFallback = await this.sendViaBrevoApi(toEmail, `${mfaCode} is your TrustVault Verification Code`, htmlContent);
        if (apiFallback.sent) {
          console.log(`✉️ [REAL EMAIL DELIVERED VIA BREVO API] 2FA code sent directly to inbox: ${toEmail} (MessageId: ${apiFallback.messageId})`);
          return apiFallback;
        }
      }

      console.log(`\n[FALLBACK TERMINAL LOG] 2FA code for ${toEmail}: ${mfaCode}\n`);
    }

    return { sent: false, realDelivery: false };
  }
}

module.exports = EmailService;
