export const RECOMMENDED_MODEL_FAMILIES = ["Gemma4", "Qwen3.6"];
export const UNSAFE_RECOMMENDATION_PATTERN =
  /heretic|uncensored|abliterated|dolphin|liberated|jailbreak|no[-_\s]*guard|de[-_\s]*censor/i;

export const GEMMA4_SAMPLING_OPTIONS = {
  temperature: 1.0,
  top_p: 0.95,
  top_k: 64
};

export function normalizeLocalLlmBaseUrl(baseUrl) {
  const value = String(baseUrl || "").trim();
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function buildLocalLlmUrl(baseUrl, path) {
  const normalizedBaseUrl = normalizeLocalLlmBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    throw new Error("Local LLM API 주소가 올바르지 않습니다.");
  }

  const normalizedPath = String(path || "").replace(/^\/+/, "");
  return `${normalizedBaseUrl}/${normalizedPath}`;
}

export function buildLocalLlmCandidateUrls(baseUrl, path) {
  const normalizedBaseUrl = normalizeLocalLlmBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    throw new Error("Local LLM API 주소가 올바르지 않습니다.");
  }

  const normalizedPath = String(path || "").replace(/^\/+/, "");
  const basePath = new URL(normalizedBaseUrl).pathname.replace(/\/+$/, "");
  const urls = basePath.endsWith("/v1")
    ? [buildLocalLlmUrl(normalizedBaseUrl, normalizedPath)]
    : [
      buildLocalLlmUrl(`${normalizedBaseUrl}/v1`, normalizedPath),
      buildLocalLlmUrl(normalizedBaseUrl, normalizedPath)
    ];

  return Array.from(new Set(urls));
}

export function isGemma4Model(model) {
  return /gemma[\s._-]*4/i.test(String(model || ""));
}

export function isQwen36Model(model) {
  return /qwen[\s._-]*3(?:\.|[\s._-])?6/i.test(String(model || ""));
}

export function isUnsafeRecommendationModel(model) {
  return UNSAFE_RECOMMENDATION_PATTERN.test(String(model || ""));
}

export function isRecommendedTranslationModel(model) {
  if (isUnsafeRecommendationModel(model)) {
    return false;
  }
  return isGemma4Model(model) || isQwen36Model(model);
}

export function getRecommendedTranslationModels(models) {
  return (Array.isArray(models) ? models : [])
    .map((model) => String(model || "").trim())
    .filter(Boolean)
    .filter(isRecommendedTranslationModel);
}

export function buildLocalLlmChatPayload({ model, prompt, targetLanguage }) {
  const selectedModel = String(model || "").trim();
  if (!selectedModel) {
    throw new Error("Local LLM 모델을 선택해야 합니다.");
  }
  const targetBase = String(targetLanguage || "").toLowerCase().split("-")[0];
  const targetLabel = targetBase === "ko" ? "Korean (한국어)" : targetLanguage;

  const payload = {
    model: selectedModel,
    messages: [
      {
        role: "system",
        content: [
          "You are an AI page translation engine.",
          `The required output language is ${targetLabel}.`,
          targetBase === "ko"
            ? "All translatedText values must be Korean written in Hangul. Do not answer in Japanese unless the source is a proper noun or product label that should remain unchanged."
            : `All translatedText values must be ${targetLabel}.`,
          "Translate visible page text only from the user-provided JSON items.",
          "Input items use sourceText. Output items must use translatedText.",
          "Return valid JSON only when JSON is requested. Never use the key text in the output.",
          "Do not call external translation services."
        ].join(" ")
      },
      {
        role: "user",
        content: String(prompt || "")
      }
    ]
  };

  if (isGemma4Model(selectedModel)) {
    Object.assign(payload, GEMMA4_SAMPLING_OPTIONS);
  }

  return payload;
}

export function extractLocalLlmResponseText(responseJson) {
  const choices = Array.isArray(responseJson?.choices) ? responseJson.choices : [];
  const firstChoice = choices[0];
  const content = firstChoice?.message?.content ?? firstChoice?.text ?? "";
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Local LLM 응답에서 텍스트를 찾지 못했습니다.");
  }
  return content;
}

export function parseLocalLlmModelsResponse(responseJson) {
  const data = Array.isArray(responseJson?.data) ? responseJson.data : [];
  const models = [];
  const seen = new Set();

  for (const item of data) {
    const id = typeof item === "string" ? item : item?.id;
    const model = String(id || "").trim();
    if (model && !seen.has(model)) {
      seen.add(model);
      models.push(model);
    }
  }

  return models;
}
