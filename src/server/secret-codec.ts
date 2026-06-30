import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const encryptedPrefix = "enc:v1:";
const keySalt = "oomol-connect-local-secret-store-v1";

/**
 * Encodes sensitive local runtime records before they are written to disk.
 */
export interface ISecretCodec {
  readonly encrypted: boolean;
  encode(plaintext: string): string;
  decode(stored: string): string;
}

export class PlainTextSecretCodec implements ISecretCodec {
  readonly encrypted = false;

  encode(plaintext: string): string {
    return plaintext;
  }

  decode(stored: string): string {
    return stored;
  }
}

export class AesGcmSecretCodec implements ISecretCodec {
  readonly encrypted = true;
  private readonly key: Buffer;

  constructor(passphrase: string) {
    if (!passphrase.trim()) {
      throw new Error("Encryption key must not be empty.");
    }
    this.key = scryptSync(passphrase, keySalt, 32);
  }

  encode(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      encryptedPrefix,
      iv.toString("base64url"),
      ".",
      tag.toString("base64url"),
      ".",
      encrypted.toString("base64url"),
    ].join("");
  }

  decode(stored: string): string {
    if (!stored.startsWith(encryptedPrefix)) {
      return stored;
    }

    const [ivText, tagText, encryptedText] = stored.slice(encryptedPrefix.length).split(".");
    if (!ivText || !tagText || !encryptedText) {
      throw new Error("Encrypted local secret payload is malformed.");
    }

    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
  }
}

export function createSecretCodec(encryptionKey: string | undefined): ISecretCodec {
  return encryptionKey ? new AesGcmSecretCodec(encryptionKey) : new PlainTextSecretCodec();
}
