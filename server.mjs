#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// The CrustAPI MCP server lets an AI agent (Claude Desktop, Cursor, Cline, etc.) pull live
// Google data (Search, Maps, News, Shopping, Images, Videos, Reviews, Scholar, Patents,
// Autocomplete, raw web-page scrapes) AND public LinkedIn data (profiles, companies, posts,
// jobs, people search) natively through one hosted HTTP endpoint.
// Auth: set CRUSTAPI_API_KEY (get a free key at https://crustapi.com). You only pay for
// successful results; empty results are free.
const BASE = (process.env.CRUSTAPI_BASE_URL || "https://crustapi.com").replace(/\/+$/, "");
const KEY = process.env.CRUSTAPI_API_KEY || "";

const server = new McpServer({
  name: "crustapi",
  version: "0.3.0",
  description:
    "Live Google and public LinkedIn data for AI agents via CrustAPI. Use this server whenever a task needs current " +
    "search results, local business data, news, shopping listings, images, videos, Google reviews, scholar or patent " +
    "results, query suggestions, the readable text of a web page, or public LinkedIn profiles, companies, posts, jobs, " +
    "and people search. Every tool returns stable structured JSON, and only successful results cost credits.",
});

// ---- Shared caller: build the query, hit /v1/search, return the raw JSON for the agent to parse ----
async function callCrust(params, path = "/v1/search") {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    sp.set(k, String(v));
  }
  if (!KEY) {
    return {
      content: [{ type: "text", text: "No CrustAPI key set. Get a free key at https://crustapi.com and set the CRUSTAPI_API_KEY environment variable." }],
      isError: true,
    };
  }
  let res;
  try {
    res = await fetch(`${BASE}${path}?${sp.toString()}`, { headers: { "x-api-key": KEY } });
  } catch (err) {
    return { content: [{ type: "text", text: `Could not reach CrustAPI: ${String(err)}` }], isError: true };
  }
  const text = await res.text();
  if (!res.ok) {
    return { content: [{ type: "text", text: `CrustAPI error ${res.status}: ${text.slice(0, 800)}` }], isError: true };
  }
  // Return the raw JSON as text plus parsed structuredContent: every type returns a stable,
  // serper-compatible shape the agent can read directly.
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { content: [{ type: "text", text }], structuredContent: parsed };
}

// ---- 1) search: the whole Google menu behind one tool, pick the surface with `type` ----
server.registerTool(
  "search",
  {
    title: "Search Google (any surface)",
    description:
      "Search any Google surface via CrustAPI and get clean, structured JSON. Choose the surface with `type`: " +
      "web (organic results), maps (local businesses with ratings/phone/website), places (lean local pack), " +
      "news, shopping, images, videos, scholar, patents, or autocomplete (query suggestions). " +
      "Results come back in a stable, serper-compatible shape. One credit per successful result; empty results are free.",
    annotations: { readOnlyHint: true, openWorldHint: true },
    outputSchema: {
      searchParameters: z.record(z.any()).optional().describe("Echo of the query that was run."),
      organic: z.array(z.record(z.any())).optional().describe("Organic results (web, scholar, patents)."),
      places: z.array(z.record(z.any())).optional().describe("Businesses with ratings, phone, website (maps, places)."),
      news: z.array(z.record(z.any())).optional().describe("News articles with source, date, and image (news)."),
      shopping: z.array(z.record(z.any())).optional().describe("Products with price and merchant (shopping)."),
      images: z.array(z.record(z.any())).optional().describe("Images with direct URLs (images)."),
      videos: z.array(z.record(z.any())).optional().describe("Videos with direct thumbnails (videos)."),
      suggestions: z.array(z.any()).optional().describe("Query suggestions (autocomplete)."),
      answerBox: z.record(z.any()).optional().describe("Featured answer when Google shows one."),
      knowledgeGraph: z.record(z.any()).optional().describe("Knowledge panel when Google shows one."),
      peopleAlsoAsk: z.array(z.record(z.any())).optional().describe("Related questions (web)."),
      relatedSearches: z.array(z.record(z.any())).optional().describe("Related queries (web)."),
      credits: z.number().optional().describe("Credits charged for this call."),
    },
    inputSchema: {
      type: z
        .enum(["web", "maps", "places", "news", "shopping", "images", "videos", "scholar", "patents", "autocomplete"])
        .describe("Which Google surface to query."),
      q: z.string().describe("The search query, e.g. 'best crm software' or 'dentists in miami'."),
      gl: z.string().optional().describe("Country code (us, gb, de, ...). Default us. Not used by maps."),
      hl: z.string().optional().describe("Language code (en, es, ...). Default en."),
      page: z.number().int().min(1).optional().describe("Result page (default 1)."),
      location: z.string().optional().describe("City/region for web and maps, e.g. 'Austin, TX'."),
      limit: z.number().int().min(1).max(100).optional().describe("type=maps only: how many businesses to return (default 20; 1 credit each)."),
    },
  },
  async (args) => callCrust(args),
);

// ---- 2) scrape_webpage: fetch any URL as clean text + metadata + JSON-LD (RAG-ready) ----
server.registerTool(
  "scrape_webpage",
  {
    title: "Scrape a web page",
    description:
      "Fetch any URL and get back clean readable text, page metadata, and JSON-LD, ready for RAG. " +
      "One credit per successful scrape; a failed fetch is free.",
    annotations: { readOnlyHint: true, openWorldHint: true },
    outputSchema: {
      url: z.string().optional().describe("The scraped URL."),
      title: z.string().optional().describe("Page title."),
      text: z.string().optional().describe("Clean readable text of the page."),
      markdown: z.string().optional().describe("Page as Markdown, when includeMarkdown=true."),
      metadata: z.record(z.any()).optional().describe("Page metadata (og tags, description, author)."),
      jsonLd: z.array(z.record(z.any())).optional().describe("Structured JSON-LD found on the page."),
      credits: z.number().optional().describe("Credits charged for this call."),
    },
    inputSchema: {
      url: z.string().url().describe("The page URL to scrape, e.g. 'https://example.com/article'."),
      includeMarkdown: z.boolean().optional().describe("Also return the page rendered as Markdown."),
    },
  },
  async ({ url, includeMarkdown }) => callCrust({ type: "webpage", url, includeMarkdown }),
);

// ---- 3) get_reviews: Google reviews for a business (by place id or name) ----
server.registerTool(
  "get_reviews",
  {
    title: "Get Google reviews for a place",
    description:
      "Get Google reviews for a business. Identify the place by placeId, cid, or fid, or just pass a business-name " +
      "query `q` and CrustAPI resolves it. Supports sorting and pagination. One credit per successful call.",
    annotations: { readOnlyHint: true, openWorldHint: true },
    outputSchema: {
      place: z.record(z.any()).optional().describe("The resolved place (name, address, rating)."),
      reviews: z.array(z.record(z.any())).optional().describe("Reviews with rating, text, author, and date."),
      nextPageToken: z.string().optional().describe("Cursor for the next page of reviews."),
      credits: z.number().optional().describe("Credits charged for this call."),
    },
    inputSchema: {
      q: z.string().optional().describe("Business name to resolve to a place (use this OR placeId/cid/fid)."),
      placeId: z.string().optional().describe("Google place id (ChIJ...)."),
      cid: z.string().optional().describe("Google customer id."),
      fid: z.string().optional().describe("Google feature id (0x..:0x..)."),
      sortBy: z.enum(["mostRelevant", "newest", "highest", "lowest"]).optional().describe("Review sort order (default mostRelevant)."),
      num: z.number().int().min(1).max(50).optional().describe("Reviews per page (default 20, max 50)."),
      nextPageToken: z.string().optional().describe("Cursor from a previous response to fetch the next page."),
    },
  },
  async (args) => callCrust({ type: "reviews", ...args }),
);

// ---- 4) linkedin: public LinkedIn data (profiles, companies, posts, jobs, people) behind one tool ----
server.registerTool(
  "linkedin",
  {
    title: "Get LinkedIn data (profiles, companies, posts, jobs, people)",
    description:
      "Get public LinkedIn data via CrustAPI as clean structured JSON. Choose the surface with `type`: " +
      "profile (a person's full public profile by URL, with work history, education, and a verified business email when findable), " +
      "company (company details by URL), posts (recent posts from a profile or company URL), " +
      "jobs (search listings by keywords + optional location, or one job's full detail by URL), or " +
      "search (find people by keywords; add enrich=true to return each person's full profile). " +
      "One credit per successful result; empty results are free.",
    annotations: { readOnlyHint: true, openWorldHint: true },
    outputSchema: {
      profile: z.record(z.any()).optional().describe("A public profile (type=profile)."),
      company: z.record(z.any()).optional().describe("Company details (type=company)."),
      posts: z.array(z.record(z.any())).optional().describe("Recent posts (type=posts)."),
      jobs: z.array(z.record(z.any())).optional().describe("Job listings, or one job's detail (type=jobs)."),
      people: z.array(z.record(z.any())).optional().describe("People results (type=search)."),
      creditsRemaining: z.number().optional().describe("Credits left after this call."),
    },
    inputSchema: {
      type: z.enum(["profile", "company", "posts", "jobs", "search"]).describe("Which LinkedIn surface to query."),
      url: z.string().optional().describe("A linkedin.com/in/ or /company/ URL (profile, company, posts), or a job URL (jobs)."),
      keywords: z.string().optional().describe("Search keywords (jobs, search)."),
      location: z.string().optional().describe("Location filter for job search (jobs)."),
      enrich: z.boolean().optional().describe("type=search: also fetch each person's full profile (1 credit per profile)."),
      employees: z.boolean().optional().describe("type=company: also return a sample of employees."),
      comments: z.boolean().optional().describe("type=posts: also return per-post comment counts."),
      limit: z.number().int().min(1).max(100).optional().describe("Max results (posts, jobs, search)."),
    },
  },
  async (args) => callCrust(args, "/v1/linkedin"),
);

const transport = new StdioServerTransport();
await server.connect(transport);
// stdout is the JSON-RPC channel, so all logs must go to stderr.
console.error("crustapi MCP server running on stdio (tools: search, scrape_webpage, get_reviews, linkedin)");
