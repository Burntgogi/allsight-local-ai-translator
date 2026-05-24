const test = require("node:test");
const assert = require("node:assert/strict");

test("normalizes OpenAI-compatible local LLM base URLs", async () => {
  const localLlm = await import("../src/local-llm.js");

  assert.equal(
    localLlm.normalizeLocalLlmBaseUrl(" http://localhost:1234/v1/ "),
    "http://localhost:1234/v1"
  );
  assert.equal(
    localLlm.buildLocalLlmUrl("http://localhost:1234/v1", "models"),
    "http://localhost:1234/v1/models"
  );
  assert.equal(
    localLlm.buildLocalLlmUrl("http://localhost:1234/v1/", "chat/completions"),
    "http://localhost:1234/v1/chat/completions"
  );
});

test("prioritizes /v1 OpenAI-compatible URLs when a root server URL is provided", async () => {
  const localLlm = await import("../src/local-llm.js");

  assert.deepEqual(
    localLlm.buildLocalLlmCandidateUrls("http://192.0.2.10:1234", "models"),
    [
      "http://192.0.2.10:1234/v1/models",
      "http://192.0.2.10:1234/models"
    ]
  );
  assert.deepEqual(
    localLlm.buildLocalLlmCandidateUrls("http://192.0.2.10:1234/v1", "models"),
    ["http://192.0.2.10:1234/v1/models"]
  );
});

test("recommends only default Gemma4 and Qwen3.6 families, not uncensored variants", async () => {
  const localLlm = await import("../src/local-llm.js");

  assert.deepEqual(
    localLlm.getRecommendedTranslationModels([
      "google/gemma-4-e4b-it",
      "qwen3.6-14b-instruct",
      "qwen3.6-heretic-14b",
      "gemma-4-uncensored",
      "llama-3.1-8b-instruct"
    ]),
    [
      "google/gemma-4-e4b-it",
      "qwen3.6-14b-instruct"
    ]
  );
});

test("detects Gemma4 model names and applies only recommended sampling options", async () => {
  const localLlm = await import("../src/local-llm.js");
  const payload = localLlm.buildLocalLlmChatPayload({
    model: "google/gemma-4-e4b-it",
    prompt: "Translate this.",
    targetLanguage: "ko"
  });

  assert.equal(payload.model, "google/gemma-4-e4b-it");
  assert.equal(payload.temperature, 1.0);
  assert.equal(payload.top_p, 0.95);
  assert.equal(payload.top_k, 64);
  assert.equal(Object.hasOwn(payload, "max_tokens"), false);
  assert.equal(Object.hasOwn(payload, "max_context"), false);
  assert.equal(Object.hasOwn(payload, "num_ctx"), false);
});

test("leaves non-Gemma4 requests without extra sampling or limit fields", async () => {
  const localLlm = await import("../src/local-llm.js");
  const payload = localLlm.buildLocalLlmChatPayload({
    model: "llama-3.1-8b-instruct",
    prompt: "Translate this.",
    targetLanguage: "ko"
  });

  assert.equal(Object.hasOwn(payload, "temperature"), false);
  assert.equal(Object.hasOwn(payload, "top_p"), false);
  assert.equal(Object.hasOwn(payload, "top_k"), false);
  assert.equal(Object.hasOwn(payload, "max_tokens"), false);
  assert.equal(Object.hasOwn(payload, "max_context"), false);
});

test("extracts OpenAI chat completion text", async () => {
  const localLlm = await import("../src/local-llm.js");

  assert.equal(
    localLlm.extractLocalLlmResponseText({
      choices: [{ message: { content: "[{\"id\":\"t1\",\"translatedText\":\"안녕\"}]" } }]
    }),
    "[{\"id\":\"t1\",\"translatedText\":\"안녕\"}]"
  );
});
