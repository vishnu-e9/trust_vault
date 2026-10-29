const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true
    },
    action: {
      type: String,
      enum: ["UPLOAD", "DOWNLOAD", "SHARE", "REVOKE", "DELETE"],
      required: true
    },
    details: {
      type: String,
      maxlength: 500,
      default: ""
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
