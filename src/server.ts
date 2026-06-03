import Anthropic from "@anthropic-ai/sdk";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { timingSafeEqual } from "crypto";
import { TRIATHLON_COACH_SYSTEM_PROMPT } from "./coach-prompt.js";
import { tools, executeTool } from "./tools.js";

const client = new Anthropic();

// In-memory session store (swap for Redis/DB in production)
const sessions = new Map<string, Anthropic.MessageParam[]>();

function getOrCreateSession(sessionId: string): Anthropic.MessageParam[] {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  return sessions.get(sessionId)!;
}

async function coachResponse(
  sessionId: string,
  userMessage: string
): Promise<string> {
  const messages = getOrCreateSession(sessionId);
  messages.push({ role: "user", content: userMessage });

  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: TRIATHLON_COACH_SYSTEM_PROMPT,
      thinking: { type: "adaptive" },
      tools,
      messages,
    });

    const textParts: string[] = [];
    const toolUseBlocks: Anthropic.ContentBlock[] = [];

    for (const block of response.content) {
      if (block.type === "text") textParts.push(block.text);
      else if (block.type === "tool_use") toolUseBlocks.push(block);
    }

    if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      messages.push({ role: "assistant", content: response.content });
      return textParts.join("\n");
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      if (block.type === "tool_use") {
        const result = executeTool(block.name, block.input as Record<string, unknown>);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }
}

// ── HTTP helpers ────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown, extraHeaders: Record<string, string> = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

// ── Basic Auth ──────────────────────────────────────────────────────

const AUTH_USER = process.env.BASIC_AUTH_USER;
const AUTH_PASS = process.env.BASIC_AUTH_PASS;
const AUTH_ENABLED = Boolean(AUTH_USER && AUTH_PASS);

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function isAuthorized(req: IncomingMessage): boolean {
  if (!AUTH_ENABLED) return true;
  const header = req.headers.authorization;
  if (!header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const colonIdx = decoded.indexOf(":");
  if (colonIdx < 0) return false;
  const user = decoded.slice(0, colonIdx);
  const pass = decoded.slice(colonIdx + 1);
  return safeEqual(user, AUTH_USER!) && safeEqual(pass, AUTH_PASS!);
}

function unauthorized(res: ServerResponse) {
  json(res, 401, { error: "Unauthorized" }, {
    "WWW-Authenticate": 'Basic realm="triathlon-coach"',
  });
}

// ── Server ──────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    json(res, 204, null);
    return;
  }

  if (!isAuthorized(req)) {
    unauthorized(res);
    return;
  }

  if (req.method === "POST" && req.url === "/chat") {
    try {
      const body = JSON.parse(await readBody(req));
      const sessionId: string = body.session_id || "default";
      const message: string = body.message;

      if (!message) {
        json(res, 400, { error: "message is required" });
        return;
      }

      const reply = await coachResponse(sessionId, message);
      json(res, 200, { reply, session_id: sessionId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Internal error";
      json(res, 500, { error: msg });
    }
    return;
  }

  if (req.method === "DELETE" && req.url?.startsWith("/session/")) {
    const sessionId = req.url.split("/session/")[1];
    sessions.delete(sessionId);
    json(res, 200, { deleted: sessionId });
    return;
  }

  json(res, 404, { error: "Not found. POST /chat with {message, session_id?}" });
});

const PORT = parseInt(process.env.PORT || "3000", 10);
server.listen(PORT, () => {
  console.log(`Triathlon Coach API running on http://localhost:${PORT}`);
  console.log(`Basic auth: ${AUTH_ENABLED ? "enabled" : "disabled (set BASIC_AUTH_USER + BASIC_AUTH_PASS)"}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /chat              { "message": "...", "session_id": "..." }`);
  console.log(`  DELETE /session/:id      Clear a session\n`);
});
