import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encrypt, decrypt, deriveKey, type EncryptedBlob } from "./crypto.js";

const key = randomBytes(32);

describe("crypto core", () => {
  it("round-trips: decrypt(encrypt(x)) === x", () => {
    const secret = "sk_live_thisIsATestSecret_12345";
    const blob = encrypt(secret, key);
    expect(decrypt(blob, key)).toBe(secret);
  });

  it("uses a fresh IV every time (no IV reuse)", () => {
    const a = encrypt("same-value", key);
    const b = encrypt("same-value", key);
    expect(a.iv).not.toBe(b.iv);            // distinct nonces
    expect(a.ciphertext).not.toBe(b.ciphertext); // and therefore distinct ciphertext
  });

  it("FAILS CLOSED on tamper: flipping a ciphertext byte must throw", () => {
    const blob = encrypt("important", key);
    const raw = Buffer.from(blob.ciphertext, "base64");
    raw[0] ^= 0xff;                          // flip one bit
    const tampered: EncryptedBlob = { ...blob, ciphertext: raw.toString("base64") };
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it("FAILS CLOSED on wrong key: decrypting with another key must throw", () => {
    const blob = encrypt("important", key);
    const wrongKey = randomBytes(32);
    expect(() => decrypt(blob, wrongKey)).toThrow();
  });

  it("deriveKey is deterministic for same passphrase+salt, different across salts", () => {
    const salt = randomBytes(16);
    const k1 = deriveKey("hunter2", salt);
    const k2 = deriveKey("hunter2", salt);
    const k3 = deriveKey("hunter2", randomBytes(16));
    expect(k1.equals(k2)).toBe(true);
    expect(k1.equals(k3)).toBe(false);
  });
});
