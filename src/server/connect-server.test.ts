import type { CatalogStore } from "../catalog-store.ts";
import type { IConnectionStore } from "../connections/connection-service.ts";
import type { ProviderDefinition, ResolvedCredential } from "../core/types.ts";
import type {
  IOAuthClientConfigStore,
  OAuthClientConfig,
} from "../oauth/oauth-client-config-service.ts";
import type { IOAuthStateStore, OAuthAuthorizationState } from "../oauth/oauth-flow-service.ts";
import type { IProviderLoader } from "../providers/provider-loader.ts";
import type { IRunLogStore, RunLog } from "./runtime-store.ts";

import { describe, expect, it } from "vitest";
import { ConnectionService } from "../connections/connection-service.ts";
import { OAuthClientConfigService } from "../oauth/oauth-client-config-service.ts";
import { OAuthFlowService } from "../oauth/oauth-flow-service.ts";
import { ConnectServer } from "./connect-server.ts";

const apiKeyProvider: ProviderDefinition = {
  service: "example",
  displayName: "Example",
  categories: ["Developer Tools"],
  authTypes: ["api_key"],
  auth: [{ type: "api_key" }],
  actions: [],
};

describe("ConnectServer", () => {
  it("serves catalog and standard connection errors without opening a port", async () => {
    const app = createTestServer([apiKeyProvider]).createApp();

    const catalogResponse = await app.request("/api/apps/example");
    await expect(catalogResponse.json()).resolves.toMatchObject({
      service: "example",
      displayName: "Example",
    });

    const connectionResponse = await app.request("/api/connections/example/api-key", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values: {} }),
    });

    expect(connectionResponse.status).toBe(400);
    await expect(connectionResponse.json()).resolves.toEqual({
      error: {
        code: "invalid_input",
        message: "apiKey is required.",
      },
    });
  });
});

function createTestServer(providers: ProviderDefinition[]): ConnectServer {
  const catalog: CatalogStore = {
    providers,
    actions: [],
    actionsById: new Map(),
  };
  const connections = new ConnectionService({
    catalog,
    providerLoader: new EmptyProviderLoader(),
    store: new MemoryConnectionStore(),
  });
  const clientConfigs = new OAuthClientConfigService({
    catalog,
    origin: "http://localhost:3000",
    store: new MemoryOAuthClientConfigStore(),
  });

  return new ConnectServer({
    catalog,
    providerLoader: new EmptyProviderLoader(),
    connections,
    oauthClientConfigs: clientConfigs,
    oauthFlow: new OAuthFlowService({
      clientConfigs,
      connections,
      states: new MemoryOAuthStateStore(),
    }),
    runs: new MemoryRunLogStore(),
    staticRoot: ".tmp/test-static",
  });
}

class EmptyProviderLoader implements IProviderLoader {
  async loadActionExecutor(): Promise<never> {
    throw new Error("No actions are available in this test.");
  }

  async loadCredentialValidators(): Promise<undefined> {
    return undefined;
  }
}

class MemoryConnectionStore implements IConnectionStore {
  private readonly store = new Map<string, ResolvedCredential>();

  async get(service: string): Promise<ResolvedCredential | undefined> {
    return this.store.get(service);
  }

  async set(service: string, credential: ResolvedCredential): Promise<void> {
    this.store.set(service, credential);
  }

  async delete(service: string): Promise<void> {
    this.store.delete(service);
  }

  async list(): Promise<Array<{ service: string; credential: ResolvedCredential }>> {
    return [...this.store.entries()].map(([service, credential]) => ({ service, credential }));
  }
}

class MemoryOAuthClientConfigStore implements IOAuthClientConfigStore {
  private readonly configs = new Map<string, OAuthClientConfig>();

  async get(service: string): Promise<OAuthClientConfig | undefined> {
    return this.configs.get(service);
  }

  async set(config: OAuthClientConfig): Promise<void> {
    this.configs.set(config.service, config);
  }

  async delete(service: string): Promise<void> {
    this.configs.delete(service);
  }

  async list(): Promise<OAuthClientConfig[]> {
    return [...this.configs.values()];
  }
}

class MemoryOAuthStateStore implements IOAuthStateStore {
  async set(_state: OAuthAuthorizationState): Promise<void> {}

  async take(_state: string): Promise<OAuthAuthorizationState | undefined> {
    return undefined;
  }
}

class MemoryRunLogStore implements IRunLogStore {
  private readonly runs: RunLog[] = [];

  add(run: RunLog): void {
    this.runs.unshift(run);
  }

  list(): RunLog[] {
    return this.runs;
  }
}
