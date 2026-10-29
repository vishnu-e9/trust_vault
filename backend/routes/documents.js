
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const yauzl = require("yauzl");
const authenticate = require("../middleware/authenticate");
const Document = require("../models/Document");
const User = require("../models/user");
const AuditLog = require("../models/AuditLog");
const router = express.Router();

// Store confidential files outside publicly accessible folders.
const uploadDir = path.resolve(__dirname, "..", "private_uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// Allowed extensions and MIME types.
const allowedExtensions = [
  ".pdf",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg"
];

const allowedMimeTypes = [
  "application/pdf",
  "application/octet-stream",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg"
];

// Configure private file storage.
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDir);
  },
  filename: (req, file, callback) => {
    callback(null, crypto.randomUUID());
  }
});

// Configure upload restrictions.
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (
      !allowedExtensions.includes(extension) ||
      !allowedMimeTypes.includes(file.mimetype)
    ) {
      return callback(
        new Error("Only PDF, DOCX, PNG, and JPEG files are allowed")
      );
    }

    callback(null, true);
  }
});

// Validate MongoDB document IDs before querying.
function isValidDocumentId(id) {
  return (
    typeof id === "string" &&
    /^[a-fA-F0-9]{24}$/.test(id) &&
    mongoose.Types.ObjectId.isValid(id)
  );
}
function hasValidDocxStructure(filePath) {
  return new Promise((resolve) => {
    yauzl.open(
      filePath,
      { lazyEntries: true },
      (error, zipfile) => {
        if (error || !zipfile) {
          return resolve(false);
        }

        let hasContentTypes = false;
        let hasWordDocument = false;
        let finished = false;

        function finish(isValid) {
          if (finished) return;
          finished = true;
          zipfile.close();
          resolve(isValid);
        }

        zipfile.on("error", () => finish(false));

        zipfile.on("entry", (entry) => {
          if (entry.fileName === "[Content_Types].xml") {
            hasContentTypes = true;
          }

          if (entry.fileName === "word/document.xml") {
            hasWordDocument = true;
          }

          if (hasContentTypes && hasWordDocument) {
            return finish(true);
          }

          zipfile.readEntry();
        });

        zipfile.on("end", () => {
          finish(hasContentTypes && hasWordDocument);
        });

        zipfile.readEntry();
      }
    );
  });
}
async function hasValidFileContent(filePath, originalName) {
  const extension = path.extname(originalName).toLowerCase();

  try {
    if (extension === ".docx") {
      return await hasValidDocxStructure(filePath);
    }

    const { fileTypeFromFile } = await import("file-type");
    const detected = await fileTypeFromFile(filePath);

    const expectedTypes = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg"
    };

    return Boolean(
      detected && detected.mime === expectedTypes[extension]
    );
  } catch (error) {
    console.error("File content validation error:", error.message);
    return false;
  }
}
// POST /api/documents/upload
// Upload a document for the authenticated user.
router.post(
  "/upload",
  authenticate,
  (req, res, next) => {
    upload.single("document")(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      next();
    });
  },
  async (req, res) => {
    let savedFilePath = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a document to upload"
        });
      }

      savedFilePath = req.file.path;

      const validContent = await hasValidFileContent(
        req.file.path,
        req.file.originalname
      );

      if (!validContent) {
        fs.unlinkSync(savedFilePath);
        savedFilePath = null;

        return res.status(400).json({
          success: false,
          message: "File content does not match the selected file type"
        });
      }

      const title =
        typeof req.body.title === "string"
          ? req.body.title.trim()
          : "";

      if (!title || title.length > 200) {
        fs.unlinkSync(savedFilePath);
        savedFilePath = null;

        return res.status(400).json({
          success: false,
          message: "Title is required and must be at most 200 characters"
        });
      }

      const description =
        typeof req.body.description === "string"
          ? req.body.description.trim()
          : "";

      if (description.length > 1000) {
        fs.unlinkSync(savedFilePath);
        savedFilePath = null;

        return res.status(400).json({
          success: false,
          message: "Description must be at most 1000 characters"
        });
      }

      const validCategories = ["Finance", "HR", "Legal", "IT", "Education", "Personal", "General"];
      const rawCategory = typeof req.body.category === "string" ? req.body.category.trim() : "";
      const category = validCategories.includes(rawCategory) ? rawCategory : "General";

      const document = await Document.create({
        title,
        description,
        category,
        originalName: path.basename(req.file.originalname),
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        owner: req.user._id,
        allowedViewers: []
      });

      try {
        await AuditLog.create({
          user: req.user._id,
          document: document._id,
          action: "UPLOAD",
          details: "Document uploaded successfully"
        });
      } catch (auditError) {
        console.error("Upload audit log error:", auditError.message);
      }

      savedFilePath = null;

      return res.status(201).json({
        success: true,
        message: "Document uploaded successfully",
        document: {
          id: document._id,
          title: document.title,
          originalName: document.originalName,
          size: document.size,
          owner: document.owner,
          createdAt: document.createdAt
        }
      });
    } catch (error) {
      if (savedFilePath && fs.existsSync(savedFilePath)) {
        try {
          fs.unlinkSync(savedFilePath);
        } catch (cleanupError) {
          console.error("File cleanup error:", cleanupError.message);
        }
      }

      console.error("Document upload error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Document upload failed"
      });
    }
  }
);
// GET /api/documents
// List documents owned by the authenticated user.
router.get("/", authenticate, async (req, res) => {
  try {
    const documents = await Document.find({
      owner: req.user._id
    })
      .select(
        "title description originalName mimeType size category owner allowedViewers createdAt updatedAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error) {
    console.error("Fetch documents error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve documents"
    });
  }
});

/* GET /api/documents/audit-logs
   Admin-only access to audit logs. */
router.get("/audit-logs", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    const logs = await AuditLog.find()
      .populate("user", "name email role")
      .populate("document", "title originalName")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error("Fetch audit logs error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve audit logs"
    });
  }
});

// GET /api/documents/:id/download
// Only the owner or an authorized viewer can download.
router.get("/:id/download", authenticate, async (req, res) => {
  try {
    if (!isValidDocumentId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Document not found or access denied"
      });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found or access denied"
      });
    }

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

    // Resolve the path and ensure it stays inside private_uploads.
    const filePath = path.resolve(uploadDir, document.storedName);

    if (!filePath.startsWith(uploadDir + path.sep)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document storage path"
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "Stored document file not found"
      });
    }
    await AuditLog.create({
  user: req.user._id,
  document: document._id,
  action: "DOWNLOAD",
  details: "Document download requested"
});
    return res.download(
      filePath,
      path.basename(document.originalName),
      (error) => {
        if (error) {
          console.error("Document download error:", error.message);

          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: "Failed to download document"
            });
          }
        }
      }
    );
  } catch (error) {
    console.error("Document download error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to access document"
    });
  }
});

// POST /api/documents/:id/share
// The document owner grants access to a registered user by email.
router.post("/:id/share", authenticate, async (req, res) => {
  try {
    if (!isValidDocumentId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    const email = req.body?.email;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Viewer email is required"
      });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    if (!document.owner.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Only the document owner can share it"
      });
    }

    const viewer = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!viewer) {
      return res.status(404).json({
        success: false,
        message: "Registered user not found"
      });
    }

    if (viewer._id.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You already own this document"
      });
    }

    const alreadyAllowed = document.allowedViewers.some(
      (viewerId) => viewerId.equals(viewer._id)
    );

    if (alreadyAllowed) {
      return res.status(409).json({
        success: false,
        message: "This user already has access"
      });
    }

    document.allowedViewers.push(viewer._id);
    await document.save();
    try {
  await AuditLog.create({
    user: req.user._id,
    document: document._id,
    action: "SHARE",
    details: `Access granted to ${viewer.email}`
  });
} catch (auditError) {
  console.error("Share audit log error:", auditError.message);
}
    return res.status(200).json({
      success: true,
      message: "Document access granted successfully"
    });
  } catch (error) {
    console.error("Share document error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to share document"
    });
  }
});

router.post("/:id/revoke", authenticate, async (req, res) => {
  try {
    if (!isValidDocumentId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    const email = req.body?.email;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Viewer email is required"
      });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    if (!document.owner.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Only the document owner can revoke access"
      });
    }

    const viewer = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!viewer) {
      return res.status(404).json({
        success: false,
        message: "Registered user not found"
      });
    }

    const hasAccess = document.allowedViewers.some(
      (viewerId) => viewerId.equals(viewer._id)
    );

    if (!hasAccess) {
      return res.status(404).json({
        success: false,
        message: "This user does not have access to the document"
      });
    }

    document.allowedViewers = document.allowedViewers.filter(
      (viewerId) => !viewerId.equals(viewer._id)
    );

    await document.save();

    try {
      await AuditLog.create({
        user: req.user._id,
        document: document._id,
        action: "REVOKE",
        details: `Access revoked for ${viewer.email}`
      });
    } catch (auditError) {
      console.error("Revoke audit log error:", auditError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Document access revoked successfully"
    });
  } catch (error) {
    console.error("Revoke document access error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to revoke document access"
    });
  }
});

router.get("/shared-with-me", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const documents = await Document.find({
      allowedViewers: userId
    })
      .select("-storedName -filePath")
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error) {
    console.error("Shared documents error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch shared documents"
    });
  }
});

// DELETE /api/documents/:id
// Owner or admin can delete a document.
router.delete("/:id", authenticate, async (req, res) => {
  try {
    if (!isValidDocumentId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    const isOwner = document.owner.equals(req.user._id);
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only the document owner or an administrator can delete this document"
      });
    }

    const filePath = path.resolve(uploadDir, document.storedName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error("File deletion error:", err.message);
      }
    }

    await Document.findByIdAndDelete(document._id);

    try {
      await AuditLog.create({
        user: req.user._id,
        document: document._id,
        action: "DELETE",
        details: `Document "${document.title}" was deleted`
      });
    } catch (auditError) {
      console.error("Delete audit log error:", auditError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Document deleted successfully"
    });
  } catch (error) {
    console.error("Delete document error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete document"
    });
  }
});

module.exports = router;
