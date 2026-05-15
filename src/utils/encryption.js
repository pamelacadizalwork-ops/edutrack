import CryptoJS from "crypto-js";

// ============================================================
// SeenKa Encryption Module
// Uses AES-256-CBC for all sensitive Firestore data
// Keys are derived from a combination of:
//   1. App-level secret (hardcoded salt)
//   2. User UID (unique per teacher)
//   3. Record type (prevents cross-collection attacks)
// ============================================================

const APP_SALT = "SeenKa@2026#SecureAttendance$PH";

// Derive a strong encryption key from user UID + record type
function deriveKey(uid, recordType = "general") {
  const rawKey = `${APP_SALT}::${uid}::${recordType}`;
  return CryptoJS.SHA256(rawKey).toString();
}

// ── Encrypt a plain string ──────────────────────────────────
export function encrypt(plainText, uid, recordType = "general") {
  if (!plainText && plainText !== 0) return "";
  try {
    const key = deriveKey(uid, recordType);
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(
      String(plainText),
      CryptoJS.enc.Hex.parse(key),
      { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );
    // Prepend IV to ciphertext so we can decrypt later
    return iv.toString() + ":" + encrypted.toString();
  } catch {
    return String(plainText);
  }
}

// ── Decrypt a ciphertext string ─────────────────────────────
export function decrypt(cipherText, uid, recordType = "general") {
  if (!cipherText) return "";
  try {
    const [ivHex, encrypted] = cipherText.split(":");
    if (!ivHex || !encrypted) return cipherText; // not encrypted
    const key = deriveKey(uid, recordType);
    const decrypted = CryptoJS.AES.decrypt(
      encrypted,
      CryptoJS.enc.Hex.parse(key),
      { iv: CryptoJS.enc.Hex.parse(ivHex), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );
    return decrypted.toString(CryptoJS.enc.Utf8) || cipherText;
  } catch {
    return cipherText; // return as-is if decryption fails
  }
}

// ── Encrypt entire object ───────────────────────────────────
export function encryptObject(obj, uid, recordType, fields) {
  const result = { ...obj };
  fields.forEach(field => {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = encrypt(result[field], uid, recordType);
    }
  });
  return result;
}

// ── Decrypt entire object ───────────────────────────────────
export function decryptObject(obj, uid, recordType, fields) {
  const result = { ...obj };
  fields.forEach(field => {
    if (result[field]) {
      result[field] = decrypt(result[field], uid, recordType);
    }
  });
  return result;
}

// ── Field definitions for each Firestore collection ─────────
export const ENCRYPTED_FIELDS = {
  students: ["name", "email", "course", "studentId", "section"],
  attendance: ["studentName", "status", "section"],
  classes: ["name", "code", "section", "schedule"],
  qrSessions: ["className", "section", "scanUrl"],
};

// ── Encrypt a student document ───────────────────────────────
export function encryptStudent(student, uid) {
  return encryptObject(student, uid, "students", ENCRYPTED_FIELDS.students);
}

// ── Decrypt a student document ───────────────────────────────
export function decryptStudent(student, uid) {
  return decryptObject(student, uid, "students", ENCRYPTED_FIELDS.students);
}

// ── Encrypt an attendance record ─────────────────────────────
export function encryptAttendance(record, uid) {
  return encryptObject(record, uid, "attendance", ENCRYPTED_FIELDS.attendance);
}

// ── Decrypt an attendance record ─────────────────────────────
export function decryptAttendance(record, uid) {
  return decryptObject(record, uid, "attendance", ENCRYPTED_FIELDS.attendance);
}

// ── Encrypt a class document ─────────────────────────────────
export function encryptClass(cls, uid) {
  return encryptObject(cls, uid, "classes", ENCRYPTED_FIELDS.classes);
}

// ── Decrypt a class document ─────────────────────────────────
export function decryptClass(cls, uid) {
  return decryptObject(cls, uid, "classes", ENCRYPTED_FIELDS.classes);
}

// ── Generate a secure QR token (encrypted session ID) ────────
export function generateSecureToken(sessionId, uid) {
  const key = deriveKey(uid, "qr");
  const token = CryptoJS.HmacSHA256(sessionId, key).toString();
  return token.slice(0, 32); // 32-char HMAC token
}

// ── Verify a QR token ────────────────────────────────────────
export function verifyToken(sessionId, token, uid) {
  const expected = generateSecureToken(sessionId, uid);
  return expected === token;
}

// ── Hash sensitive IDs for Firestore doc keys ────────────────
// So even doc IDs don't reveal student info
export function hashDocId(plainId, uid) {
  return CryptoJS.HmacSHA256(plainId, uid).toString().slice(0, 20);
}

// ── Check if a string is encrypted ──────────────────────────
export function isEncrypted(value) {
  if (typeof value !== "string") return false;
  const parts = value.split(":");
  return parts.length === 2 && parts[0].length === 32;
}
