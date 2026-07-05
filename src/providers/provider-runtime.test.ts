import type { TransitFileRead, TransitFileWriter } from "../core/types.ts";

import { afterEach, describe, expect, it, vi } from "vitest";
import { defineProviderExecutors, ProviderRequestError, uploadProviderUrlToTransitFile } from "./provider-runtime.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("provider runtime file helpers", () => {
  it("uses a Worker-safe default fetcher for provider executors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(function (this: unknown) {
        if (this !== globalThis) {
          throw new TypeError("Illegal invocation: function called with incorrect `this` reference.");
        }
        return Promise.resolve(Response.json({ ok: true }));
      }) as typeof fetch,
    );
    const executors = defineProviderExecutors<{ fetcher: typeof fetch }>({
      service: "example",
      handlers: {
        async ping(_input, context) {
          const response = await context.fetcher("https://provider.example/ping");
          return response.json();
        },
      },
      createContext(_context, fetcher) {
        return { fetcher };
      },
    });

    await expect(
      executors["example.ping"]?.(
        {},
        {
          getCredential: async () => undefined,
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      output: { ok: true },
    });
  });

  it("bounds provider URL downloads before creating transit files", async () => {
    const transitFiles = new MemoryTransitFiles(4);

    await expect(
      uploadProviderUrlToTransitFile(
        {
          url: "https://provider.example/report.txt",
          name: "report.txt",
          source: "example",
        },
        {
          fetcher: async () => new Response("12345"),
          transitFiles,
        },
      ),
    ).rejects.toMatchObject({
      status: 413,
      message: "report.txt exceeds 4 bytes",
    });
    expect(transitFiles.createdFiles).toHaveLength(0);
  });

  it("stores bounded provider URL downloads", async () => {
    const transitFiles = new MemoryTransitFiles(32);

    const upload = await uploadProviderUrlToTransitFile(
      {
        url: "https://provider.example/report.txt",
        name: "report.txt",
        source: "example",
      },
      {
        fetcher: async () => new Response("hello", { headers: { "content-type": "text/plain" } }),
        transitFiles,
      },
    );

    expect(upload).toMatchObject({
      fileId: "file-1",
      name: "report.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
    });
    await expect(transitFiles.createdFiles[0]?.text()).resolves.toBe("hello");
  });
});

class MemoryTransitFiles implements TransitFileWriter {
  readonly createdFiles: File[] = [];
  readonly maxBytes: number;

  constructor(maxBytes: number) {
    this.maxBytes = maxBytes;
  }

  async create(file: File): Promise<{
    fileId: string;
    downloadUrl: string;
    sizeBytes: number;
    name: string;
    mimeType: string;
  }> {
    if (file.size > this.maxBytes) {
      throw new ProviderRequestError(413, "file too large");
    }
    this.createdFiles.push(file);
    return {
      fileId: `file-${this.createdFiles.length}`,
      downloadUrl: `http://localhost/files/${this.createdFiles.length}`,
      sizeBytes: file.size,
      name: file.name,
      mimeType: file.type,
    };
  }

  read(_fileId: string): Promise<TransitFileRead> {
    throw new Error("not implemented");
  }

  async delete(_fileId: string): Promise<boolean> {
    return false;
  }
}
