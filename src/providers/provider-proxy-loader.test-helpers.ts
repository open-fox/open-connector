import type { ResolvedCredential } from "../core/types.ts";

export function apiKeyCredential(apiKey: string, values: Record<string, string> = {}): ResolvedCredential {
  return {
    authType: "api_key",
    apiKey,
    values: {
      apiKey,
      ...values,
    },
    profile: {
      accountId: "api_key",
      displayName: "API Key",
      grantedScopes: [],
    },
    metadata: {},
  };
}
