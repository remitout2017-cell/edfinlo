// utils/encryption.js
const crypto = require('crypto');
const config = require('../config/config');

/**
 * Encrypts text using AES-256-GCM
 * @param {string} text - The text to encrypt
 * @returns {string|undefined} - Encrypted string in format "iv:tag:content" or undefined on failure
 */
const encryptText = (text) => {
    if (!text) return undefined;

    try {
        // Ensure key is correct length (32 bytes for AES-256)
        const key = Buffer.from(config.encryptionKey, 'hex');
        
        // Generate random IV
        const iv = crypto.randomBytes(16);
        
        // Create cipher
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        
        // Encrypt
        const encrypted = Buffer.concat([
            cipher.update(text, 'utf8'),
            cipher.final()
        ]);
        
        // Get auth tag
        const tag = cipher.getAuthTag();
        
        // Return format: IV:AuthTag:EncryptedContent
        return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (error) {
        console.error('❌ Encryption failed:', error.message);
        return undefined; // Fail safe by not saving corrupted data
    }
};

/**
 * Decrypts text using AES-256-GCM
 * @param {string} text - The encrypted string "iv:tag:content"
 * @returns {string|undefined} - Decrypted text or undefined on failure
 */
const decryptText = (text) => {
    if (!text) return undefined;

    try {
        const parts = text.split(':');
        if (parts.length !== 3) return undefined;
        
        const [ivHex, tagHex, contentHex] = parts;
        
        const key = Buffer.from(config.encryptionKey, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const encrypted = Buffer.from(contentHex, 'hex');
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        
        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);
        
        return decrypted.toString('utf8');
    } catch (error) {
        console.error('❌ Decryption failed:', error.message);
        return undefined;
    }
};

module.exports = { encryptText, decryptText };
