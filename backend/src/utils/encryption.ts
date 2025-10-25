import crypto from 'crypto';
import config from '../config';

/**
 * Encrypt text
 */
export const encrypt = (text: string): string => {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(config.encryptionKey.padEnd(32, '0').substring(0, 32));
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
};

/**
 * Decrypt text
 */
export const decrypt = (text: string): string => {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(config.encryptionKey.padEnd(32, '0').substring(0, 32));
  
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encrypted = parts.join(':');
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

/**
 * Generate random token
 */
export const generateToken = (length = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash token
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
