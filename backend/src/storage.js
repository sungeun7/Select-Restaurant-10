const crypto = require('crypto');
const { Storage } = require('@google-cloud/storage');

const bucketName = process.env.CLOUD_STORAGE_BUCKET || 'dokki1985';
const storage = new Storage();

function guessExtensionFromMime(mime) {
  // Keep a small mapping for common image types.
  const m = (mime || '').toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  // Fallback
  return 'jpg';
}

function parseDataUrl(photoBase64) {
  // Accept:
  // 1) "data:image/png;base64,...."
  // 2) raw base64 string
  if (typeof photoBase64 !== 'string') return null;
  const s = photoBase64.trim();
  if (!s) return null;

  if (s.startsWith('data:')) {
    const match = s.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return {
      mime: match[1],
      base64: match[2],
    };
  }

  return {
    mime: 'image/jpeg',
    base64: s,
  };
}

async function uploadReviewPhotoBase64(photoBase64) {
  const parsed = parseDataUrl(photoBase64);
  if (!parsed) return null;

  const ext = guessExtensionFromMime(parsed.mime);
  const objectName = `sr10/reviews/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${ext}`;

  const buffer = Buffer.from(parsed.base64, 'base64');
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    resumable: false,
    contentType: parsed.mime,
  });

  // Allow the app to display images via plain URL.
  await file.makePublic();

  const photoUrl = `https://storage.googleapis.com/${bucketName}/${objectName}`;
  return { photoUrl, objectName };
}

module.exports = { uploadReviewPhotoBase64 };

