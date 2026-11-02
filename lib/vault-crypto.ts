import { createHash, randomBytes, scrypt } from "node:crypto";

export function newSalt() {
  return randomBytes(16).toString("hex");
}

/** The PIN itself is never stored or logged. Short PINs are why the lockout lives in the database too. */
export function hashPin(pin: string, salt: string) {
  return new Promise<string>((resolve, reject) => {
    scrypt(pin, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key.toString("hex"))));
  });
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** The cookie carries the token; the database keeps only its hash and the expiry. */
export function newUnlockToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}
