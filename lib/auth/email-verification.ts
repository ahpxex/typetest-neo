import { createHash, randomBytes } from 'node:crypto';

export function hashEmailVerificationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createEmailVerificationToken() {
  const token = randomBytes(32).toString('base64url');

  return {
    token,
    tokenHash: hashEmailVerificationToken(token),
  };
}
