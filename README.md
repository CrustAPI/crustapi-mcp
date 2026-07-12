# CrustAPI MCP server

Give any MCP client (Claude Desktop, Cursor, Cline, Claude Code) live Google data. It calls
the hosted CrustAPI `/v1/search` endpoint.

## Tools

- **`search`** — the whole Google menu behind one tool. Pick the surface with `type`: `web`,
  `maps`, `places`, `news`, `shopping`, `images`, `videos`, `scholar`, `patents`, `autocomplete`.
- **`scrape_webpage`** — fetch any URL as clean text + metadata + JSON-LD (RAG-ready).
- **`get_reviews`** — Google reviews for a business (by `placeId`/`cid`/`fid` or a name query).

You only pay for successful results; empty results are free. Get a free key (3,000 credits/month,
no card) at **https://crustapi.com**.

## Quick start (recommended: npx, no install)

Add this to your MCP client config (e.g. Claude Desktop's `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "crustapi": {
      "command": "npx",
      "args": ["-y", "crustapi-mcp"],
      "env": { "CRUSTAPI_API_KEY": "key_live_xxxx" }
    }
  }
}
```

Restart the client and the three tools appear. Requires Node 18+.

## Run from source instead

```bash
npm install
```

```json
{
  "mcpServers": {
    "crustapi": {
      "command": "node",
      "args": ["/absolute/path/to/crustapi-mcp/server.mjs"],
      "env": { "CRUSTAPI_API_KEY": "key_live_xxxx" }
    }
  }
}
```

## Env

| var | purpose |
|---|---|
| `CRUSTAPI_API_KEY` | your CrustAPI key (sent as `x-api-key`) — **required** |
| `CRUSTAPI_BASE_URL` | defaults to `https://crustapi.com`; point at a local URL for testing |

## Examples an agent can run

- `search(type="web", q="best serp api 2026")`
- `search(type="maps", q="dentists", location="Miami, FL", limit=20)`
- `search(type="news", q="openai")`
- `scrape_webpage(url="https://example.com/pricing", includeMarkdown=true)`
- `get_reviews(q="Blue Bottle Coffee", sortBy="newest")`

Every response is stable, serper-compatible JSON.

## Test it

```bash
CRUSTAPI_API_KEY=key_live_xxxx node test-client.mjs
```

This spawns the server over stdio, lists the tools, and calls one.
