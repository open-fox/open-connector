# Local HTTP Example

Start the local runtime:

```bash
npm run dev
```

If the runtime was started with `OOMOL_CONNECT_API_TOKEN`, set the same variable when running
examples.

Run a no-auth Hacker News action:

```bash
node examples/local-http/hackernews.ts
```

Run GitHub with a personal access token:

```bash
GITHUB_TOKEN=github_pat_... node examples/local-http/github.ts
```

Run Notion with an internal integration token. Share target pages or databases with the integration
first.

```bash
NOTION_TOKEN=secret_... node examples/local-http/notion.ts
```

Prepare Gmail OAuth with your own Google OAuth app:

```bash
GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node examples/local-http/gmail.ts
```

Configure the Google OAuth app redirect URI to:

```text
http://localhost:3000/oauth/callback/gmail
```

Open the printed authorization URL in a browser, finish consent, then execute Gmail actions through
the local API.
