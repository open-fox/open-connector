// GitHub REST API docs: https://docs.github.com/en/rest

import { localHeaders } from "./client.ts";

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.log("Set GITHUB_TOKEN to run this example.");
  process.exit(0);
}

await fetch("http://localhost:3000/api/connections/github/api-key", {
  method: "PUT",
  headers: localHeaders({ "content-type": "application/json" }),
  body: JSON.stringify({ values: { apiKey: token } }),
});

const response = await fetch("http://localhost:3000/api/actions/github.get_authenticated_user/execute", {
  method: "POST",
  headers: localHeaders({ "content-type": "application/json" }),
  body: JSON.stringify({ input: {} }),
});

console.log(JSON.stringify(await response.json(), null, 2));
