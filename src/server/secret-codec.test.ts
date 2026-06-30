import { describe, expect, it } from "vitest";
import { AesGcmSecretCodec, PlainTextSecretCodec } from "./secret-codec.ts";

describe("secret codecs", () => {
  it("round-trips encrypted payloads without storing plaintext", () => {
    const codec = new AesGcmSecretCodec("test-key");
    const stored = codec.encode('{"apiKey":"secret-token"}');

    expect(stored).toMatch(/^enc:v1:/);
    expect(stored).not.toContain("secret-token");
    expect(codec.decode(stored)).toBe('{"apiKey":"secret-token"}');
  });

  it("keeps plaintext payloads readable for development mode", () => {
    const codec = new PlainTextSecretCodec();

    expect(codec.encode("value")).toBe("value");
    expect(codec.decode("value")).toBe("value");
  });
});
