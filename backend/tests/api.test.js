import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../server.js";

describe("TrustVault API Security & Threat Assurance Tests", () => {
  /* =========================================================================
     1. System Health & Gateway Boundary
     ========================================================================= */
  it("should return 200 for health check with database status", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("TrustVault backend is running");
  });

  /* =========================================================================
     2. TV-T01: BOLA / IDOR & Authentication Boundary Tests
     ========================================================================= */
  it("should reject private document download without authentication token (401)", async () => {
    const response = await request(app).get(
      "/api/documents/660000000000000000000099/download"
    );
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/token is required/i);
  });

  it("should reject private document download with invalid or forged JWT token (401)", async () => {
    const response = await request(app)
      .get("/api/documents/660000000000000000000099/download")
      .set("Authorization", "Bearer forged.invalid.signature");
    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/invalid or expired/i);
  });

  it("should reject user-profile /api/auth/me requests without authentication (401)", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject user-profile /api/auth/me requests with malformed token (401)", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer bad_token");
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  /* =========================================================================
     3. TV-T02: Role-Based Access Control (RBAC) & Audit Integrity
     ========================================================================= */
  it("should reject audit-log requests without authentication (401)", async () => {
    const response = await request(app).get("/api/documents/audit-logs");
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject audit-log requests with forged token (401)", async () => {
    const response = await request(app)
      .get("/api/documents/audit-logs")
      .set("Authorization", "Bearer forged.admin.token");
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  /* =========================================================================
     4. TV-T03: Multi-Factor Authentication (MFA) Code Security
     ========================================================================= */
  it("should reject verify-mfa requests without tempToken (400)", async () => {
    const response = await request(app)
      .post("/api/auth/verify-mfa")
      .send({ mfaCode: "123456" });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject verify-mfa requests without 6-digit mfaCode (400)", async () => {
    const response = await request(app)
      .post("/api/auth/verify-mfa")
      .send({ tempToken: "mock_temp_token" });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject verify-mfa with invalid or expired temporary session token (401)", async () => {
    const response = await request(app)
      .post("/api/auth/verify-mfa")
      .send({ tempToken: "invalid_expired_token", mfaCode: "123456" });
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject resend-mfa requests without tempToken (400)", async () => {
    const response = await request(app)
      .post("/api/auth/resend-mfa")
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /* =========================================================================
     5. TV-T05: File Upload & Storage Boundary Security
     ========================================================================= */
  it("should reject document upload without authentication (401)", async () => {
    const response = await request(app)
      .post("/api/documents/upload")
      .field("title", "Confidential NDA");
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject document upload with malformed authentication header (401)", async () => {
    const response = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", "Basic dXNlcjpwYXNz")
      .field("title", "Malformed Auth");
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  /* =========================================================================
     6. TV-T04: Sharing & Revocation Access Control
     ========================================================================= */
  it("should reject document share request without authentication token (401)", async () => {
    const docId = "660000000000000000000005";
    const response = await request(app)
      .post(`/api/documents/${docId}/share`)
      .send({ email: "viewer@example.com" });
    expect(response.status).toBe(401);
  });

  it("should reject document revoke request without authentication token (401)", async () => {
    const docId = "660000000000000000000005";
    const response = await request(app)
      .post(`/api/documents/${docId}/revoke`)
      .send({ email: "viewer@example.com" });
    expect(response.status).toBe(401);
  });

  /* =========================================================================
     7. TV-T07: Password Reset Security
     ========================================================================= */
  it("should reject forgot-password requests without an email (400)", async () => {
    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/email address is required/i);
  });

  it("should reject reset-password requests without required fields (400)", async () => {
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ resetToken: "test_token" });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/password/i);
  });

  it("should reject verify-reset-token requests without resetToken (400)", async () => {
    const response = await request(app)
      .post("/api/auth/verify-reset-token")
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/reset token is required/i);
  });

  /* =========================================================================
     8. User Registration & Password Policy Security
     ========================================================================= */
  it("should reject registration requests with missing credentials (400)", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "invalid@example.com" });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/name, email, and password are required/i);
  });

  it("should reject registration requests with passwords shorter than 8 characters (400)", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "Tester", email: "tester@example.com", password: "short" });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/at least 8 characters/i);
  });

  it("should reject login requests with missing email or password (400)", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "only_email@example.com" });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/email and password are required/i);
  });
});
