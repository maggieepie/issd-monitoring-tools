import multer from "multer";

import { MAX_ATTACHMENT_BYTES } from "../services/attachmentsService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
      cb(null, true);
      return;
    }
    cb(new Error("Only JPEG and PNG images are allowed."));
  },
});

export { upload };
