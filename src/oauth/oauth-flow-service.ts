import type { ConnectionService } from "../connections/connection-service.ts";
import type { ResolvedCredential } from "../core/types.ts";
import type { OAuthClientConfigService } from "./oauth-client-config-service.ts";

import { optionalString, requiredString } from "../core/cast.ts";

/**
 * Started OAuth authorization flow returned to the local console.
 */
export type OAuthAuthorizationStart = {
  authorizationUrl: string;
  state: string;
};

/**
 * Short-lived OAuth state stored while the browser completes authorization.
 */
export type OAuthAuthorizationState = {
  service: string;
  state: string;
  createdAt: string;
};

/**
 * Storage contract for pending OAuth authorization states.
 */
export interface IOAuthStateStore {
  set(state: OAuthAuthorizationState): Promise<void>;
  take(state: string): Promise<OAuthAuthorizationState | undefined>;
}

/**
 * Coordinates localhost OAuth authorization and token exchange.
 */
export class OAuthFlowService {
  private readonly clientConfigs: OAuthClientConfigService;
  private readonly connections: ConnectionService;
  private readonly states: IOAuthStateStore;

  constructor(input: {
    clientConfigs: OAuthClientConfigService;
    connections: ConnectionService;
    states: IOAuthStateStore;
  }) {
    this.clientConfigs = input.clientConfigs;
    this.connections = input.connections;
    this.states = input.states;
  }

  async startAuthorization(service: string): Promise<OAuthAuthorizationStart> {
    const auth = this.clientConfigs.getOAuthDefinition(service);
    const config = await this.clientConfigs.getConfig(service);
    if (!config) {
      throw new OAuthFlowError(
        "oauth_client_config_required",
        `Configure an OAuth client for ${service} first.`,
      );
    }

    const state = crypto.randomUUID();
    await this.states.set({
      service,
      state,
      createdAt: new Date().toISOString(),
    });

    const authorizationUrl = new URL(auth.authorizationUrl);
    authorizationUrl.searchParams.set("client_id", config.clientId);
    authorizationUrl.searchParams.set(
      "redirect_uri",
      this.clientConfigs.expectedRedirectUri(service),
    );
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("state", state);
    if (auth.scopes.length > 0) {
      authorizationUrl.searchParams.set("scope", auth.scopes.join(" "));
    }
    for (const [key, value] of Object.entries(auth.authorizationParams ?? {})) {
      authorizationUrl.searchParams.set(key, value);
    }

    return {
      authorizationUrl: authorizationUrl.toString(),
      state,
    };
  }

  async completeAuthorization(input: {
    state: string;
    code: string;
  }): Promise<{ service: string; connected: true }> {
    const pending = await this.states.take(input.state);
    if (!pending) {
      throw new OAuthFlowError("invalid_oauth_state", "OAuth state is missing or expired.");
    }

    const auth = this.clientConfigs.getOAuthDefinition(pending.service);
    const config = await this.clientConfigs.getConfig(pending.service);
    if (!config) {
      throw new OAuthFlowError(
        "oauth_client_config_required",
        `Configure an OAuth client for ${pending.service} first.`,
      );
    }

    const tokenResponse = await requestToken({
      code: input.code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: this.clientConfigs.expectedRedirectUri(pending.service),
      tokenEndpointAuthMethod: auth.tokenEndpointAuthMethod,
      tokenRequestFormat: auth.tokenRequestFormat,
      tokenUrl: auth.tokenUrl,
    });

    await this.connections.setOAuthCredential(pending.service, tokenResponse);
    return {
      service: pending.service,
      connected: true,
    };
  }
}

/**
 * Error with a stable code suitable for HTTP responses.
 */
export class OAuthFlowError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function requestToken(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEndpointAuthMethod: "client_secret_basic" | "client_secret_post" | "none";
  tokenRequestFormat?: "form" | "json";
  tokenUrl: string;
}): Promise<Extract<ResolvedCredential, { authType: "oauth2" }>> {
  const fields: Record<string, string> = {
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
  };
  const headers: Record<string, string> = {
    accept: "application/json",
  };
  let body: BodyInit;

  if (input.tokenEndpointAuthMethod === "client_secret_basic") {
    headers.authorization = `Basic ${btoa(`${input.clientId}:${input.clientSecret}`)}`;
  } else if (
    input.tokenEndpointAuthMethod === "client_secret_post" &&
    input.tokenRequestFormat !== "json"
  ) {
    fields.client_secret = input.clientSecret;
  }

  if (input.tokenRequestFormat === "json") {
    headers["content-type"] = "application/json";
    body = JSON.stringify(fields);
  } else {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(fields);
  }

  const response = await fetch(input.tokenUrl, {
    method: "POST",
    headers,
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new OAuthFlowError(
      "oauth_token_exchange_failed",
      typeof payload.error_description === "string"
        ? payload.error_description
        : "OAuth token exchange failed.",
    );
  }

  const accessToken = requiredString(
    payload.access_token,
    "access_token",
    (message) => new OAuthFlowError("oauth_token_exchange_failed", message),
  );
  const tokenType = optionalString(payload.token_type) ?? "Bearer";
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : undefined;
  return {
    authType: "oauth2",
    accessToken,
    tokenType,
    refreshToken: optionalString(payload.refresh_token),
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined,
    metadata: {
      rawTokenType: payload.token_type,
      scope: payload.scope,
    },
  };
}
