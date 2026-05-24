import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  normalizeSettings,
  resolveTargetLanguage,
  resolveUiLanguage
} from "./settings.js";
import {
  buildLocalLlmChatPayload,
  buildLocalLlmCandidateUrls,
  extractLocalLlmResponseText,
  normalizeLocalLlmBaseUrl,
  parseLocalLlmModelsResponse
} from "./local-llm.js";

const MENU_IDS = {
  translateViewport: "ai-pt-translate-visible",
  translatePage: "ai-pt-translate-full",
  restore: "ai-pt-restore-page",
  probe: "ai-pt-probe-capability",
  options: "ai-pt-options"
};

const MESSAGE_TYPES = {
  translate: "AI_PT_TRANSLATE_PAGE",
  restore: "AI_PT_RESTORE_PAGE",
  probe: "AI_PT_PROBE_CAPABILITY",
  status: "AI_PT_STATUS",
  localListModels: "AI_PT_LOCAL_LLM_LIST_MODELS",
  localTranslate: "AI_PT_LOCAL_LLM_TRANSLATE",
  localCancel: "AI_PT_LOCAL_LLM_CANCEL",
  settingsUpdated: "AI_PT_SETTINGS_UPDATED"
};
const APP_NAME = "AllSight Local AI Translator";
const MENU_PREFIX = "AllSight";

const MENU_TEXT = {
  ko: {
    translateViewport: `${MENU_PREFIX}: 보이는 페이지만 번역`,
    translatePage: `${MENU_PREFIX}: 전체 페이지 번역`,
    restore: `${MENU_PREFIX}: 번역 해제`,
    probe: `${MENU_PREFIX}: 지원 상태 검사`,
    options: `${MENU_PREFIX}: 설정`
  },
  en: {
    translateViewport: `${MENU_PREFIX}: Translate visible page`,
    translatePage: `${MENU_PREFIX}: Translate full page`,
    restore: `${MENU_PREFIX}: Restore original`,
    probe: `${MENU_PREFIX}: Check support`,
    options: `${MENU_PREFIX}: Options`
  }
};

const ERROR_TEXT = {
  ko: {
    invalidLocalUrl: "Local LLM API 주소가 올바르지 않습니다.",
    emptyCallableModels: "호출 가능한 모델 목록이 비어 있습니다.",
    localApiError: "Local LLM API 오류: {detail}. url={url}",
    emptyModelsAtUrl: "모델 목록이 비어 있습니다. url={url}",
    missingChoices: "chat/completions 응답에 choices가 없습니다. url={url}",
    localCallFailed: "Local LLM API 호출에 실패했습니다.",
    nonJson: "Local LLM API가 JSON이 아닌 응답을 반환했습니다. status={status}",
    httpFailed: "Local LLM API 호출 실패: {status} {detail}"
  },
  en: {
    invalidLocalUrl: "The Local LLM API URL is invalid.",
    emptyCallableModels: "The callable model list is empty.",
    localApiError: "Local LLM API error: {detail}. url={url}",
    emptyModelsAtUrl: "The model list is empty. url={url}",
    missingChoices: "The chat/completions response has no choices. url={url}",
    localCallFailed: "Local LLM API call failed.",
    nonJson: "Local LLM API returned a non-JSON response. status={status}",
    httpFailed: "Local LLM API request failed: {status} {detail}"
  }
};

const STATUS_BADGES = {
  probing: { text: "AI", color: "#2563eb" },
  translating: { text: "...", color: "#7c3aed" },
  complete: { text: "OK", color: "#15803d" },
  restored: { text: "", color: "#4b5563" },
  unsupported: { text: "NO", color: "#b91c1c" },
  error: { text: "ERR", color: "#b91c1c" }
};
const RECENT_ACTION_WINDOW_MS = 750;
const recentActions = new Map();
const localLlmRequests = new Map();
const localLlmEndpointCache = new Map();

async function setupContextMenus() {
  await chrome.contextMenus.removeAll();
  const text = MENU_TEXT[await getStoredUiLanguage()] || MENU_TEXT.en;

  chrome.contextMenus.create({
    id: MENU_IDS.translateViewport,
    title: text.translateViewport,
    contexts: ["page", "selection"]
  });

  chrome.contextMenus.create({
    id: MENU_IDS.translatePage,
    title: text.translatePage,
    contexts: ["page", "selection"]
  });

  chrome.contextMenus.create({
    id: MENU_IDS.restore,
    title: text.restore,
    contexts: ["page", "selection"]
  });

  chrome.contextMenus.create({
    id: MENU_IDS.probe,
    title: text.probe,
    contexts: ["page", "selection"]
  });

  chrome.contextMenus.create({
    id: MENU_IDS.options,
    title: text.options,
    contexts: ["page", "selection", "action"]
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus().catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenus().catch(console.error);
});

setupContextMenus().catch(console.error);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_IDS.options) {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (!tab?.id) {
    return;
  }
  if (shouldThrottleAction(tab.id, info.menuItemId)) {
    return;
  }

  resolveMessageForAction(info.menuItemId).then((message) => {
    if (!message) {
      return;
    }

    runOnTab(tab.id, message).catch((error) => {
      console.error(`${APP_NAME} failed:`, error);
      setBadge(tab.id, "error");
    });
  }).catch((error) => {
    console.error(`${APP_NAME} settings failed:`, error);
    setBadge(tab.id, "error");
  });
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (!tab?.id) {
    return;
  }
  if (shouldThrottleAction(tab.id, command)) {
    return;
  }

  resolveMessageForAction(command).then((message) => {
    if (!message) {
      return;
    }

    runOnTab(tab.id, message).catch((error) => {
      console.error(`${APP_NAME} command failed:`, error);
      setBadge(tab.id, "error");
    });
  }).catch((error) => {
    console.error(`${APP_NAME} command settings failed:`, error);
    setBadge(tab.id, "error");
  });
});

async function resolveMessageForAction(actionId) {
  if (actionId === MENU_IDS.translateViewport) {
    return buildTranslateMessage("viewport");
  }

  if (actionId === MENU_IDS.translatePage) {
    return buildTranslateMessage("page");
  }

  if (actionId === MENU_IDS.restore) {
    const settings = await getStoredSettings();
    return {
      type: MESSAGE_TYPES.restore,
      uiLanguage: getUiLanguage(settings)
    };
  }

  if (actionId === MENU_IDS.probe) {
    const settings = await getStoredSettings();
    return {
      type: MESSAGE_TYPES.probe,
      targetLanguage: getTargetLanguage(settings),
      uiLanguage: getUiLanguage(settings),
      engine: buildEngineConfig(settings)
    };
  }

  return null;
}

async function buildTranslateMessage(scope) {
  const settings = await getStoredSettings();
  return {
    type: MESSAGE_TYPES.translate,
    targetLanguage: getTargetLanguage(settings),
    uiLanguage: getUiLanguage(settings),
    scope,
    engine: buildEngineConfig(settings)
  };
}

async function getStoredSettings() {
  const data = await chrome.storage.sync.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const raw = data[STORAGE_KEY] || data[LEGACY_STORAGE_KEY];
  const settings = normalizeSettings(raw);

  if (!data[STORAGE_KEY] && data[LEGACY_STORAGE_KEY]) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
  }

  return settings;
}

function getTargetLanguage(settings) {
  return resolveTargetLanguage(settings, getBrowserLanguage());
}

async function getStoredUiLanguage() {
  try {
    return getUiLanguage(await getStoredSettings());
  } catch {
    return resolveUiLanguage({}, getBrowserLanguage());
  }
}

function getUiLanguage(settings) {
  return resolveUiLanguage(settings, getBrowserLanguage());
}

function buildEngineConfig(settings) {
  if (settings.translationEngine === "localLlm") {
    return {
      type: "localLlm",
      baseUrl: settings.localLlmBaseUrl,
      model: settings.localLlmModel,
      chunkMaxItems: settings.localLlmChunkMaxItems,
      chunkMaxChars: settings.localLlmChunkMaxChars,
      fullPageRetryLimit: settings.localLlmFullPageRetryLimit
    };
  }

  return { type: "chromeAi" };
}

function getBrowserLanguage() {
  return chrome.i18n?.getUILanguage?.() || globalThis.navigator?.language || "ko";
}

async function runOnTab(tabId, message) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/content-core.js", "src/content.js"]
  });

  await chrome.tabs.sendMessage(tabId, {
    ...message,
    requestId: createRequestId()
  });
}

function shouldThrottleAction(tabId, actionId) {
  const key = `${tabId}:${actionId}`;
  const current = Date.now();
  const previous = recentActions.get(key) || 0;
  recentActions.set(key, current);
  return current - previous < RECENT_ACTION_WINDOW_MS;
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === MESSAGE_TYPES.status && sender.tab?.id) {
    setBadge(sender.tab.id, message.state);
    return false;
  }

  if (message?.type === MESSAGE_TYPES.localListModels) {
    respondAsync(sendResponse, () => handleLocalLlmListModels(message));
    return true;
  }

  if (message?.type === MESSAGE_TYPES.localTranslate) {
    respondAsync(sendResponse, () => handleLocalLlmTranslate(message));
    return true;
  }

  if (message?.type === MESSAGE_TYPES.localCancel) {
    const controller = localLlmRequests.get(message.localRequestId);
    controller?.abort();
    localLlmRequests.delete(message.localRequestId);
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === MESSAGE_TYPES.settingsUpdated) {
    respondAsync(sendResponse, async () => {
      await setupContextMenus();
      return {};
    });
    return true;
  }

  return false;
});

function respondAsync(sendResponse, task) {
  task()
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({
      ok: false,
      error: error.message || String(error)
    }));
}

async function handleLocalLlmListModels(message) {
  const uiLanguage = normalizeUiLanguage(message.uiLanguage);
  const baseUrl = normalizeLocalLlmBaseUrl(message.baseUrl);
  if (!baseUrl) {
    throw new Error(t(uiLanguage, "invalidLocalUrl"));
  }

  const responseJson = await fetchFirstLocalLlmJson(baseUrl, "models", {
    method: "GET",
    headers: { accept: "application/json" }
  }, uiLanguage);
  const models = parseLocalLlmModelsResponse(responseJson);
  if (!models.length) {
    throw new Error(t(uiLanguage, "emptyCallableModels"));
  }

  return { models };
}

async function handleLocalLlmTranslate(message) {
  const uiLanguage = normalizeUiLanguage(message.uiLanguage);
  const baseUrl = normalizeLocalLlmBaseUrl(message.baseUrl);
  if (!baseUrl) {
    throw new Error(t(uiLanguage, "invalidLocalUrl"));
  }

  const controller = new AbortController();
  if (message.localRequestId) {
    localLlmRequests.set(message.localRequestId, controller);
  }

  try {
    const payload = buildLocalLlmChatPayload({
      model: message.model,
      prompt: message.prompt,
      targetLanguage: message.targetLanguage
    });
    const responseJson = await fetchFirstLocalLlmJson(baseUrl, "chat/completions", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    }, uiLanguage);
    return {
      text: extractLocalLlmResponseText(responseJson)
    };
  } finally {
    if (message.localRequestId) {
      localLlmRequests.delete(message.localRequestId);
    }
  }
}

async function fetchFirstLocalLlmJson(baseUrl, path, init, uiLanguage = "ko") {
  const cacheKey = `${normalizeLocalLlmBaseUrl(baseUrl)}|${path}`;
  const candidateUrls = buildLocalLlmCandidateUrls(baseUrl, path);
  const cachedUrl = localLlmEndpointCache.get(cacheKey);
  const urls = cachedUrl
    ? [cachedUrl, ...candidateUrls.filter((url) => url !== cachedUrl)]
    : candidateUrls;
  let lastError;

  for (const url of urls) {
    try {
      const response = await fetch(url, init);
      const responseJson = await readJsonResponse(response, uiLanguage);
      if (responseJson?.error) {
        const detail = responseJson.error?.message || responseJson.error;
        throw new Error(t(uiLanguage, "localApiError", { detail, url }));
      }
      if (path === "models" && !parseLocalLlmModelsResponse(responseJson).length) {
        throw new Error(t(uiLanguage, "emptyModelsAtUrl", { url }));
      }
      if (path === "chat/completions" && !Array.isArray(responseJson?.choices)) {
        throw new Error(t(uiLanguage, "missingChoices", { url }));
      }
      localLlmEndpointCache.set(cacheKey, url);
      return responseJson;
    } catch (error) {
      lastError = error;
    }
  }

  localLlmEndpointCache.delete(cacheKey);
  throw lastError || new Error(t(uiLanguage, "localCallFailed"));
}

async function readJsonResponse(response, uiLanguage) {
  const text = await response.text();
  let responseJson;
  try {
    responseJson = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(t(uiLanguage, "nonJson", { status: response.status }));
  }

  if (!response.ok) {
    const detail = responseJson?.error?.message || responseJson?.message || text || response.statusText;
    throw new Error(t(uiLanguage, "httpFailed", { status: response.status, detail }));
  }

  return responseJson;
}

function normalizeUiLanguage(uiLanguage) {
  return uiLanguage === "ko" || uiLanguage === "en" ? uiLanguage : "en";
}

function t(uiLanguage, key, replacements = {}) {
  const dictionary = ERROR_TEXT[normalizeUiLanguage(uiLanguage)] || ERROR_TEXT.en;
  const template = dictionary[key] || ERROR_TEXT.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(replacements[name] ?? ""));
}

function setBadge(tabId, state) {
  const badge = STATUS_BADGES[state] || { text: "", color: "#4b5563" };
  chrome.action.setBadgeText({ tabId, text: badge.text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
}
