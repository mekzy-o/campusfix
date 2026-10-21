/**
 * Image upload handling (evidence of fault / proof of completion).
 * Files are kept in memory, checked for type and size, and then stored in
 * the attachments table.
 */
const multer = require('multer');
const config = require('../config');
const HttpError = require('../utils/httpError');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.uploads.maxFileSizeBytes,
    files: config.uploads.maxFiles,
  },
  fileFilter(_req, file, cb) {
    if (!config.uploads.allowedMimeTypes.includes(file.mimetype)) {
      return cb(HttpError.badRequest('Only JPG, PNG or WEBP images are allowed'));
    }
    return cb(null, true);
  },
});

/** Accepts up to N images in the multipart field "images". */
const uploadImages = upload.array('images', config.uploads.maxFiles);

module.exports = { uploadImages };
