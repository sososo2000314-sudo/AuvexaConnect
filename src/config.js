export const APP = Object.freeze({
  name: "AuvexaConnect",
  version: "1.0.0",
  defaultLanguage: "ja",
  languages: ["ja", "en"],
  timezone: "Asia/Tokyo",
  sessionDays: 30,
  maxUploadBytes: 100_000_000,
  storageWarningBytes: 8_000_000_000,
  storageRestrictBytes: 9_000_000_000,
  storageLimitBytes: 10_000_000_000
});

export const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm", "audio/mpeg", "audio/mp4",
  "audio/wav", "application/pdf", "text/plain"
]);
