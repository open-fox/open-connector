import type { CatalogStore } from "../catalog-store.ts";
import type {
  ActionExecutor,
  CredentialValidators,
  ProviderDefinition,
  ResolvedCredential,
} from "../core/types.ts";
import type { IProviderLoader } from "../providers/provider-loader.ts";
import type { IConnectionStore } from "./connection-service.ts";

import { describe, expect, it } from "vitest";
import { ConnectionService } from "./connection-service.ts";

const hackernewsProvider: ProviderDefinition = {
  service: "hackernews",
  displayName: "Hacker News",
  categories: ["Social"],
  authTypes: ["no_auth"],
  auth: [{ type: "no_auth" }],
  actions: [],
};

const apiKeyProvider: ProviderDefinition = {
  service: "uptimerobot",
  displayName: "UptimeRobot",
  categories: ["Developer Tools"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "API Key",
      extraFields: [
        {
          key: "accountId",
          label: "Account ID",
          inputType: "text",
          required: true,
          secret: false,
        },
      ],
    },
  ],
  actions: [],
};

const customCredentialProvider: ProviderDefinition = {
  service: "database",
  displayName: "Database",
  categories: ["Developer Tools"],
  authTypes: ["custom_credential"],
  auth: [
    {
      type: "custom_credential",
      fields: [
        {
          key: "host",
          label: "Host",
          inputType: "text",
          required: true,
          secret: false,
        },
        {
          key: "password",
          label: "Password",
          inputType: "password",
          required: true,
          secret: true,
        },
      ],
    },
  ],
  actions: [],
};

describe("ConnectionService", () => {
  it("exposes no_auth providers as virtual connections", async () => {
    const service = createService([hackernewsProvider]);

    await expect(service.getCredential("hackernews")).resolves.toEqual({ authType: "no_auth" });
    await expect(service.listConnections()).resolves.toEqual([
      {
        service: "hackernews",
        authType: "no_auth",
        configured: true,
        virtual: true,
      },
    ]);
  });

  it("stores API key credentials as resolved credentials", async () => {
    const service = createService([apiKeyProvider]);

    await service.connectWithApiKey("uptimerobot", {
      values: {
        apiKey: " test-key ",
        accountId: " account-1 ",
      },
    });

    await expect(service.getCredential("uptimerobot")).resolves.toMatchObject({
      authType: "api_key",
      apiKey: "test-key",
      values: {
        apiKey: "test-key",
        accountId: "account-1",
      },
    });
  });

  it("requires declared API key extra fields", async () => {
    const service = createService([apiKeyProvider]);

    await expect(
      service.connectWithApiKey("uptimerobot", {
        values: {
          apiKey: "test-key",
        },
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "accountId is required.",
    });
  });

  it("rejects undeclared API key fields", async () => {
    const service = createService([apiKeyProvider]);

    await expect(
      service.connectWithApiKey("uptimerobot", {
        values: {
          apiKey: "test-key",
          accountId: "account-1",
          region: "us",
        },
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "Unexpected credential field: region.",
    });
  });

  it("requires declared custom credential fields", async () => {
    const service = createService([customCredentialProvider]);

    await expect(
      service.connectWithCustomCredential("database", {
        values: {
          host: "localhost",
        },
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "password is required.",
    });
  });

  it("stores custom credential values after trimming declared fields", async () => {
    const service = createService([customCredentialProvider]);

    await service.connectWithCustomCredential("database", {
      values: {
        host: " localhost ",
        password: " secret ",
      },
    });

    await expect(service.getCredential("database")).resolves.toMatchObject({
      authType: "custom_credential",
      values: {
        host: "localhost",
        password: "secret",
      },
    });
  });

  it("verifies credentials before storing them when a provider exposes a validator", async () => {
    const validators: CredentialValidators = {
      async apiKey(input) {
        if (input.apiKey !== "valid-key") {
          throw new Error("invalid key");
        }
        return { metadata: { checked: true } };
      },
    };
    const service = createService([apiKeyProvider], new FakeProviderLoader(validators));

    await expect(
      service.connectWithApiKey("uptimerobot", {
        values: {
          apiKey: "bad-key",
          accountId: "account-1",
        },
      }),
    ).rejects.toMatchObject({
      code: "credential_verification_failed",
      message: "invalid key",
    });
    await expect(service.getCredential("uptimerobot")).resolves.toBeUndefined();

    await service.connectWithApiKey("uptimerobot", {
      values: {
        apiKey: "valid-key",
        accountId: "account-1",
      },
    });
    await expect(service.getCredential("uptimerobot")).resolves.toMatchObject({
      authType: "api_key",
      apiKey: "valid-key",
      metadata: { checked: true },
    });
  });
});

function createService(
  providers: ProviderDefinition[],
  providerLoader: IProviderLoader = new FakeProviderLoader(),
): ConnectionService {
  const catalog: CatalogStore = {
    providers,
    actions: [],
    actionsById: new Map(),
  };

  return new ConnectionService({
    catalog,
    providerLoader,
    store: new MemoryConnectionStore(),
  });
}

class FakeProviderLoader implements IProviderLoader {
  private readonly validators?: CredentialValidators;

  constructor(validators?: CredentialValidators) {
    this.validators = validators;
  }

  async loadActionExecutor(
    _service: string,
    _actionId: string,
  ): Promise<ActionExecutor | undefined> {
    return undefined;
  }

  async loadCredentialValidators(_service: string): Promise<CredentialValidators | undefined> {
    return this.validators;
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
    return [...this.store.entries()].map(([service, credential]) => ({
      service,
      credential,
    }));
  }
}
