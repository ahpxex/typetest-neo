import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const PASSWORD_ALGO = 'scrypt';

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');

  return `${PASSWORD_ALGO}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algo, salt, hash] = storedHash.split(':');

  if (algo !== PASSWORD_ALGO || !salt || !hash) {
    return false;
  }

  const derivedHash = scryptSync(password, salt, KEY_LENGTH);
  const existingHash = Buffer.from(hash, 'hex');

  if (derivedHash.length !== existingHash.length) {
    return false;
  }

  return timingSafeEqual(derivedHash, existingHash);
}
