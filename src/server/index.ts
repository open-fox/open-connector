import { serve } from "@hono/node-server";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { loadCatalog } from "../catalog-store.ts";
import { ConnectionService } from "../connections/connection-service.ts";
import { OAuthClientConfigService } from "../oauth/oauth-client-config-service.ts";
import { OAuthFlowService } from "../oauth/oauth-flow-service.ts";
import { ProviderLoader } from "../providers/provider-loader.ts";
import { ConnectServer } from "./connect-server.ts";
import {
  InMemoryConnectionStore,
  InMemoryOAuthClientConfigStore,
  InMemoryOAuthStateStore,
  InMemoryRunLogStore,
} from "./runtime-store.ts";

const port = Number(process.env.PORT ?? 3000);
const publicOrigin = process.env.OOMOL_CONNECT_ORIGIN ?? `http://localhost:${port}`;
const sourceRoot = join(process.cwd(), "web");
const builtRoot = join(process.cwd(), "dist/web");
const staticRoot = await resolveStaticRoot(builtRoot, sourceRoot);
const catalog = await loadCatalog();
const providerLoader = new ProviderLoader();
const connections = new ConnectionService({
  catalog,
  providerLoader,
  store: new InMemoryConnectionStore(),
});
const oauthClientConfigs = new OAuthClientConfigService({
  catalog,
  origin: publicOrigin,
  store: new InMemoryOAuthClientConfigStore(),
});
const app = new ConnectServer({
  catalog,
  providerLoader,
  connections,
  oauthClientConfigs,
  oauthFlow: new OAuthFlowService({
    clientConfigs: oauthClientConfigs,
    connections,
    states: new InMemoryOAuthStateStore(),
  }),
  runs: new InMemoryRunLogStore(),
  staticRoot,
}).createApp();

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`connect server listening on http://localhost:${info.port}`);
  },
);

async function resolveStaticRoot(primary: string, fallback: string): Promise<string> {
  try {
    await access(join(primary, "index.html"));
    return primary;
  } catch {
    return fallback;
  }
}
