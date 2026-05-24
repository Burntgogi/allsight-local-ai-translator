import {
  PRESET_LANGUAGES,
  STORAGE_KEY,
  DEFAULT_SETTINGS,
  LOCAL_LLM_CHUNK_SETTINGS,
  UI_LANGUAGES,
  canonicalizeLanguageCode,
  normalizeSettings,
  resolveTargetLanguage,
  resolveUiLanguage,
  describeTargetLanguage
} from "./settings.js";
import {
  GEMMA4_SAMPLING_OPTIONS,
  getRecommendedTranslationModels,
  isGemma4Model,
  isRecommendedTranslationModel,
  normalizeLocalLlmBaseUrl
} from "./local-llm.js";

const MESSAGE_TYPES = {
  localListModels: "AI_PT_LOCAL_LLM_LIST_MODELS",
  settingsUpdated: "AI_PT_SETTINGS_UPDATED"
};

const I18N = {
  ko: {
    documentTitle: "AllSight Local AI Translator 설정",
    heading: "AllSight Local AI Translator 설정",
    displaySection: "표시 언어",
    uiLanguageLabel: "옵션 언어",
    uiLanguageAuto: "자동 (Chrome 언어)",
    uiLanguageKo: "한국어",
    uiLanguageEn: "English",
    targetSection: "번역 언어",
    targetLanguageLabel: "목적 언어",
    customLanguageLabel: "직접 언어코드",
    customLanguagePlaceholder: "예: zh-Hant, pt-BR, id",
    engineSection: "번역 엔진",
    localLlmEnabled: "Local LLM 사용",
    engineHelp: "끄면 Chrome 내장 AI(LanguageModel)를 사용합니다. 켜면 Chrome 내장 AI 대신 OpenAI 호환 Local LLM API를 사용합니다.",
    baseUrlLabel: "OpenAI 호환 API 주소",
    baseUrlPlaceholder: "예: http://localhost:1234/v1",
    checkApi: "API 확인",
    modelLabel: "모델 선택",
    recommendation: "추천 모델: Gemma4 기본 모델, Qwen3.6 기본 모델",
    chunkItemsLabel: "Local LLM 청크 텍스트 개수",
    chunkCharsLabel: "Local LLM 청크 최대 문자 수",
    retryLimitLabel: "전체 페이지 누락 재번역 횟수",
    chunkHelpOne: "청크 텍스트 개수는 한 번의 Local LLM 요청에 묶어 보내는 DOM 텍스트 조각 수입니다. 청크 최대 문자 수는 같은 요청에 포함할 원문 텍스트의 총 문자 기준입니다.",
    chunkHelpTwo: "둘 중 하나가 먼저 한계에 닿으면 다음 요청으로 나뉩니다. 값을 키우면 요청 횟수는 줄지만 일부 id 누락 가능성이 커질 수 있습니다. Chrome 내장 AI는 기존 작은 chunk 설정을 그대로 사용합니다.",
    lmStudioSection: "LM Studio 시작",
    lmStepDownload: "LM Studio를 설치합니다.",
    lmStepModel: "LM Studio에서 번역용 모델을 다운로드하고 로드합니다.",
    lmStepServer: "Developer 탭에서 Start server를 켭니다.",
    lmStepOptions: "이 옵션 화면에 API 주소를 입력하고 API 확인을 누른 뒤 모델을 선택합니다.",
    lmDownloadLink: "LM Studio 다운로드",
    lmServerDocsLink: "API 서버 사용법",
    lmOpenAiDocsLink: "OpenAI 호환 endpoint",
    usageSection: "사용방법",
    usageHelpOne: "페이지에서 우클릭 후 AllSight 메뉴의 “보이는 페이지만 번역” 또는 “전체 페이지 번역”을 선택합니다. 번역 중 “번역 해제”를 누르면 진행 중인 작업을 중지하고 원문으로 복원합니다.",
    usageHelpTwo: "Local LLM은 LM Studio, Ollama 등 OpenAI 호환 서버의 기본 설정을 따릅니다. Gemma4 모델을 선택한 경우에만 temperature=1.0, top_p=0.95, top_k=64를 요청에 포함합니다.",
    save: "저장",
    loadError: "설정을 불러오지 못했습니다: {error}",
    checkError: "확인 실패: {error}",
    saveError: "저장 실패: {error}",
    saveOk: "저장했습니다.",
    baseUrlRequired: "OpenAI 호환 API 주소를 입력하세요.",
    checkingModels: "모델 목록 확인 중...",
    modelsLoadError: "모델 목록을 불러오지 못했습니다.",
    modelsLoaded: "{count}개 모델을 불러왔습니다.",
    modelSelectPlaceholder: "API 확인 후 모델을 선택하세요",
    resolvedLanguage: "적용 언어: {description} / resolved={resolved}",
    chromeAiCurrent: "현재 Chrome 내장 AI(LanguageModel)를 사용합니다.",
    gemmaAuto: "Gemma4 추천값 자동 적용: temperature={temperature}, top_p={topP}, top_k={topK}",
    noSampling: "이 모델은 sampling 값을 추가로 지정하지 않습니다.",
    recommendationTag: "추천",
    recommendedAvailable: "추천 가능 모델: {models}",
    recommendedNone: "현재 목록에서 추천 가능한 기본 모델을 찾지 못했습니다."
  },
  en: {
    documentTitle: "AllSight Local AI Translator Options",
    heading: "AllSight Local AI Translator Options",
    displaySection: "Display Language",
    uiLanguageLabel: "Options language",
    uiLanguageAuto: "Auto (Chrome language)",
    uiLanguageKo: "Korean",
    uiLanguageEn: "English",
    targetSection: "Translation Language",
    targetLanguageLabel: "Target language",
    customLanguageLabel: "Custom language code",
    customLanguagePlaceholder: "Example: zh-Hant, pt-BR, id",
    engineSection: "Translation Engine",
    localLlmEnabled: "Use Local LLM",
    engineHelp: "Off uses Chrome built-in AI (LanguageModel). On uses an OpenAI-compatible Local LLM API instead of Chrome built-in AI.",
    baseUrlLabel: "OpenAI-compatible API base URL",
    baseUrlPlaceholder: "Example: http://localhost:1234/v1",
    checkApi: "Check API",
    modelLabel: "Model",
    recommendation: "Recommended models: default Gemma4 or default Qwen3.6 models.",
    chunkItemsLabel: "Local LLM chunk text count",
    chunkCharsLabel: "Local LLM chunk character limit",
    retryLimitLabel: "Full-page missing item retry count",
    chunkHelpOne: "Chunk text count is the number of DOM text fragments sent in one Local LLM request. Chunk character limit is the total source text character budget for the same request.",
    chunkHelpTwo: "When either limit is reached, the next text goes into a new request. Larger values reduce request count but can increase id omissions on some models. Chrome built-in AI keeps the smaller fixed chunk settings.",
    lmStudioSection: "Start with LM Studio",
    lmStepDownload: "Install LM Studio.",
    lmStepModel: "Download and load a translation model in LM Studio.",
    lmStepServer: "Open the Developer tab and turn on Start server.",
    lmStepOptions: "Enter the API base URL here, click Check API, then select a model.",
    lmDownloadLink: "Download LM Studio",
    lmServerDocsLink: "API server guide",
    lmOpenAiDocsLink: "OpenAI-compatible endpoints",
    usageSection: "Usage",
    usageHelpOne: "Right-click a page and choose AllSight: Translate visible page or Translate full page. Choose Restore original while translating to stop the running job and restore the page text.",
    usageHelpTwo: "Local LLM mode follows the server settings from LM Studio, Ollama, or another OpenAI-compatible server. Only Gemma4 models add temperature=1.0, top_p=0.95, and top_k=64 to requests.",
    save: "Save",
    loadError: "Failed to load settings: {error}",
    checkError: "Check failed: {error}",
    saveError: "Save failed: {error}",
    saveOk: "Saved.",
    baseUrlRequired: "Enter an OpenAI-compatible API base URL.",
    checkingModels: "Checking model list...",
    modelsLoadError: "Could not load the model list.",
    modelsLoaded: "Loaded {count} models.",
    modelSelectPlaceholder: "Check API, then select a model",
    resolvedLanguage: "Applied language: {description} / resolved={resolved}",
    chromeAiCurrent: "Using Chrome built-in AI (LanguageModel).",
    gemmaAuto: "Gemma4 recommended values applied automatically: temperature={temperature}, top_p={topP}, top_k={topK}",
    noSampling: "This model does not add sampling overrides.",
    recommendationTag: "recommended",
    recommendedAvailable: "Recommended available models: {models}",
    recommendedNone: "No recommended default model was found in the current list."
  }
};

const TARGET_LANGUAGE_LABELS = {
  ko: {
    browser: "Chrome 사용자 언어",
    ko: "한국어 (강제)",
    en: "English",
    ja: "日本語",
    es: "Español",
    de: "Deutsch",
    fr: "Français",
    custom: "직접 입력"
  },
  en: {
    browser: "Chrome user language",
    ko: "Korean (forced)",
    en: "English",
    ja: "Japanese",
    es: "Spanish",
    de: "German",
    fr: "French",
    custom: "Custom code"
  }
};

const UI_LANGUAGE_LABEL_KEYS = {
  auto: "uiLanguageAuto",
  ko: "uiLanguageKo",
  en: "uiLanguageEn"
};

const uiLanguageSelect = document.querySelector("#ui-language");
const select = document.querySelector("#target-language");
const customInput = document.querySelector("#custom-language");
const localLlmEnabled = document.querySelector("#local-llm-enabled");
const localLlmPanel = document.querySelector("#local-llm-panel");
const localLlmBaseUrl = document.querySelector("#local-llm-base-url");
const checkLocalApiButton = document.querySelector("#check-local-api");
const localApiStatus = document.querySelector("#local-api-status");
const localLlmModel = document.querySelector("#local-llm-model");
const gemmaOptions = document.querySelector("#gemma-options");
const localLlmChunkMaxItems = document.querySelector("#local-llm-chunk-max-items");
const localLlmChunkMaxChars = document.querySelector("#local-llm-chunk-max-chars");
const localLlmFullPageRetryLimit = document.querySelector("#local-llm-full-page-retry-limit");
const saveButton = document.querySelector("#save");
const resolved = document.querySelector("#resolved");
const status = document.querySelector("#status");

load().catch((error) => {
  status.textContent = t("loadError", { error: error.message || String(error) });
});

uiLanguageSelect.addEventListener("change", render);
select.addEventListener("change", render);
customInput.addEventListener("input", render);
localLlmEnabled.addEventListener("change", render);
localLlmBaseUrl.addEventListener("input", render);
localLlmModel.addEventListener("change", renderGemmaOptions);
localLlmChunkMaxItems.addEventListener("input", render);
localLlmChunkMaxChars.addEventListener("input", render);
localLlmFullPageRetryLimit.addEventListener("input", render);
checkLocalApiButton.addEventListener("click", () => {
  checkLocalApi().catch((error) => {
    localApiStatus.textContent = t("checkError", { error: error.message || String(error) });
  });
});
saveButton.addEventListener("click", () => {
  save().catch((error) => {
    status.textContent = t("saveError", { error: error.message || String(error) });
  });
});

async function load() {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  const settings = normalizeSettings(data[STORAGE_KEY] || DEFAULT_SETTINGS);
  renderUiLanguageOptions(resolveUiLanguage(settings, getBrowserLanguage()));
  uiLanguageSelect.value = settings.uiLanguage;
  applyI18n();
  select.value = settings.targetMode === "browser"
    ? "browser"
    : settings.targetMode === "custom"
      ? "custom"
      : settings.presetLanguage;
  customInput.value = settings.customLanguage;
  localLlmEnabled.checked = settings.translationEngine === "localLlm";
  localLlmBaseUrl.value = settings.localLlmBaseUrl;
  localLlmChunkMaxItems.value = settings.localLlmChunkMaxItems;
  localLlmChunkMaxChars.value = settings.localLlmChunkMaxChars;
  localLlmFullPageRetryLimit.value = settings.localLlmFullPageRetryLimit;
  fillModelSelect(settings.localLlmModels, settings.localLlmModel);
  render();
}

async function save() {
  const settings = buildSettingsFromForm();
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
  await notifySettingsUpdated();
  status.textContent = t("saveOk");
  render();
}

async function notifySettingsUpdated() {
  try {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.settingsUpdated });
  } catch {
    // The options page still saved correctly if the background worker is not awake.
  }
}

async function checkLocalApi() {
  const baseUrl = normalizeLocalLlmBaseUrl(localLlmBaseUrl.value);
  if (!baseUrl) {
    throw new Error(t("baseUrlRequired"));
  }

  localApiStatus.textContent = t("checkingModels");
  checkLocalApiButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.localListModels,
      baseUrl,
      uiLanguage: getUiLanguage()
    });
    if (!response?.ok) {
      throw new Error(response?.error || t("modelsLoadError"));
    }

    const previous = localLlmModel.value;
    fillModelSelect(response.models, previous);
    localLlmBaseUrl.value = baseUrl;
    localApiStatus.textContent = t("modelsLoaded", { count: response.models.length });
    renderGemmaOptions();
  } finally {
    checkLocalApiButton.disabled = false;
  }
}

function buildSettingsFromForm() {
  const languageSettings = buildLanguageSettingsFromForm();
  const models = getModelsFromSelect();
  return normalizeSettings({
    ...languageSettings,
    uiLanguage: uiLanguageSelect.value || DEFAULT_SETTINGS.uiLanguage,
    translationEngine: localLlmEnabled.checked ? "localLlm" : "chromeAi",
    translationScope: DEFAULT_SETTINGS.translationScope,
    localLlmBaseUrl: normalizeLocalLlmBaseUrl(localLlmBaseUrl.value),
    localLlmModel: localLlmModel.value.trim(),
    localLlmModels: models,
    localLlmChunkMaxItems: localLlmChunkMaxItems.value,
    localLlmChunkMaxChars: localLlmChunkMaxChars.value,
    localLlmFullPageRetryLimit: localLlmFullPageRetryLimit.value
  });
}

function buildLanguageSettingsFromForm() {
  if (select.value === "browser") {
    return {
      targetMode: "browser",
      presetLanguage: DEFAULT_SETTINGS.presetLanguage,
      customLanguage: customInput.value.trim()
    };
  }

  if (select.value === "custom") {
    return {
      targetMode: "custom",
      presetLanguage: DEFAULT_SETTINGS.presetLanguage,
      customLanguage: canonicalizeLanguageCode(customInput.value, "ko")
    };
  }

  return {
    targetMode: "preset",
    presetLanguage: canonicalizeLanguageCode(select.value, "ko"),
    customLanguage: customInput.value.trim()
  };
}

function fillModelSelect(models, selectedModel) {
  const normalizedModels = Array.from(new Set(
    (Array.isArray(models) ? models : [])
      .map((model) => String(model || "").trim())
      .filter(Boolean)
  ));
  const normalizedSelectedModel = String(selectedModel || "").trim();
  if (normalizedSelectedModel && !normalizedModels.includes(normalizedSelectedModel)) {
    normalizedModels.unshift(normalizedSelectedModel);
  }

  localLlmModel.replaceChildren();
  if (!normalizedModels.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t("modelSelectPlaceholder");
    localLlmModel.append(option);
    return;
  }

  for (const model of normalizedModels) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = isRecommendedTranslationModel(model)
      ? `${model} (${t("recommendationTag")})`
      : model;
    localLlmModel.append(option);
  }

  localLlmModel.value = normalizedSelectedModel && normalizedModels.includes(normalizedSelectedModel)
    ? normalizedSelectedModel
    : normalizedModels[0];
}

function getModelsFromSelect() {
  return Array.from(localLlmModel.options)
    .map((option) => option.value.trim())
    .filter(Boolean);
}

function render() {
  applyI18n();
  customInput.disabled = select.value !== "custom";
  const localEnabled = localLlmEnabled.checked;
  localLlmPanel.toggleAttribute("data-disabled", !localEnabled);
  localLlmBaseUrl.disabled = !localEnabled;
  checkLocalApiButton.disabled = !localEnabled;
  localLlmModel.disabled = !localEnabled || !getModelsFromSelect().length;
  localLlmChunkMaxItems.disabled = !localEnabled;
  localLlmChunkMaxChars.disabled = !localEnabled;
  localLlmFullPageRetryLimit.disabled = !localEnabled;

  localLlmChunkMaxItems.placeholder = String(LOCAL_LLM_CHUNK_SETTINGS.chunkMaxItems.default);
  localLlmChunkMaxChars.placeholder = String(LOCAL_LLM_CHUNK_SETTINGS.chunkMaxChars.default);
  localLlmFullPageRetryLimit.placeholder = String(LOCAL_LLM_CHUNK_SETTINGS.fullPageRetryLimit.default);

  const settings = buildSettingsFromForm();
  const browserLanguage = getBrowserLanguage();
  const uiLanguage = getUiLanguage();
  resolved.textContent = t("resolvedLanguage", {
    description: describeTargetLanguage(settings, browserLanguage, uiLanguage),
    resolved: resolveTargetLanguage(settings, browserLanguage)
  });
  renderGemmaOptions();
  renderRecommendedModels();
}

function renderGemmaOptions() {
  if (!localLlmEnabled.checked) {
    gemmaOptions.textContent = t("chromeAiCurrent");
    return;
  }

  if (!localLlmModel.value) {
    gemmaOptions.textContent = t("modelSelectPlaceholder");
    return;
  }

  if (isGemma4Model(localLlmModel.value)) {
    gemmaOptions.textContent = t("gemmaAuto", {
      temperature: GEMMA4_SAMPLING_OPTIONS.temperature,
      topP: GEMMA4_SAMPLING_OPTIONS.top_p,
      topK: GEMMA4_SAMPLING_OPTIONS.top_k
    });
    return;
  }

  gemmaOptions.textContent = t("noSampling");
}

function renderRecommendedModels() {
  const recommended = getRecommendedTranslationModels(getModelsFromSelect());
  const recommendation = document.querySelector(".recommendation");
  if (!recommendation) {
    return;
  }

  if (!recommended.length) {
    recommendation.textContent = `${t("recommendation")} ${t("recommendedNone")}`;
    return;
  }

  recommendation.textContent = `${t("recommendation")} ${t("recommendedAvailable", {
    models: recommended.join(", ")
  })}`;
}

function applyI18n() {
  const language = getUiLanguage();
  document.documentElement.lang = language;
  document.title = t("documentTitle");
  renderUiLanguageOptions(language);
  renderTargetLanguageOptions(language);
  updateEmptyModelPlaceholder();

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
}

function renderUiLanguageOptions(language) {
  const previous = uiLanguageSelect.value || DEFAULT_SETTINGS.uiLanguage;
  uiLanguageSelect.replaceChildren();

  for (const optionConfig of UI_LANGUAGES) {
    const option = document.createElement("option");
    option.value = optionConfig.code;
    option.textContent = I18N[language][UI_LANGUAGE_LABEL_KEYS[optionConfig.code]] || optionConfig.label;
    uiLanguageSelect.append(option);
  }

  uiLanguageSelect.value = previous;
  if (!uiLanguageSelect.value) {
    uiLanguageSelect.value = DEFAULT_SETTINGS.uiLanguage;
  }
}

function renderTargetLanguageOptions(language) {
  const previous = select.value || "browser";
  select.replaceChildren();

  for (const languageOption of PRESET_LANGUAGES) {
    const option = document.createElement("option");
    option.value = languageOption.code;
    option.textContent = TARGET_LANGUAGE_LABELS[language][languageOption.code] || languageOption.label;
    select.append(option);
  }

  select.value = previous;
  if (!select.value) {
    select.value = "browser";
  }
}

function updateEmptyModelPlaceholder() {
  if (!getModelsFromSelect().length && localLlmModel.options.length === 1) {
    localLlmModel.options[0].textContent = t("modelSelectPlaceholder");
  }
}

function getUiLanguage() {
  return resolveUiLanguage(
    { uiLanguage: uiLanguageSelect.value || DEFAULT_SETTINGS.uiLanguage },
    getBrowserLanguage()
  );
}

function getBrowserLanguage() {
  return chrome.i18n?.getUILanguage?.() || navigator.language || "en";
}

function t(key, replacements = {}) {
  const language = getUiLanguage();
  const dictionary = I18N[language] || I18N.en;
  const template = dictionary[key] || I18N.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(replacements[name] ?? ""));
}
