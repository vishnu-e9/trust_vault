const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ["admin", "owner", "viewer", "Admin", "Owner", "Viewer"],
      lowercase: true,
      default: "viewer"
    },
    // Password reset fields
    resetPasswordToken: {
      type: String,
      default: null
    },
    resetPasswordExpires: {
      type: Date,
      default: null
    },
    // Multi-factor authentication (MFA / 2FA) fields (disabled by default)
    mfaEnabled: {
      type: Boolean,
      default: false
    },
    mfaCode: {
      type: String,
      default: null
    },
    mfaExpires: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
