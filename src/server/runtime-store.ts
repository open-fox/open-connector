import type { IConnectionStore } from "../connections/connection-service.ts";
import type { ResolvedCredential } from "../core/types.ts";
import type {
  IOAuthClientConfigStore,
  OAuthClientConfig,
} from "../oauth/oauth-client-config-service.ts";
import type { IOAuthStateStore, OAuthAuthorizationState } from "../oauth/oauth-flow-service.ts";

/**
 * One recent action run shown by the local runtime.
 */
export type RunLog = {
  id: string;
  actionId: string;
  startedAt: string;
  completedAt: string;
  ok: boolean;
};

/**
 * In-memory connection store for the local bootstrap runtime.
 */
export class InMemoryConnectionStore implements IConnectionStore {
  private readonly credentials = new Map<string, ResolvedCredential>();

  async get(service: string): Promise<ResolvedCredential | undefined> {
    return this.credentials.get(service);
  }

  async set(service: string, credential: ResolvedCredential): Promise<void> {
    this.credentials.set(service, credential);
  }

  async delete(service: string): Promise<void> {
    this.credentials.delete(service);
  }

  async list(): Promise<Array<{ service: string; credential: ResolvedCredential }>> {
    return [...this.credentials.entries()].map(([service, credential]) => ({
      service,
      credential,
    }));
  }
}

/**
 * In-memory OAuth client config store for user-provided local OAuth apps.
 */
export class InMemoryOAuthClientConfigStore implements IOAuthClientConfigStore {
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

/**
 * In-memory OAuth state store for localhost authorization callbacks.
 */
export class InMemoryOAuthStateStore implements IOAuthStateStore {
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

/**
 * Storage contract for recent action run logs.
 */
export interface IRunLogStore {
  add(run: RunLog): void;
  list(): RunLog[];
}

/**
 * Bounded in-memory run log store.
 */
export class InMemoryRunLogStore implements IRunLogStore {
  private readonly runs: RunLog[] = [];
  private readonly limit: number;

  constructor(limit = 50) {
    this.limit = limit;
  }

  add(run: RunLog): void {
    this.runs.unshift(run);
    this.runs.splice(this.limit);
  }

  list(): RunLog[] {
    return this.runs;
  }
}
