import type { CatalogStore } from "../catalog-store.ts";
import type { IConnectionStore } from "../connections/connection-service.ts";
import type {
  ActionExecutor,
  CredentialValidators,
  ProviderDefinition,
  ResolvedCredential,
} from "../core/types.ts";
import type { IProviderLoader } from "../providers/provider-loader.ts";
import type { IOAuthClientConfigStore, OAuthClientConfig } from "./oauth-client-config-service.ts";
import type { IOAuthStateStore, OAuthAuthorizationState } from "./oauth-flow-service.ts";

import { describe, expect, it } from "vitest";
import { ConnectionService } from "../connections/connection-service.ts";
import { OAuthClientConfigService } from "./oauth-client-config-service.ts";
import { OAuthFlowService } from "./oauth-flow-service.ts";

const oauthProvider: ProviderDefinition = {
  service: "example",
  displayName: "Example",
  categories: ["Developer Tools"],
  authTypes: ["oauth2"],
  auth: [
    {
      type: "oauth2",
      authorizationUrl: "https://example.com/oauth/authorize",
      tokenUrl: "https://example.com/oauth/token",
      scopes: ["read", "write"],
      redirectPath: "/oauth/callback/example",
      tokenEndpointAuthMethod: "client_secret_post",
      clientConfigFields: [
        {
          key: "tenant",
          label: "Tenant",
          inputType: "text",
          required: true,
          secret: false,
        },
      ],
    },
  ],
  actions: [],
};

describe("OAuthFlowService", () => {
  it("builds an authorization URL from user-provided client config", async () => {
    const services = createServices([oauthProvider]);
    await services.clientConfigs.upsertConfig({
      service: "example",
      clientId: "client-id",
      clientSecret: "client-secret",
      extra: {
        tenant: " default ",
      },
    });

    await expect(services.clientConfigs.getConfig("example")).resolves.toMatchObject({
      extra: {
        tenant: "default",
      },
    });

    const started = await services.flow.startAuthorization("example");
    const authorizationUrl = new URL(started.authorizationUrl);

    expect(authorizationUrl.origin).toBe("https://example.com");
    expect(authorizationUrl.searchParams.get("client_id")).toBe("client-id");
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/oauth/callback/example",
    );
    expect(authorizationUrl.searchParams.get("scope")).toBe("read write");
    expect(authorizationUrl.searchParams.get("state")).toBe(started.state);
  });

  it("requires OAuth client config before authorization", async () => {
    const services = createServices([oauthProvider]);

    await expect(services.flow.startAuthorization("example")).rejects.toMatchObject({
      code: "oauth_client_config_required",
    });
  });

  it("requires declared OAuth client config fields", async () => {
    const services = createServices([oauthProvider]);

    await expect(
      services.clientConfigs.upsertConfig({
        service: "example",
        clientId: "client-id",
        clientSecret: "client-secret",
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "tenant is required.",
    });
  });
});

function createServices(providers: ProviderDefinition[]): {
  clientConfigs: OAuthClientConfigService;
  flow: OAuthFlowService;
} {
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

  return {
    clientConfigs,
    flow: new OAuthFlowService({
      clientConfigs,
      connections,
      states: new MemoryOAuthStateStore(),
    }),
  };
}

class EmptyProviderLoader implements IProviderLoader {
  async loadActionExecutor(
    _service: string,
    _actionId: string,
  ): Promise<ActionExecutor | undefined> {
    return undefined;
  }

  async loadCredentialValidators(_service: string): Promise<CredentialValidators | undefined> {
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
  private readonly states = new Map<string, OAuthAuthorizationState>();

  async set(state: OAuthAuthorizationState): Promise<void> {
    this.states.set(state.state, state);
  }

  async take(state: string): Promise<OAuthAuthorizationState | undefined> {
    const value = this.states.get(state);
    this.states.delete(state);
    return value;
  }
}
