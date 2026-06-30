import type { CatalogStore } from "../catalog-store.ts";
import type {
  ApiKeyAuthDefinition,
  AuthType,
  CredentialDefinition,
  CustomCredentialAuthDefinition,
  ProviderDefinition,
  ResolvedCredential,
} from "../core/types.ts";
import type { IProviderLoader } from "../providers/provider-loader.ts";

import { normalizeCredentialValues } from "../core/credential-fields.ts";

/**
 * Connection summary returned to the local console.
 */
export type ConnectionSummary = {
  service: string;
  authType: AuthType;
  configured: boolean;
  virtual: boolean;
};

/**
 * Request body for local credential connections.
 */
export type ConnectWithCredentialInput = {
  values?: Record<string, unknown>;
};

/**
 * Storage contract for local provider connections.
 */
export interface IConnectionStore {
  get(service: string): Promise<ResolvedCredential | undefined>;
  set(service: string, credential: ResolvedCredential): Promise<void>;
  delete(service: string): Promise<void>;
  list(): Promise<Array<{ service: string; credential: ResolvedCredential }>>;
}

/**
 * Coordinates local provider connection state.
 *
 * No-auth providers are treated as virtual connections so open-source users can
 * run public actions without configuration.
 */
export class ConnectionService {
  private readonly catalog: CatalogStore;
  private readonly providerLoader: IProviderLoader;
  private readonly store: IConnectionStore;

  constructor(input: {
    catalog: CatalogStore;
    providerLoader: IProviderLoader;
    store: IConnectionStore;
  }) {
    this.catalog = input.catalog;
    this.providerLoader = input.providerLoader;
    this.store = input.store;
  }

  async listConnections(): Promise<ConnectionSummary[]> {
    const configured = new Map(
      (await this.store.list()).map((connection) => [connection.service, connection.credential]),
    );

    return this.catalog.providers
      .map((provider) => this.toConnectionSummary(provider, configured.get(provider.service)))
      .filter((summary): summary is ConnectionSummary => summary != null);
  }

  async getCredential(service: string): Promise<ResolvedCredential | undefined> {
    const provider = this.getProvider(service);
    const stored = await this.store.get(service);
    if (stored) {
      return stored;
    }

    return this.supportsAuth(provider, "no_auth") ? { authType: "no_auth" } : undefined;
  }

  async connectWithoutAuth(service: string): Promise<ConnectionSummary> {
    const provider = this.getProvider(service);
    if (!this.supportsAuth(provider, "no_auth")) {
      throw new ConnectionError("unsupported_auth_type", `${service} does not support no_auth.`);
    }

    return {
      service,
      authType: "no_auth",
      configured: true,
      virtual: true,
    };
  }

  async connectWithApiKey(
    service: string,
    input: ConnectWithCredentialInput,
  ): Promise<ConnectionSummary> {
    const provider = this.getProvider(service);
    if (!this.supportsAuth(provider, "api_key")) {
      throw new ConnectionError("unsupported_auth_type", `${service} does not support api_key.`);
    }

    const auth = this.getApiKeyDefinition(provider);
    const values = normalizeCredentialValues({
      fields: createApiKeyFields(auth),
      values: input.values ?? {},
      createError: (message) => new ConnectionError("invalid_input", message),
    });
    const apiKey = values.apiKey;

    const credential: ResolvedCredential = {
      authType: "api_key",
      apiKey,
      values,
      metadata: await this.validateApiKeyCredential(service, { apiKey, values }),
    };
    await this.store.set(service, credential);

    return {
      service,
      authType: "api_key",
      configured: true,
      virtual: false,
    };
  }

  async connectWithCustomCredential(
    service: string,
    input: ConnectWithCredentialInput,
  ): Promise<ConnectionSummary> {
    const provider = this.getProvider(service);
    if (!this.supportsAuth(provider, "custom_credential")) {
      throw new ConnectionError(
        "unsupported_auth_type",
        `${service} does not support custom_credential.`,
      );
    }

    const auth = this.getCustomCredentialDefinition(provider);
    const values = normalizeCredentialValues({
      fields: auth.fields,
      values: input.values ?? {},
      createError: (message) => new ConnectionError("invalid_input", message),
    });
    const credential: ResolvedCredential = {
      authType: "custom_credential",
      values,
      metadata: await this.validateCustomCredential(service, { values }),
    };
    await this.store.set(service, credential);

    return {
      service,
      authType: "custom_credential",
      configured: true,
      virtual: false,
    };
  }

  async setOAuthCredential(
    service: string,
    credential: Extract<ResolvedCredential, { authType: "oauth2" }>,
  ): Promise<ConnectionSummary> {
    const provider = this.getProvider(service);
    if (!this.supportsAuth(provider, "oauth2")) {
      throw new ConnectionError("unsupported_auth_type", `${service} does not support oauth2.`);
    }

    await this.store.set(service, {
      ...credential,
      metadata: {
        ...credential.metadata,
        ...(await this.validateOAuthCredential(service, credential)),
      },
    });
    return {
      service,
      authType: "oauth2",
      configured: true,
      virtual: false,
    };
  }

  async disconnect(
    service: string,
  ): Promise<ConnectionSummary | { service: string; configured: false }> {
    await this.store.delete(service);
    const provider = this.catalog.providers.find((provider) => provider.service === service);
    if (provider && this.supportsAuth(provider, "no_auth")) {
      return this.connectWithoutAuth(service);
    }

    return { service, configured: false };
  }

  private toConnectionSummary(
    provider: ProviderDefinition,
    credential: ResolvedCredential | undefined,
  ): ConnectionSummary | undefined {
    if (credential) {
      return {
        service: provider.service,
        authType: credential.authType,
        configured: true,
        virtual: false,
      };
    }

    if (this.supportsAuth(provider, "no_auth")) {
      return {
        service: provider.service,
        authType: "no_auth",
        configured: true,
        virtual: true,
      };
    }

    return undefined;
  }

  private getProvider(service: string): ProviderDefinition {
    const provider = this.catalog.providers.find((provider) => provider.service === service);
    if (!provider) {
      throw new ConnectionError("unknown_service", `Unknown service: ${service}.`);
    }

    return provider;
  }

  private supportsAuth(provider: ProviderDefinition, authType: AuthType): boolean {
    return provider.authTypes.includes(authType);
  }

  private getApiKeyDefinition(provider: ProviderDefinition): ApiKeyAuthDefinition {
    const auth = provider.auth.find((auth) => auth.type === "api_key");
    if (!auth || auth.type !== "api_key") {
      throw new ConnectionError(
        "unsupported_auth_type",
        `${provider.service} does not support api_key.`,
      );
    }

    return auth;
  }

  private getCustomCredentialDefinition(
    provider: ProviderDefinition,
  ): CustomCredentialAuthDefinition {
    const auth = provider.auth.find((auth) => auth.type === "custom_credential");
    if (!auth || auth.type !== "custom_credential") {
      throw new ConnectionError(
        "unsupported_auth_type",
        `${provider.service} does not support custom_credential.`,
      );
    }

    return auth;
  }

  private async validateApiKeyCredential(
    service: string,
    input: { apiKey: string; values: Record<string, string> },
  ): Promise<Record<string, unknown>> {
    const validators = await this.providerLoader.loadCredentialValidators(service);
    return this.runCredentialValidator(service, () =>
      validators?.apiKey?.(input, { fetcher: fetch }),
    );
  }

  private async validateCustomCredential(
    service: string,
    input: { values: Record<string, string> },
  ): Promise<Record<string, unknown>> {
    const validators = await this.providerLoader.loadCredentialValidators(service);
    return this.runCredentialValidator(service, () =>
      validators?.customCredential?.(input, { fetcher: fetch }),
    );
  }

  private async validateOAuthCredential(
    service: string,
    credential: Extract<ResolvedCredential, { authType: "oauth2" }>,
  ): Promise<Record<string, unknown>> {
    const validators = await this.providerLoader.loadCredentialValidators(service);
    return this.runCredentialValidator(service, () =>
      validators?.oauth2?.(credential, { fetcher: fetch }),
    );
  }

  private async runCredentialValidator(
    service: string,
    validate: () => Promise<{ metadata?: Record<string, unknown> } | void> | undefined,
  ): Promise<Record<string, unknown>> {
    try {
      return (await validate())?.metadata ?? {};
    } catch (error) {
      throw new ConnectionError(
        "credential_verification_failed",
        error instanceof Error ? error.message : `${service} credential verification failed.`,
      );
    }
  }
}

function createApiKeyFields(auth: ApiKeyAuthDefinition): CredentialDefinition[] {
  return [
    {
      key: "apiKey",
      label: auth.label ?? "API key",
      inputType: "password",
      required: true,
      secret: true,
      placeholder: auth.placeholder,
      description: auth.description,
    },
    ...(auth.extraFields ?? []),
  ];
}

/**
 * Error with a stable code suitable for HTTP responses.
 */
export class ConnectionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
