# OpenAI Tools Example

These examples convert the local action catalog into OpenAI function tools.

Start the local runtime:

```bash
npm run dev
```

If the runtime was started with `OOMOL_CONNECT_API_TOKEN`, set the same variable when running
examples.

Print the tool definitions sent to the OpenAI Responses API:

```bash
node examples/openai-tools/list-tools.ts
```

Run a Hacker News tool call loop through the OpenAI Responses API:

```bash
OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-... node examples/openai-tools/run-hackernews.ts
```
