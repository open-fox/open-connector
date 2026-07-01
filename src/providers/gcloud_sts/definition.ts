import type { ProviderDefinition } from "../../core/types.ts";

import { gcloudStsActions } from "./actions.ts";

const service = "gcloud_sts";

/**
 * Catalog-only Google Cloud STS provider.
 *
 * The source runtime requires a federated OIDC credential lease. The public
 * runtime has no local credential model for that lease, so no local executor is
 * registered for this action.
 */
export const provider: ProviderDefinition = {
  service,
  displayName: "Google Cloud STS",
  categories: ["Security", "Developer Tools"],
  authTypes: ["no_auth"],
  auth: [{ type: "no_auth" }],
  homepageUrl: "https://cloud.google.com/iam/docs/workload-identity-federation",
  actions: gcloudStsActions,
};
