// utils/encryption.js
const crypto = require("crypto");
const config = require("../config/config");

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const VERSION = "v1";

function getKey() {
  if (!config.encryptionKey) {
    throw new Error("ENCRYPTION_KEY missing in environment");
  }
  const key = Buffer.from(config.encryptionKey, "hex");
  if (key.length !== 32) {
    throw new Error("Encryption key must be 32 bytes (64 hex chars)");
  }
  return key;
}

function encryptText(data, aad = "") {
  if (data === undefined || data === null || data === "") return undefined;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  if (aad) cipher.setAAD(Buffer.from(String(aad)));

  const text = typeof data === "string" ? data : JSON.stringify(data);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

function decryptText(payload, aad = "") {
  if (!payload) return undefined;

  const [version, ivHex, tagHex, contentHex] = String(payload).split(":");
  if (version !== VERSION) throw new Error("Unsupported encryption version");

  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(contentHex, "hex");

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  if (aad) decipher.setAAD(Buffer.from(String(aad)));

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  const result = decrypted.toString("utf8");

  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

module.exports = { encryptText, decryptText };
