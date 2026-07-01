import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "gcloud_sts";

const rawCredentialSchema = s.looseObject(
  "The raw credential response returned by Google Cloud STS or IAM Credentials.",
);

const gcloudCredentialOutputSchema = s.actionOutput(
  {
    accessToken: s.string("The Google Cloud OAuth 2.0 access token."),
    tokenType: s.string("The token type returned by Google Cloud, usually Bearer."),
    expiration: s.string("The ISO timestamp when the access token expires."),
    scope: s.nullableString("The scopes attached to the returned access token."),
    issuedTokenType: s.nullableString("The issued token type returned by Google STS."),
    serviceAccountEmail: s.nullableString(
      "The impersonated Google Cloud service account email, if impersonation was used.",
    ),
    raw: rawCredentialSchema,
  },
  "The normalized Google Cloud access token.",
);

export const gcloudStsActions: ActionDefinition[] = [
  defineProviderAction(service, {
    name: "get_federated_access_token",
    description:
      "Describe the Google Cloud STS federated access token returned from a Workload Identity Federation credential lease.",
    inputSchema: s.object(
      "Input parameters for returning a Google Cloud federated access token.",
      {
        access_token_scopes: s.nonEmptyString(
          "The Google OAuth scopes requested for the access token. Defaults to https://www.googleapis.com/auth/cloud-platform.",
        ),
        service_account: s.nonEmptyString(
          "The Google Cloud service account email to impersonate after STS token exchange.",
        ),
        access_token_lifetime: s.nonEmptyString(
          "The optional service account access token lifetime, such as 3600s. Google Cloud defaults to 3600s.",
        ),
      },
      { optional: ["access_token_scopes", "service_account", "access_token_lifetime"] },
    ),
    outputSchema: gcloudCredentialOutputSchema,
  }),
];
