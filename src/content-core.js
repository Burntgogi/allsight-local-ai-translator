(function initAiPageTranslatorCore(globalScope) {
  "use strict";

  const EXCLUDED_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEMPLATE",
    "CODE",
    "PRE",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
    "BUTTON",
    "SVG",
    "CANVAS"
  ]);

  const TRANSLATION_RESPONSE_SCHEMA = {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        translatedText: { type: "string" }
      },
      required: ["id", "translatedText"],
      additionalProperties: false
    }
  };

  const STRICT_OUTPUT_LANGUAGES = new Set(["en", "ja", "es"]);
  const NATURAL_TRANSLATION_STYLE_INSTRUCTION =
    "Avoid literal, translationese phrasing; translate as naturally and idiomatically as possible while strictly preserving the source tone and content. Do not distort factual relationships from the source, and do not over-localize proper nouns.";

  function canonicalizeLanguageCode(languageCode, fallback = "ko") {
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

  function languageBase(languageCode) {
    return canonicalizeLanguageCode(languageCode).split("-")[0].toLowerCase();
  }

  function isStrictOutputLanguage(languageCode) {
    return STRICT_OUTPUT_LANGUAGES.has(languageBase(languageCode));
  }

  function normalizeWhitespace(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function shouldTranslateText(text) {
    const normalized = normalizeWhitespace(text);
    if (normalized.length < 2) {
      return false;
    }

    if (!/[\p{L}\p{N}]/u.test(normalized)) {
      return false;
    }

    if (/^[\d\s.,:;!?()[\]{}'"`~@#$%^&*_+=|\\/<>-]+$/.test(normalized)) {
      return false;
    }

    return true;
  }

  function containsHangul(text) {
    return /[\uac00-\ud7a3]/.test(String(text || ""));
  }

  function isProbablyKorean(text) {
    const compact = String(text || "").replace(/\s+/g, "");
    if (!compact || !containsHangul(compact)) {
      return false;
    }

    const letters = Array.from(compact).filter((char) => /\p{L}/u.test(char));
    if (!letters.length) {
      return false;
    }

    const hangulCount = letters.filter((char) => /[\uac00-\ud7a3]/.test(char)).length;
    return hangulCount / letters.length >= 0.35;
  }

  function isProbablyJapanese(text) {
    return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(text || ""));
  }

  function isProbablyLatinLanguage(text) {
    return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(String(text || ""));
  }

  function isProbablyTargetLanguage(text, targetLanguage) {
    const value = String(text || "").trim();
    if (!value) {
      return false;
    }

    const base = languageBase(targetLanguage);
    if (base === "ko") {
      return isProbablyKorean(value);
    }

    if (base === "ja") {
      return isProbablyJapanese(value);
    }

    if (["en", "es", "de", "fr"].includes(base)) {
      return isProbablyLatinLanguage(value);
    }

    return true;
  }

  function preserveOuterWhitespace(original, translated) {
    const source = String(original || "");
    const replacement = String(translated || "").trim();
    const leading = source.match(/^\s*/)?.[0] || "";
    const trailing = source.match(/\s*$/)?.[0] || "";
    return `${leading}${replacement}${trailing}`;
  }

  function chunkItems(items, options = {}) {
    const maxItems = options.maxItems || 30;
    const maxChars = options.maxChars || 6000;
    const chunks = [];
    let current = [];
    let charCount = 0;

    for (const item of items) {
      const textLength = String(item.text || "").length;
      const nextWouldOverflow =
        current.length > 0 &&
        (current.length >= maxItems || charCount + textLength > maxChars);

      if (nextWouldOverflow) {
        chunks.push(current);
        current = [];
        charCount = 0;
      }

      current.push(item);
      charCount += textLength;
    }

    if (current.length) {
      chunks.push(current);
    }

    return chunks;
  }

  function getMissingTranslationItems(items, translatedIds) {
    const idSet = translatedIds instanceof Set
      ? translatedIds
      : new Set(Array.isArray(translatedIds) ? translatedIds : []);

    return (Array.isArray(items) ? items : [])
      .filter((item) => item?.id && !idSet.has(item.id));
  }

  function getMissingFromResponseIds(items, translations) {
    const translationMap = translations instanceof Map ? translations : new Map();
    return (Array.isArray(items) ? items : [])
      .filter((item) => item?.id && !translationMap.has(item.id))
      .map((item) => item.id);
  }

  function getUnappliedTranslationIds(translations, appliedIds) {
    const translationMap = translations instanceof Map ? translations : new Map();
    const appliedSet = appliedIds instanceof Set
      ? appliedIds
      : new Set(Array.isArray(appliedIds) ? appliedIds : []);

    return Array.from(translationMap.keys())
      .filter((id) => !appliedSet.has(id));
  }

  function getRetryChunkLimits(limits, attempt) {
    const value = limits && typeof limits === "object" ? limits : {};
    const divisor = 2 ** Math.max(1, Number.isFinite(Number(attempt)) ? Math.trunc(Number(attempt)) : 1);
    return {
      chunkMaxItems: Math.max(1, Math.floor((value.chunkMaxItems || 1) / divisor)),
      chunkMaxChars: Math.max(500, Math.floor((value.chunkMaxChars || 500) / divisor))
    };
  }

  function shouldSkipDomRescanText(text, targetLanguage) {
    const base = languageBase(targetLanguage);
    if (base === "ko") {
      return isProbablyKorean(text);
    }

    if (base === "ja") {
      return isProbablyJapanese(text);
    }

    return false;
  }

  function rectIntersectsViewport(rect, viewport, margin = 0) {
    if (!rect || !viewport) {
      return false;
    }

    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    return rect.bottom >= viewport.top - margin &&
      rect.top <= viewport.bottom + margin &&
      rect.right >= viewport.left - margin &&
      rect.left <= viewport.right + margin;
  }

  function buildProbePrompt(targetLanguage, options = {}) {
    const forceTargetLanguage = options.forceTargetLanguage === true;
    const base = languageBase(targetLanguage);
    return [
      `Translate the following text into ${targetLanguage}.`,
      forceTargetLanguage
        ? "Use the requested target language even if it is not declared as a model capability."
        : "Use the model's declared output language naturally.",
      base === "ko"
        ? "Return only natural Korean written in Hangul. Do not answer in English or Japanese."
        : `Return only natural ${targetLanguage}.`,
      "Do not explain.",
      "",
      "English: Hello, this is a local AI translation test.",
      "Japanese: 今日は良い天気です。"
    ].join("\n");
  }

  function buildTranslationPrompt(items, targetLanguage, options = {}) {
    const forceTargetLanguage = options.forceTargetLanguage === true;
    const retryMissing = options.retryMissing === true;
    const base = languageBase(targetLanguage);
    const targetLanguageRules = base === "ko"
      ? [
        "translatedText must be natural Korean written in Hangul.",
        "Do not leave non-Korean source text untranslated unless it is a name, URL, code, product label, or already Korean text.",
        "If an input item is already Korean, return that Korean text unchanged."
      ]
      : [
        `translatedText must be natural ${targetLanguage}.`,
        `Do not leave source text untranslated unless it is a name, URL, code, product label, or already ${targetLanguage}.`,
        `If an input item is already ${targetLanguage}, return that text unchanged.`
      ];
    return [
      "You are an AI page translation engine.",
      `Translate every input item into ${targetLanguage}.`,
      forceTargetLanguage
        ? "Use the requested target language even if it is not declared as a model capability."
        : "Use the model's declared output language naturally.",
      NATURAL_TRANSLATION_STYLE_INSTRUCTION,
      ...targetLanguageRules,
      "The input may mix English, Japanese, Spanish, German, French, or other visible page languages.",
      "Preserve meaning, names, numbers, URLs, and punctuation as appropriate.",
      retryMissing
        ? "This is a retry for items omitted in a previous response. Return every input id exactly once."
        : "",
      "Return only a JSON array. Each item must contain exactly id and translatedText.",
      "Do not add explanations, markdown, comments, or extra fields.",
      "",
      JSON.stringify(items.map((item) => ({ id: item.id, text: item.text })))
    ].join("\n");
  }

  function stripJsonFence(raw) {
    const text = String(raw || "").trim();
    const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : text;
  }

  function extractFirstJsonArray(raw) {
    const text = stripJsonFence(raw);
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (char === "[") {
        if (depth === 0) {
          start = index;
        }
        depth += 1;
        continue;
      }

      if (char === "]" && depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          return text.slice(start, index + 1);
        }
      }
    }

    return text;
  }

  function parseTranslationResponse(raw, expectedIds) {
    const parsed = JSON.parse(extractFirstJsonArray(raw));
    if (!Array.isArray(parsed)) {
      throw new Error("AllSight response was not a JSON array.");
    }

    const idSet = new Set(expectedIds);
    const translations = new Map();

    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const id = String(entry.id || "");
      const translatedText = typeof entry.translatedText === "string"
        ? entry.translatedText
        : "";

      if (idSet.has(id) && translatedText.trim()) {
        translations.set(id, translatedText);
      }
    }

    return translations;
  }

  function isElementExcluded(element) {
    if (!element) {
      return true;
    }

    if (EXCLUDED_TAGS.has(element.tagName)) {
      return true;
    }

    if (element.closest("[data-ai-page-translator-ui], [data-gemini-nano-translator-ui], [hidden], [aria-hidden='true'], [contenteditable='true']")) {
      return true;
    }

    return false;
  }

  function isElementVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    const view = element.ownerDocument?.defaultView;
    if (!view?.getComputedStyle) {
      return true;
    }

    let current = element;
    while (current && current.nodeType === 1) {
      const style = view.getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        Number(style.opacity) === 0
      ) {
        return false;
      }
      current = current.parentElement;
    }

    const rects = element.getClientRects?.();
    return !rects || rects.length > 0;
  }

  const core = {
    EXCLUDED_TAGS,
    TRANSLATION_RESPONSE_SCHEMA,
    STRICT_OUTPUT_LANGUAGES,
    NATURAL_TRANSLATION_STYLE_INSTRUCTION,
    canonicalizeLanguageCode,
    languageBase,
    isStrictOutputLanguage,
    normalizeWhitespace,
    shouldTranslateText,
    containsHangul,
    isProbablyKorean,
    isProbablyJapanese,
    isProbablyLatinLanguage,
    isProbablyTargetLanguage,
    preserveOuterWhitespace,
    chunkItems,
    getMissingTranslationItems,
    getMissingFromResponseIds,
    getUnappliedTranslationIds,
    getRetryChunkLimits,
    shouldSkipDomRescanText,
    rectIntersectsViewport,
    buildProbePrompt,
    buildTranslationPrompt,
    parseTranslationResponse,
    extractFirstJsonArray,
    isElementExcluded,
    isElementVisible
  };

  globalScope.AiPageTranslatorCore = core;
  globalScope.GeminiNanoTranslatorCore = core;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
