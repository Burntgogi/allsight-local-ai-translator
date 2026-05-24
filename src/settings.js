import { normalizeLocalLlmBaseUrl } from "./local-llm.js";

export const STORAGE_KEY = "aiPageTranslatorSettings";
export const LEGACY_STORAGE_KEY = "geminiNanoTranslatorSettings";

export const PRESET_LANGUAGES = [
  { code: "browser", label: "Chrome 사용자 언어" },
  { code: "ko", label: "한국어 (강제)" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "custom", label: "직접 입력" }
];

export const UI_LANGUAGES = [
  { code: "auto", label: "Auto" },
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" }
];

export const LOCAL_LLM_CHUNK_SETTINGS = {
  chunkMaxItems: { default: 48, min: 1, max: 200 },
  chunkMaxChars: { default: 7200, min: 500, max: 50000 },
  fullPageRetryLimit: { default: 3, min: 0, max: 10 }
};

export const DEFAULT_SETTINGS = {
  translationEngine: "chromeAi",
  translationScope: "viewport",
  uiLanguage: "auto",
  targetMode: "browser",
  presetLanguage: "ko",
  customLanguage: "",
  localLlmBaseUrl: "",
  localLlmModel: "",
  localLlmModels: [],
  localLlmChunkMaxItems: LOCAL_LLM_CHUNK_SETTINGS.chunkMaxItems.default,
  localLlmChunkMaxChars: LOCAL_LLM_CHUNK_SETTINGS.chunkMaxChars.default,
  localLlmFullPageRetryLimit: LOCAL_LLM_CHUNK_SETTINGS.fullPageRetryLimit.default
};

export function canonicalizeLanguageCode(languageCode, fallback = "ko") {
  const cleaned = String(languageCode || "").trim().replace(/_/g, "-");
  if (!cleaned) {
    return fallback;
  }

  try {
    return Intl.getCanonicalLocales(cleaned)[0] || fallback;
  } catch {
    const normalized = cleaned.toLowerCase();
    return /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(normalized)
      ? normalized
      : fallback;
  }
}

export function normalizeSettings(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const translationEngine = ["chromeAi", "localLlm"].includes(value.translationEngine)
    ? value.translationEngine
    : DEFAULT_SETTINGS.translationEngine;
  const translationScope = ["viewport", "page"].includes(value.translationScope)
    ? value.translationScope
    : DEFAULT_SETTINGS.translationScope;
  const targetMode = ["browser", "preset", "custom"].includes(value.targetMode)
    ? value.targetMode
    : DEFAULT_SETTINGS.targetMode;
  const uiLanguage = ["auto", "ko", "en"].includes(value.uiLanguage)
    ? value.uiLanguage
    : DEFAULT_SETTINGS.uiLanguage;
  const localLlmModels = Array.isArray(value.localLlmModels)
    ? Array.from(new Set(value.localLlmModels.map((model) => String(model || "").trim()).filter(Boolean)))
    : DEFAULT_SETTINGS.localLlmModels;

  return {
    translationEngine,
    translationScope,
    uiLanguage,
    targetMode,
    presetLanguage: canonicalizeLanguageCode(
      value.presetLanguage || DEFAULT_SETTINGS.presetLanguage,
      DEFAULT_SETTINGS.presetLanguage
    ),
    customLanguage: String(value.customLanguage || "").trim(),
    localLlmBaseUrl: normalizeLocalLlmBaseUrl(value.localLlmBaseUrl),
    localLlmModel: String(value.localLlmModel || "").trim(),
    localLlmModels,
    localLlmChunkMaxItems: normalizeIntegerSetting(
      value.localLlmChunkMaxItems,
      LOCAL_LLM_CHUNK_SETTINGS.chunkMaxItems
    ),
    localLlmChunkMaxChars: normalizeIntegerSetting(
      value.localLlmChunkMaxChars,
      LOCAL_LLM_CHUNK_SETTINGS.chunkMaxChars
    ),
    localLlmFullPageRetryLimit: normalizeIntegerSetting(
      value.localLlmFullPageRetryLimit,
      LOCAL_LLM_CHUNK_SETTINGS.fullPageRetryLimit
    )
  };
}

export function resolveUiLanguage(settings, browserLanguage) {
  const normalized = normalizeSettings(settings);
  if (normalized.uiLanguage === "ko" || normalized.uiLanguage === "en") {
    return normalized.uiLanguage;
  }

  return canonicalizeLanguageCode(browserLanguage, "en")
    .toLowerCase()
    .startsWith("ko")
    ? "ko"
    : "en";
}

function normalizeIntegerSetting(value, config) {
  if (value === undefined || value === null || value === "") {
    return config.default;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return config.default;
  }

  const integer = Math.trunc(parsed);
  return Math.min(config.max, Math.max(config.min, integer));
}

export function resolveTargetLanguage(settings, browserLanguage) {
  const normalized = normalizeSettings(settings);

  if (normalized.targetMode === "custom") {
    return canonicalizeLanguageCode(normalized.customLanguage, "ko");
  }

  if (normalized.targetMode === "preset") {
    return canonicalizeLanguageCode(normalized.presetLanguage, "ko");
  }

  return canonicalizeLanguageCode(browserLanguage, "ko");
}

export function describeTargetLanguage(settings, browserLanguage, uiLanguage = "ko") {
  const normalized = normalizeSettings(settings);
  const resolved = resolveTargetLanguage(normalized, browserLanguage);
  const language = uiLanguage === "en" ? "en" : "ko";

  if (normalized.targetMode === "browser") {
    return language === "en"
      ? `Chrome user language (${resolved})`
      : `Chrome 사용자 언어 (${resolved})`;
  }

  if (normalized.targetMode === "custom") {
    return language === "en"
      ? `Custom code (${resolved})`
      : `직접 입력 (${resolved})`;
  }

  return resolved;
}
