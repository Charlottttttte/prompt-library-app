/**
 * A stand-in for OpenAI's /v1/chat/completions, used to verify the optimizer
 * without spending real tokens. It asserts the request shape the app sends and
 * replies with a schema-valid completion.
 *
 *   node scripts/mock-openai.mjs [port]
 *
 * Point the app at it with OPENAI_BASE_URL=http://localhost:<port>/v1 and any
 * non-empty OPENAI_API_KEY. Set MOCK_MODE to exercise failure paths:
 *   ok (default) | unauthorized | rate_limited | refusal | truncated | badjson
 */
import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? 4010);
const MODE = process.env.MOCK_MODE ?? "ok";

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function completion(message, finishReason = "stop") {
  return {
    id: "chatcmpl-mock",
    object: "chat.completion",
    model: "mock-model",
    choices: [{ index: 0, finish_reason: finishReason, message }],
  };
}

const server = createServer((req, res) => {
  if (!req.url?.endsWith("/chat/completions")) {
    return send(res, 404, { error: { message: "unexpected path" } });
  }

  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    // --- Assert the request the app actually sent ---------------------------
    const problems = [];
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      problems.push("missing or malformed Authorization: Bearer header");
    }

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      problems.push("body was not valid JSON");
      body = {};
    }

    if (!body.model) problems.push("no model");
    if (!Array.isArray(body.messages) || body.messages.length < 2) {
      problems.push("expected a system and a user message");
    } else {
      if (body.messages[0]?.role !== "system") problems.push("first message is not system");
      if (body.messages[1]?.role !== "user") problems.push("second message is not user");
    }

    const format = body.response_format;
    if (format?.type !== "json_schema") {
      problems.push("response_format.type is not json_schema");
    }
    if (format?.json_schema?.strict !== true) {
      problems.push("json_schema.strict is not true");
    }
    if (format?.json_schema?.schema?.additionalProperties !== false) {
      problems.push("schema does not set additionalProperties: false");
    }

    if (problems.length > 0) {
      console.error("REQUEST PROBLEMS:", problems.join("; "));
      return send(res, 400, { error: { message: problems.join("; ") } });
    }
    console.log(`ok: ${body.model}, ${body.messages.length} messages, strict schema`);

    // --- Reply --------------------------------------------------------------
    switch (MODE) {
      case "unauthorized":
        return send(res, 401, { error: { message: "invalid api key" } });
      case "rate_limited":
        return send(res, 429, { error: { message: "rate limit" } });
      case "refusal":
        return send(
          res,
          200,
          completion({ role: "assistant", content: null, refusal: "I can't help with that." }),
        );
      case "truncated":
        return send(
          res,
          200,
          completion({ role: "assistant", content: '{"optimized":"half a res' }, "length"),
        );
      case "badjson":
        return send(
          res,
          200,
          completion({ role: "assistant", content: "sorry, no json for you" }),
        );
      default: {
        const userText = body.messages[1].content;
        // Echo a placeholder back so the test can prove the real prompt text
        // reached the model rather than something hardcoded.
        const placeholder = userText.match(/\{\{(\w+)\}\}/)?.[0] ?? "";
        return send(
          res,
          200,
          completion({
            role: "assistant",
            refusal: null,
            content: JSON.stringify({
              optimized: `REWRITTEN by mock. Preserved placeholder: ${placeholder}`,
              changes: ["Tightened the ask", "Named the output format"],
            }),
          }),
        );
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`mock OpenAI listening on http://localhost:${PORT}/v1 (mode: ${MODE})`);
});
