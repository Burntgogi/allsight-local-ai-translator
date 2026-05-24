(function initAiPageTranslator(globalScope) {
  "use strict";

  if (globalScope.__aiPageTranslatorRuntime) {
    return;
  }

  const core = globalScope.AiPageTranslatorCore || globalScope.GeminiNanoTranslatorCore;
  if (!core) {
    throw new Error("AllSight core was not loaded.");
  }
  const APP_NAME = "AllSight";

  const MESSAGE_TYPES = {
    translate: "AI_PT_TRANSLATE_PAGE",
    restore: "AI_PT_RESTORE_PAGE",
    probe: "AI_PT_PROBE_CAPABILITY",
    status: "AI_PT_STATUS",
    localTranslate: "AI_PT_LOCAL_LLM_TRANSLATE",
    localCancel: "AI_PT_LOCAL_LLM_CANCEL"
  };
  const REQUEST_CLAIM_ATTRIBUTE = "data-ai-page-translator-request-id";

  const DEFAULT_TARGET_LANGUAGE = core.canonicalizeLanguageCode(
    globalScope.navigator?.language || "ko"
  );
  const STRICT_INPUT_LANGUAGES = ["en", "ja", "es"];
  const DEFAULT_STRICT_MODEL_OPTIONS = {
    expectedInputs: [{ type: "text", languages: ["en", "ja", "es"] }],
    expectedOutputs: [{ type: "text", languages: ["en"] }]
  };
  const FORCE_MODEL_OPTIONS = {};
  const SESSION_CREATE_TIMEOUT_MS = 120000;
  const TRANSLATION_LIMITS = {
    viewportOnly: true,
    viewportMarginPx: 80,
    maxItemsPerRun: 80,
    maxCharsPerRun: 5000,
    chunkMaxItems: 12,
    chunkMaxChars: 1800
  };
  const FULL_PAGE_TRANSLATION_LIMITS = {
    viewportOnly: false,
    viewportMarginPx: 0,
    maxItemsPerRun: null,
    maxCharsPerRun: null,
    chunkMaxItems: 12,
    chunkMaxChars: 1800
  };
  const LOCAL_LLM_LIMIT_DEFAULTS = {
    chunkMaxItems: 48,
    chunkMaxChars: 7200,
    fullPageRetryLimit: 3,
    viewportMaxItemsPerRun: 320,
    viewportMaxCharsPerRun: 20000
  };
  const TEXT = {
    ko: {
      alreadyRunning: "이미 {app} 번역 작업이 실행 중입니다.",
      noText: "번역할 표시 텍스트가 없습니다.",
      translatingCount: "{count}개 텍스트 조각 번역 중",
      translatingStart: "{app} 번역 중: 0/{total}",
      translatingProgress: "{app} 번역 중: {done}/{total}",
      probeChecking: "Ai {language} 출력 지원 검사 중",
      languageModelUnavailable: "이 페이지 컨텍스트에서 Chrome AI LanguageModel API를 사용할 수 없습니다.",
      chromeSessionUnavailable: "Chrome AI 세션을 만들 수 없습니다. strict={strict}, force={force}",
      chromeEmptyProbe: "Chrome AI probe 응답이 비어 있습니다.",
      chromeProbeMismatch: "Chrome AI가 {language} 출력 probe를 통과하지 못했습니다.",
      chromeStrictProbeOk: "Chrome AI {language} 출력 strict probe 통과.",
      chromeForceProbeOk: "Chrome AI force prompt probe 통과. {language} 출력을 프롬프트로 강제합니다. strict={strict}",
      aiProbeCancelled: "Ai probe가 중지되었습니다.",
      aiProbeFailed: "Ai probe 실패: {error}",
      localLlmNeedsSettings: "Local LLM API 주소와 모델을 옵션에서 먼저 설정해야 합니다.",
      localEmptyProbe: "Local LLM probe 응답이 비어 있습니다.",
      localProbeMismatch: "Local LLM이 {language} 출력 probe를 통과하지 못했습니다.",
      localProbeOk: "Local LLM {model} probe 통과.",
      localProbeCancelled: "Local LLM probe가 중지되었습니다.",
      localProbeFailed: "Local LLM probe 실패: {error}",
      sessionTimeout: "Chrome AI 세션 준비 시간이 초과되었습니다. 로컬 weights.bin은 있어도 Chrome이 feature config, safety/classifier, adapter cache, 또는 모델 validation을 아직 완료하지 못했을 수 있습니다.",
      sessionPreparing: "Chrome AI 세션 준비 중: 로컬 모델과 Chrome eligibility를 확인합니다.",
      modelChecking: "Chrome AI 세션 준비 중: Chrome이 로컬 모델/구성요소 상태를 확인하고 있습니다.",
      modelReady: "Chrome AI 모델 준비 완료.",
      modelPreparingPercent: "Chrome AI 모델/구성요소 준비 중: {percent}%",
      retryStart: "{app} 누락 재번역 중: 0/{total} ({attempt}/{limit})",
      retryProgress: "{app} 누락 재번역 중: {done}/{total} ({attempt}/{limit})",
      domRescanStart: "{app} DOM 재확인 번역 중: 0/{total}",
      domRescanProgress: "{app} DOM 재확인 번역 중: {done}/{total}",
      completionMissing: "{applied}개 적용, {missing}개 누락 유지, {failed}개 chunk 실패.",
      completionDomRescanFailed: "{applied}개 텍스트 조각 번역 완료. DOM 재확인으로 {rescan}개를 보정했고 {failed}개 chunk 실패가 있었습니다.",
      completionDomRescan: "{applied}개 텍스트 조각 번역 완료. DOM 재확인으로 {rescan}개를 보정했습니다.",
      completionRetryFailed: "{applied}개 텍스트 조각 번역 완료. 누락 항목은 재번역으로 보정했고 {failed}개 chunk 실패가 있었습니다.",
      completionRetry: "{applied}개 텍스트 조각 번역 완료. 누락 항목은 재번역으로 보정했습니다.",
      completionFailed: "{applied}개 적용, {failed}개 chunk 실패. 실패 항목은 원문 유지.",
      completionOk: "{applied}개 텍스트 조각 번역 완료.",
      localCallFailed: "Local LLM 호출에 실패했습니다.",
      restoreCancelled: "번역을 중지하고 원문으로 복원했습니다.",
      restoreOk: "원문으로 복원했습니다.",
      stopped: "번역을 중지했습니다.",
      unknownError: "알 수 없는 오류"
    },
    en: {
      alreadyRunning: "{app} translation is already running.",
      noText: "No visible text to translate.",
      translatingCount: "Translating {count} text fragments",
      translatingStart: "{app} translating: 0/{total}",
      translatingProgress: "{app} translating: {done}/{total}",
      probeChecking: "Checking Ai {language} output support",
      languageModelUnavailable: "Chrome AI LanguageModel API is not available in this page context.",
      chromeSessionUnavailable: "Could not create a Chrome AI session. strict={strict}, force={force}",
      chromeEmptyProbe: "Chrome AI probe returned an empty response.",
      chromeProbeMismatch: "Chrome AI did not pass the {language} output probe.",
      chromeStrictProbeOk: "Chrome AI {language} strict output probe passed.",
      chromeForceProbeOk: "Chrome AI force prompt probe passed. Forcing {language} output by prompt. strict={strict}",
      aiProbeCancelled: "Ai probe was stopped.",
      aiProbeFailed: "Ai probe failed: {error}",
      localLlmNeedsSettings: "Set the Local LLM API URL and model in options first.",
      localEmptyProbe: "Local LLM probe returned an empty response.",
      localProbeMismatch: "Local LLM did not pass the {language} output probe.",
      localProbeOk: "Local LLM {model} probe passed.",
      localProbeCancelled: "Local LLM probe was stopped.",
      localProbeFailed: "Local LLM probe failed: {error}",
      sessionTimeout: "Chrome AI session preparation timed out. The local weights.bin can exist while Chrome still needs feature config, safety/classifier, adapter cache, or model validation.",
      sessionPreparing: "Preparing Chrome AI session: checking local model and Chrome eligibility.",
      modelChecking: "Preparing Chrome AI session: Chrome is checking local model/components.",
      modelReady: "Chrome AI model is ready.",
      modelPreparingPercent: "Preparing Chrome AI model/components: {percent}%",
      retryStart: "{app} retrying missing items: 0/{total} ({attempt}/{limit})",
      retryProgress: "{app} retrying missing items: {done}/{total} ({attempt}/{limit})",
      domRescanStart: "{app} DOM rescan translation: 0/{total}",
      domRescanProgress: "{app} DOM rescan translation: {done}/{total}",
      completionMissing: "Applied {applied}, kept {missing} missing, {failed} chunk failures.",
      completionDomRescanFailed: "Translated {applied} text fragments. DOM rescan recovered {rescan}; {failed} chunk failures occurred.",
      completionDomRescan: "Translated {applied} text fragments. DOM rescan recovered {rescan}.",
      completionRetryFailed: "Translated {applied} text fragments. Missing items were recovered by retry; {failed} chunk failures occurred.",
      completionRetry: "Translated {applied} text fragments. Missing items were recovered by retry.",
      completionFailed: "Applied {applied}; {failed} chunk failures. Failed items stayed original.",
      completionOk: "Translated {applied} text fragments.",
      localCallFailed: "Local LLM call failed.",
      restoreCancelled: "Stopped translation and restored original text.",
      restoreOk: "Restored original text.",
      stopped: "Stopped translation.",
      unknownError: "Unknown error"
    }
  };

  const state = {
    active: false,
    running: false,
    uiLanguage: normalizeUiLanguage(),
    nextId: 1,
    originals: new Map(),
    nodeIds: new WeakMap(),
    translatedNodes: new WeakSet(),
    probeResult: null,
    perfEvents: [],
    abortController: null,
    activeSession: null,
    activeLocalRequests: new Set(),
    cancelRequested: false
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (!message?.type) {
      return;
    }
    if (!claimMessageRequest(message)) {
      return;
    }
    state.uiLanguage = normalizeUiLanguage(message.uiLanguage || state.uiLanguage);

    if (message.type === MESSAGE_TYPES.probe) {
      runProbe({
        force: true,
        targetLanguage: message.targetLanguage || DEFAULT_TARGET_LANGUAGE,
        engine: normalizeEngine(message.engine)
      }).catch(handleFatalError);
    }

    if (message.type === MESSAGE_TYPES.restore) {
      restorePage();
    }

    if (message.type === MESSAGE_TYPES.translate) {
      translatePage(message.targetLanguage || DEFAULT_TARGET_LANGUAGE, {
        engine: normalizeEngine(message.engine),
        scope: normalizeScope(message.scope),
        uiLanguage: state.uiLanguage
      }).catch(handleFatalError);
    }
  });

  globalScope.__aiPageTranslatorRuntime = {
    translatePage,
    restorePage,
    runProbe,
    getPerfLog() {
      return state.perfEvents.slice();
    }
  };

  async function translatePage(targetLanguage, options = {}) {
    state.uiLanguage = normalizeUiLanguage(options.uiLanguage || state.uiLanguage);
    if (state.running) {
      showStatus(t("alreadyRunning", { app: APP_NAME }), "translating");
      return;
    }

    const normalizedTargetLanguage = core.canonicalizeLanguageCode(targetLanguage, DEFAULT_TARGET_LANGUAGE);
    const engine = normalizeEngine(options.engine);
    const scope = normalizeScope(options.scope);
    const limits = getTranslationLimits(scope, engine);
    const abortController = new AbortController();
    state.abortController = abortController;
    state.cancelRequested = false;
    state.running = true;
    const totalStart = now();
    perfLog("translate-start", {
      engine: engine.type,
      targetLanguage: normalizedTargetLanguage,
      scope,
      viewport: getViewport()
    });
    try {
      const probe = await runProbe({
        force: false,
        targetLanguage: normalizedTargetLanguage,
        engine,
        signal: abortController.signal
      });
      assertNotCancelled(abortController.signal);
      if (!probe.ok) {
        reportStatus("unsupported", probe.detail);
        showStatus(probe.detail, "error");
        return;
      }

      restorePage({ silent: true, skipCancel: true });
      const collection = collectTextItems(document.body, limits);
      const items = collection.items;
      perfLog("collect", collection.metrics);
      if (!items.length) {
        reportStatus("complete", t("noText"));
        showStatus(t("noText"), "complete");
        return;
      }

      reportStatus("translating", t("translatingCount", { count: items.length }));
      showStatus(t("translatingStart", { app: APP_NAME, total: items.length }), "translating");

      let session = null;
      if (engine.type === "chromeAi") {
        const sessionStart = now();
        session = await createLanguageModelSessionWithTimeout(
          normalizedTargetLanguage,
          probe.createOptions || FORCE_MODEL_OPTIONS,
          null,
          abortController.signal
        );
        state.activeSession = session;
        assertNotCancelled(abortController.signal);
        perfLog("session-created", {
          ms: elapsed(sessionStart)
        });
      }
      const appliedIds = new Set();

      const initialResult = await runInitialChunks({
        items,
        appliedIds,
        limits,
        normalizedTargetLanguage,
        probe,
        engine,
        session,
        signal: abortController.signal,
        totalStart
      });
      if (initialResult.cancelled) {
        return;
      }

      const retryResult = await runMissingRetries({
        enabled: scope === "page" && limits.fullPageRetryLimit > 0,
        items,
        appliedIds,
        limits,
        normalizedTargetLanguage,
        probe,
        engine,
        session,
        signal: abortController.signal,
        totalStart
      });
      if (retryResult.cancelled) {
        return;
      }

      const domRescanResult = await runDomRescanRetry({
        enabled: scope === "page" &&
          engine.type === "localLlm" &&
          retryResult.remainingMissing > 0,
        previousRemainingMissing: retryResult.remainingMissing,
        appliedIds,
        limits,
        normalizedTargetLanguage,
        probe,
        engine,
        session,
        signal: abortController.signal,
        totalStart
      });
      if (domRescanResult.cancelled) {
        return;
      }

      session?.destroy?.();
      state.activeSession = null;
      finalizeTranslationRun({
        initialResult,
        retryResult,
        domRescanResult,
        totalStart
      });
    } finally {
      if (state.activeSession) {
        state.activeSession.destroy?.();
        state.activeSession = null;
      }
      if (state.abortController === abortController) {
        state.abortController = null;
      }
      state.running = false;
    }
  }

  async function runProbe({ force, targetLanguage, engine, signal }) {
    const normalizedTargetLanguage = core.canonicalizeLanguageCode(targetLanguage, DEFAULT_TARGET_LANGUAGE);
    const normalizedEngine = normalizeEngine(engine);
    const engineKey = getEngineKey(normalizedEngine);
    if (
      !force &&
      state.probeResult &&
      state.probeResult.targetLanguage === normalizedTargetLanguage &&
      state.probeResult.engineKey === engineKey
    ) {
      perfLog("probe-cache-hit", {
        ok: state.probeResult.ok,
        mode: state.probeResult.mode || "unknown"
      });
      return state.probeResult;
    }

    const probeStart = now();
    perfLog("probe-start", {
      engine: normalizedEngine.type,
      targetLanguage: normalizedTargetLanguage,
      force
    });
    reportStatus("probing", t("probeChecking", { language: normalizedTargetLanguage }));
    showStatus(t("probeChecking", { language: normalizedTargetLanguage }), "probing");

    if (normalizedEngine.type === "localLlm") {
      return runLocalLlmProbe({
        engine: normalizedEngine,
        engineKey,
        targetLanguage: normalizedTargetLanguage,
        signal,
        probeStart
      });
    }

    if (!("LanguageModel" in globalScope)) {
      return finishProbe({
        ok: false,
        engineKey,
        targetLanguage: normalizedTargetLanguage,
        detail: t("languageModelUnavailable")
      });
    }

    try {
      assertNotCancelled(signal);
      const strictOptions = getStrictModelOptions(normalizedTargetLanguage);
      const strictAvailability = strictOptions
        ? await globalScope.LanguageModel.availability(strictOptions)
        : "skipped";
      let mode = strictOptions ? "strict" : "force";
      let createOptions = strictOptions || FORCE_MODEL_OPTIONS;

      if (!isUsableAvailability(strictAvailability)) {
        const forceAvailability = await globalScope.LanguageModel.availability(FORCE_MODEL_OPTIONS);
        if (!isUsableAvailability(forceAvailability)) {
          return finishProbe({
            ok: false,
            engineKey,
            targetLanguage: normalizedTargetLanguage,
            detail: t("chromeSessionUnavailable", {
              strict: strictAvailability,
              force: forceAvailability
            })
          });
        }

        mode = "force";
        createOptions = FORCE_MODEL_OPTIONS;
      }

      const session = await createLanguageModelSessionWithTimeout(
        normalizedTargetLanguage,
        createOptions,
        (progress) => {
          showModelPreparationStatus(progress);
        },
        signal
      );
      state.activeSession = session;
      assertNotCancelled(signal);
      const result = await session.prompt(
        core.buildProbePrompt(normalizedTargetLanguage, {
          forceTargetLanguage: mode !== "strict"
        }),
        { signal }
      );
      session.destroy?.();
      if (state.activeSession === session) {
        state.activeSession = null;
      }

      if (!String(result || "").trim()) {
        return finishProbe({
          ok: false,
          engineKey,
          targetLanguage: normalizedTargetLanguage,
          detail: t("chromeEmptyProbe")
        });
      }

      if (!core.isProbablyTargetLanguage(result, normalizedTargetLanguage)) {
        return finishProbe({
          ok: false,
          engineKey,
          targetLanguage: normalizedTargetLanguage,
          detail: t("chromeProbeMismatch", { language: normalizedTargetLanguage })
        });
      }

      return finishProbe({
        ok: true,
        mode,
        createOptions,
        engineKey,
        targetLanguage: normalizedTargetLanguage,
        ms: elapsed(probeStart),
        detail: mode === "strict"
          ? t("chromeStrictProbeOk", { language: normalizedTargetLanguage })
          : t("chromeForceProbeOk", {
            language: normalizedTargetLanguage,
            strict: strictAvailability
          })
      });
    } catch (error) {
      if (isCancellationError(error, signal)) {
        return finishProbe({
          ok: false,
          cancelled: true,
          engineKey,
          targetLanguage: normalizedTargetLanguage,
          detail: t("aiProbeCancelled")
        });
      }
      return finishProbe({
        ok: false,
        engineKey,
        targetLanguage: normalizedTargetLanguage,
        detail: t("aiProbeFailed", { error: formatError(error) })
      });
    }
  }

  async function runLocalLlmProbe({ engine, engineKey, targetLanguage, signal, probeStart }) {
    if (!engine.baseUrl || !engine.model) {
      return finishProbe({
        ok: false,
        engineKey,
        targetLanguage,
        detail: t("localLlmNeedsSettings")
      });
    }

    try {
      assertNotCancelled(signal);
      const result = await promptLocalLlm({
        prompt: core.buildProbePrompt(targetLanguage, {
          forceTargetLanguage: true
        }),
        targetLanguage,
        engine,
        signal
      });

      if (!String(result || "").trim()) {
        return finishProbe({
          ok: false,
          engineKey,
          targetLanguage,
          detail: t("localEmptyProbe")
        });
      }

      if (!core.isProbablyTargetLanguage(result, targetLanguage)) {
        return finishProbe({
          ok: false,
          engineKey,
          targetLanguage,
          detail: t("localProbeMismatch", { language: targetLanguage })
        });
      }

      return finishProbe({
        ok: true,
        mode: "localLlm",
        engineKey,
        targetLanguage,
        ms: elapsed(probeStart),
        detail: t("localProbeOk", { model: engine.model })
      });
    } catch (error) {
      if (isCancellationError(error, signal)) {
        return finishProbe({
          ok: false,
          cancelled: true,
          engineKey,
          targetLanguage,
          detail: t("localProbeCancelled")
        });
      }
      return finishProbe({
        ok: false,
        engineKey,
        targetLanguage,
        detail: t("localProbeFailed", { error: formatError(error) })
      });
    }
  }

  function finishProbe(result) {
    if (!result.cancelled) {
      state.probeResult = result;
    }
    perfLog("probe-finish", {
      ok: result.ok,
      mode: result.mode || "unknown",
      ms: result.ms,
      detail: result.detail
    });
    reportStatus(result.ok ? "complete" : "unsupported", result.detail);
    showStatus(result.detail, result.ok ? "complete" : "error");
    return result;
  }

  function claimMessageRequest(message) {
    if (!message.requestId) {
      return true;
    }

    const root = document.documentElement;
    if (!root) {
      return true;
    }

    if (root.getAttribute(REQUEST_CLAIM_ATTRIBUTE) === message.requestId) {
      return false;
    }

    root.setAttribute(REQUEST_CLAIM_ATTRIBUTE, message.requestId);
    return true;
  }

  function isUsableAvailability(availability) {
    return availability === "available" ||
      availability === "downloadable" ||
      availability === "downloading";
  }

  function getStrictModelOptions(targetLanguage) {
    const base = core.languageBase(targetLanguage);
    if (!core.isStrictOutputLanguage(base)) {
      return null;
    }

    return {
      expectedInputs: [{ type: "text", languages: STRICT_INPUT_LANGUAGES }],
      expectedOutputs: [{ type: "text", languages: [base] }]
    };
  }

  async function createLanguageModelSessionWithTimeout(targetLanguage, createOptions, onDownloadProgress, signal) {
    return withTimeout(
      createLanguageModelSession(targetLanguage, createOptions, onDownloadProgress, signal),
      SESSION_CREATE_TIMEOUT_MS,
      signal,
      t("sessionTimeout")
    );
  }

  async function createLanguageModelSession(targetLanguage, createOptions, onDownloadProgress, signal) {
    showStatus(t("sessionPreparing"), "probing");
    return globalScope.LanguageModel.create({
      ...createOptions,
      signal,
      initialPrompts: [
        {
          role: "system",
          content: [
            "You are a local page translation engine running in Chrome AI.",
            `Your required output language is ${targetLanguage}.`,
            "For ko, every natural-language output must be Korean Hangul.",
            `Translate all page text into ${targetLanguage}.`,
            `If text is already ${targetLanguage}, return it unchanged.`,
            "Never call external translation services.",
            "When asked for JSON, return valid JSON only."
          ].join(" ")
        }
      ],
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          if (typeof onDownloadProgress === "function") {
            onDownloadProgress(event.loaded || 0);
          }
        });
      }
    });
  }

  function showModelPreparationStatus(progress) {
    if (!Number.isFinite(progress) || progress <= 0) {
      showStatus(
        t("modelChecking"),
        "probing"
      );
      return;
    }

    if (progress >= 1) {
      showStatus(t("modelReady"), "probing");
      return;
    }

    showStatus(t("modelPreparingPercent", { percent: Math.round(progress * 100) }), "probing");
  }

  function normalizeEngine(engine) {
    if (engine?.type === "localLlm") {
      return {
        type: "localLlm",
        baseUrl: String(engine.baseUrl || "").trim(),
        model: String(engine.model || "").trim(),
        chunkMaxItems: normalizeInteger(
          engine.chunkMaxItems,
          LOCAL_LLM_LIMIT_DEFAULTS.chunkMaxItems,
          1,
          200
        ),
        chunkMaxChars: normalizeInteger(
          engine.chunkMaxChars,
          LOCAL_LLM_LIMIT_DEFAULTS.chunkMaxChars,
          500,
          50000
        ),
        fullPageRetryLimit: normalizeInteger(
          engine.fullPageRetryLimit,
          LOCAL_LLM_LIMIT_DEFAULTS.fullPageRetryLimit,
          0,
          10
        )
      };
    }

    return { type: "chromeAi" };
  }

  function normalizeInteger(value, fallback, min, max) {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, Math.trunc(parsed)));
  }

  function getEngineKey(engine) {
    if (engine.type === "localLlm") {
      return `localLlm:${engine.baseUrl}:${engine.model}`;
    }
    return "chromeAi";
  }

  function normalizeScope(scope) {
    return scope === "page" ? "page" : "viewport";
  }

  function getTranslationLimits(scope, engine) {
    const baseLimits = scope === "page"
      ? FULL_PAGE_TRANSLATION_LIMITS
      : TRANSLATION_LIMITS;

    if (engine?.type !== "localLlm") {
      return baseLimits;
    }

    return {
      ...baseLimits,
      maxItemsPerRun: scope === "page"
        ? null
        : LOCAL_LLM_LIMIT_DEFAULTS.viewportMaxItemsPerRun,
      maxCharsPerRun: scope === "page"
        ? null
        : LOCAL_LLM_LIMIT_DEFAULTS.viewportMaxCharsPerRun,
      chunkMaxItems: engine.chunkMaxItems,
      chunkMaxChars: engine.chunkMaxChars,
      fullPageRetryLimit: engine.fullPageRetryLimit
    };
  }

  async function runInitialChunks({
    items,
    appliedIds,
    limits,
    normalizedTargetLanguage,
    probe,
    engine,
    session,
    signal,
    totalStart
  }) {
    let appliedCount = 0;
    let failedChunks = 0;
    let processedCount = 0;
    const chunks = core.chunkItems(items, {
      maxItems: limits.chunkMaxItems,
      maxChars: limits.chunkMaxChars
    });
    perfLog("chunks-created", {
      count: chunks.length,
      chunkMaxItems: limits.chunkMaxItems,
      chunkMaxChars: limits.chunkMaxChars
    });

    for (let index = 0; index < chunks.length; index += 1) {
      assertNotCancelled(signal);
      const chunk = chunks[index];
      const chunkStart = now();
      let promptChars = 0;
      try {
        const result = await translateChunk({
          chunk,
          targetLanguage: normalizedTargetLanguage,
          probe,
          engine,
          session,
          signal
        });
        promptChars = result.prompt.length;
        const applied = applyTranslations(chunk, result.translations, appliedIds);
        appliedCount += applied.count;
        perfLog("chunk-complete", {
          index: index + 1,
          count: chunks.length,
          items: chunk.length,
          promptChars,
          responseChars: String(result.raw || "").length,
          parsed: result.translations.size,
          applied: applied.count,
          ...buildChunkTelemetry(chunk, result.translations, appliedIds, applied.ids),
          ms: elapsed(chunkStart)
        });
      } catch (error) {
        if (isCancellationError(error, signal)) {
          perfLog("translate-cancelled", {
            index: index + 1,
            totalMs: elapsed(totalStart)
          });
          return { appliedCount, failedChunks, cancelled: true };
        }
        failedChunks += 1;
        perfLog("chunk-error", {
          index: index + 1,
          count: chunks.length,
          items: chunk.length,
          promptChars,
          ms: elapsed(chunkStart),
          error: formatError(error)
        });
        console.warn("AllSight chunk translation failed:", error);
      }

      processedCount += chunk.length;
      showStatus(
        t("translatingProgress", {
          app: APP_NAME,
          done: Math.min(processedCount, items.length),
          total: items.length
        }),
        "translating"
      );
    }

    return { appliedCount, failedChunks, cancelled: false };
  }

  async function translateChunk({
    chunk,
    targetLanguage,
    probe,
    engine,
    session,
    signal,
    retryMissing = false
  }) {
    const prompt = core.buildTranslationPrompt(chunk, targetLanguage, {
      forceTargetLanguage: probe.mode !== "strict",
      retryMissing
    });
    const raw = engine.type === "localLlm"
      ? await promptLocalLlm({
        prompt,
        targetLanguage,
        engine,
        signal
      })
      : await session.prompt(prompt, {
        responseConstraint: core.TRANSLATION_RESPONSE_SCHEMA,
        omitResponseConstraintInput: true,
        signal
      });
    assertNotCancelled(signal);
    return {
      prompt,
      raw,
      translations: core.parseTranslationResponse(
        raw,
        chunk.map((item) => item.id)
      )
    };
  }

  async function runMissingRetries({
    enabled,
    items,
    appliedIds,
    limits,
    normalizedTargetLanguage,
    probe,
    engine,
    session,
    signal,
    totalStart
  }) {
    let missingItems = getConnectedMissingItems(items, appliedIds);
    if (!enabled || !missingItems.length) {
      return {
        appliedCount: 0,
        failedChunks: 0,
        attempts: 0,
        remainingMissing: missingItems.length,
        cancelled: false
      };
    }

    let retryAppliedCount = 0;
    let retryFailedChunks = 0;
    let attempts = 0;

    while (missingItems.length && attempts < limits.fullPageRetryLimit) {
      attempts += 1;
      const attemptStart = now();
      const missingCountAtStart = missingItems.length;
      const retryChunkLimits = core.getRetryChunkLimits(limits, attempts);
      const retryChunks = core.chunkItems(missingItems, {
        maxItems: retryChunkLimits.chunkMaxItems,
        maxChars: retryChunkLimits.chunkMaxChars
      });
      let attemptProcessedCount = 0;
      let attemptAppliedCount = 0;

      perfLog("missing-retry-start", {
        attempt: attempts,
        missingItems: missingCountAtStart,
        chunks: retryChunks.length,
        chunkMaxItems: retryChunkLimits.chunkMaxItems,
        chunkMaxChars: retryChunkLimits.chunkMaxChars
      });
      showStatus(
        t("retryStart", {
          app: APP_NAME,
          total: missingCountAtStart,
          attempt: attempts,
          limit: limits.fullPageRetryLimit
        }),
        "translating"
      );

      for (let index = 0; index < retryChunks.length; index += 1) {
        assertNotCancelled(signal);
        const chunk = retryChunks[index];
        const chunkStart = now();
        let promptChars = 0;
        try {
          const result = await translateChunk({
            chunk,
            targetLanguage: normalizedTargetLanguage,
            probe,
            engine,
            session,
            signal,
            retryMissing: true
          });
          promptChars = result.prompt.length;
          const applied = applyTranslations(chunk, result.translations, appliedIds);
          retryAppliedCount += applied.count;
          attemptAppliedCount += applied.count;
          perfLog("missing-retry-chunk-complete", {
            attempt: attempts,
            index: index + 1,
            count: retryChunks.length,
            items: chunk.length,
            promptChars,
            responseChars: String(result.raw || "").length,
            parsed: result.translations.size,
            applied: applied.count,
            ...buildChunkTelemetry(chunk, result.translations, appliedIds, applied.ids),
            ms: elapsed(chunkStart)
          });
        } catch (error) {
          if (isCancellationError(error, signal)) {
            perfLog("translate-cancelled", {
              retryAttempt: attempts,
              index: index + 1,
              totalMs: elapsed(totalStart)
            });
            return {
              appliedCount: retryAppliedCount,
              failedChunks: retryFailedChunks,
              attempts,
              remainingMissing: getConnectedMissingItems(items, appliedIds).length,
              cancelled: true
            };
          }

          retryFailedChunks += 1;
          perfLog("missing-retry-chunk-error", {
            attempt: attempts,
            index: index + 1,
            count: retryChunks.length,
            items: chunk.length,
            promptChars,
            ms: elapsed(chunkStart),
            error: formatError(error)
          });
          console.warn("AllSight missing retry failed:", error);
        }

        attemptProcessedCount += chunk.length;
        showStatus(
          t("retryProgress", {
            app: APP_NAME,
            done: Math.min(attemptProcessedCount, missingCountAtStart),
            total: missingCountAtStart,
            attempt: attempts,
            limit: limits.fullPageRetryLimit
          }),
          "translating"
        );
      }

      missingItems = getConnectedMissingItems(items, appliedIds);
      perfLog("missing-retry-finish", {
        attempt: attempts,
        applied: attemptAppliedCount,
        remaining: missingItems.length,
        ms: elapsed(attemptStart)
      });
    }

    return {
      appliedCount: retryAppliedCount,
      failedChunks: retryFailedChunks,
      attempts,
      remainingMissing: missingItems.length,
      cancelled: false
    };
  }

  async function runDomRescanRetry({
    enabled,
    previousRemainingMissing,
    appliedIds,
    limits,
    normalizedTargetLanguage,
    probe,
    engine,
    session,
    signal,
    totalStart
  }) {
    if (!enabled) {
      return {
        enabled: false,
        appliedCount: 0,
        failedChunks: 0,
        remainingMissing: previousRemainingMissing || 0,
        cancelled: false
      };
    }

    const rescanStart = now();
    perfLog("dom-rescan-start", {
      previousRemainingMissing
    });
    const collection = collectTextItems(document.body, {
      ...limits,
      viewportOnly: false,
      maxItemsPerRun: null,
      maxCharsPerRun: null,
      excludeTranslatedNodes: true,
      skipTargetLanguageText: true,
      targetLanguage: normalizedTargetLanguage
    });
    const items = collection.items;
    const retryChunkLimits = core.getRetryChunkLimits(limits, 1);
    const chunks = core.chunkItems(items, {
      maxItems: retryChunkLimits.chunkMaxItems,
      maxChars: retryChunkLimits.chunkMaxChars
    });
    let appliedCount = 0;
    let failedChunks = 0;
    let processedCount = 0;

    if (!items.length) {
      perfLog("dom-rescan-finish", {
        collectedItems: 0,
        applied: 0,
        failedChunks: 0,
        remainingMissing: 0,
        metrics: collection.metrics,
        ms: elapsed(rescanStart)
      });
      return {
        enabled: true,
        appliedCount: 0,
        failedChunks: 0,
        remainingMissing: 0,
        cancelled: false
      };
    }

    showStatus(t("domRescanStart", { app: APP_NAME, total: items.length }), "translating");

    for (let index = 0; index < chunks.length; index += 1) {
      assertNotCancelled(signal);
      const chunk = chunks[index];
      const chunkStart = now();
      let promptChars = 0;
      try {
        const result = await translateChunk({
          chunk,
          targetLanguage: normalizedTargetLanguage,
          probe,
          engine,
          session,
          signal,
          retryMissing: true
        });
        promptChars = result.prompt.length;
        const applied = applyTranslations(chunk, result.translations, appliedIds);
        appliedCount += applied.count;
        perfLog("dom-rescan-chunk-complete", {
          index: index + 1,
          count: chunks.length,
          items: chunk.length,
          promptChars,
          responseChars: String(result.raw || "").length,
          parsed: result.translations.size,
          applied: applied.count,
          ...buildChunkTelemetry(chunk, result.translations, appliedIds, applied.ids),
          ms: elapsed(chunkStart)
        });
      } catch (error) {
        if (isCancellationError(error, signal)) {
          perfLog("translate-cancelled", {
            domRescan: true,
            index: index + 1,
            totalMs: elapsed(totalStart)
          });
          return {
            enabled: true,
            appliedCount,
            failedChunks,
            remainingMissing: getConnectedMissingItems(items, appliedIds).length,
            cancelled: true
          };
        }

        failedChunks += 1;
        perfLog("dom-rescan-chunk-error", {
          index: index + 1,
          count: chunks.length,
          items: chunk.length,
          promptChars,
          ms: elapsed(chunkStart),
          error: formatError(error)
        });
        console.warn("AllSight DOM rescan translation failed:", error);
      }

      processedCount += chunk.length;
      showStatus(
        t("domRescanProgress", {
          app: APP_NAME,
          done: Math.min(processedCount, items.length),
          total: items.length
        }),
        "translating"
      );
    }

    const remainingMissing = getConnectedMissingItems(items, appliedIds).length;
    perfLog("dom-rescan-finish", {
      collectedItems: items.length,
      applied: appliedCount,
      failedChunks,
      remainingMissing,
      chunks: chunks.length,
      chunkMaxItems: retryChunkLimits.chunkMaxItems,
      chunkMaxChars: retryChunkLimits.chunkMaxChars,
      metrics: collection.metrics,
      ms: elapsed(rescanStart)
    });

    return {
      enabled: true,
      appliedCount,
      failedChunks,
      remainingMissing,
      cancelled: false
    };
  }

  function getConnectedMissingItems(items, appliedIds) {
    return core.getMissingTranslationItems(items, appliedIds)
      .filter((item) => item.node?.isConnected);
  }

  function getMissingIds(items, appliedIds) {
    return core.getMissingTranslationItems(items, appliedIds)
      .map((item) => item.id);
  }

  function buildChunkTelemetry(items, translations, appliedIds, appliedItemIds) {
    const missingIds = getMissingIds(items, appliedIds);
    const missingFromResponseIds = core.getMissingFromResponseIds(items, translations);
    const unappliedIds = core.getUnappliedTranslationIds(translations, appliedItemIds);
    return {
      missing: missingIds.length,
      missingIds: missingIds.slice(0, 20),
      missingFromResponse: missingFromResponseIds.length,
      missingFromResponseIds: missingFromResponseIds.slice(0, 20),
      unapplied: unappliedIds.length,
      unappliedIds: unappliedIds.slice(0, 20)
    };
  }

  function finalizeTranslationRun({
    initialResult,
    retryResult,
    domRescanResult,
    totalStart
  }) {
    const appliedCount =
      initialResult.appliedCount +
      retryResult.appliedCount +
      domRescanResult.appliedCount;
    const failedChunks =
      initialResult.failedChunks +
      retryResult.failedChunks +
      domRescanResult.failedChunks;
    const remainingMissing = domRescanResult.enabled
      ? domRescanResult.remainingMissing
      : retryResult.remainingMissing;
    state.active = appliedCount > 0;

    const detail = buildCompletionDetail({
      appliedCount,
      failedChunks,
      remainingMissing,
      retryAttempts: retryResult.attempts,
      domRescanApplied: domRescanResult.appliedCount
    });

    perfLog("translate-finish", {
      appliedCount,
      failedChunks,
      retryAttempts: retryResult.attempts,
      domRescanApplied: domRescanResult.appliedCount,
      domRescanRemainingMissing: domRescanResult.enabled
        ? domRescanResult.remainingMissing
        : null,
      remainingMissing,
      totalMs: elapsed(totalStart)
    });
    reportStatus(appliedCount > 0 ? "complete" : "error", detail);
    showStatus(detail, appliedCount > 0 ? "complete" : "error");
  }

  function buildCompletionDetail({
    appliedCount,
    failedChunks,
    remainingMissing,
    retryAttempts,
    domRescanApplied = 0
  }) {
    if (remainingMissing > 0) {
      return t("completionMissing", {
        applied: appliedCount,
        missing: remainingMissing,
        failed: failedChunks
      });
    }

    if (domRescanApplied > 0 && failedChunks > 0) {
      return t("completionDomRescanFailed", {
        applied: appliedCount,
        rescan: domRescanApplied,
        failed: failedChunks
      });
    }

    if (domRescanApplied > 0) {
      return t("completionDomRescan", {
        applied: appliedCount,
        rescan: domRescanApplied
      });
    }

    if (retryAttempts > 0 && failedChunks > 0) {
      return t("completionRetryFailed", {
        applied: appliedCount,
        failed: failedChunks
      });
    }

    if (retryAttempts > 0) {
      return t("completionRetry", { applied: appliedCount });
    }

    if (failedChunks) {
      return t("completionFailed", {
        applied: appliedCount,
        failed: failedChunks
      });
    }

    return t("completionOk", { applied: appliedCount });
  }

  async function promptLocalLlm({ prompt, targetLanguage, engine, signal }) {
    const localRequestId = createRequestId();
    state.activeLocalRequests.add(localRequestId);

    const requestPromise = chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.localTranslate,
      localRequestId,
      baseUrl: engine.baseUrl,
      model: engine.model,
      prompt,
      targetLanguage,
      uiLanguage: state.uiLanguage
    });

    const abortPromise = signal
      ? new Promise((_, reject) => {
        if (signal.aborted) {
          reject(createAbortError());
          return;
        }
        signal.addEventListener("abort", () => {
          cancelLocalLlmRequest(localRequestId);
          reject(createAbortError());
        }, { once: true });
      })
      : null;

    try {
      const response = await Promise.race(
        abortPromise ? [requestPromise, abortPromise] : [requestPromise]
      );
      if (!response?.ok) {
        throw new Error(response?.error || t("localCallFailed"));
      }
      return response.text;
    } finally {
      state.activeLocalRequests.delete(localRequestId);
    }
  }

  function cancelLocalLlmRequest(localRequestId) {
    try {
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.localCancel,
        localRequestId
      });
    } catch (error) {
      console.debug("Unable to cancel Local LLM request:", error);
    }
  }

  function withTimeout(promise, timeoutMs, signal, message) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = globalScope.setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);
    });

    const abort = signal
      ? new Promise((_, reject) => {
        if (signal.aborted) {
          reject(createAbortError());
          return;
        }
        signal.addEventListener("abort", () => reject(createAbortError()), { once: true });
      })
      : null;

    return Promise.race(abort ? [promise, timeout, abort] : [promise, timeout]).finally(() => {
      globalScope.clearTimeout(timeoutId);
    });
  }

  function collectTextItems(root, options = {}) {
    const startedAt = now();
    const viewport = getViewport();
    const metrics = {
      visitedTextNodes: 0,
      acceptedItems: 0,
      acceptedChars: 0,
      rejectedByParent: 0,
      rejectedByVisibility: 0,
      rejectedByText: 0,
      rejectedByViewport: 0,
      rejectedByTranslatedNode: 0,
      rejectedByTargetLanguage: 0,
      limitedByItems: false,
      limitedByChars: false,
      viewportOnly: options.viewportOnly !== false,
      viewportMarginPx: options.viewportMarginPx || 0,
      maxItemsPerRun: options.maxItemsPerRun || null,
      maxCharsPerRun: options.maxCharsPerRun || null,
      collectMs: 0
    };

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          metrics.visitedTextNodes += 1;
          const parent = node.parentElement;
          if (!parent) {
            metrics.rejectedByParent += 1;
            return NodeFilter.FILTER_REJECT;
          }
          if (core.isElementExcluded(parent) || !core.isElementVisible(parent)) {
            metrics.rejectedByVisibility += 1;
            return NodeFilter.FILTER_REJECT;
          }
          if (!core.shouldTranslateText(node.nodeValue)) {
            metrics.rejectedByText += 1;
            return NodeFilter.FILTER_REJECT;
          }
          if (options.excludeTranslatedNodes && state.translatedNodes.has(node)) {
            metrics.rejectedByTranslatedNode += 1;
            return NodeFilter.FILTER_REJECT;
          }
          if (
            options.skipTargetLanguageText &&
            core.shouldSkipDomRescanText(node.nodeValue, options.targetLanguage)
          ) {
            metrics.rejectedByTargetLanguage += 1;
            return NodeFilter.FILTER_REJECT;
          }
          if (
            options.viewportOnly !== false &&
            !isTextNodeInViewport(node, viewport, options.viewportMarginPx || 0)
          ) {
            metrics.rejectedByViewport += 1;
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const items = [];
    let charCount = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = core.normalizeWhitespace(node.nodeValue);
      const nextCharCount = charCount + text.length;
      if (options.maxItemsPerRun && items.length >= options.maxItemsPerRun) {
        metrics.limitedByItems = true;
        break;
      }
      if (options.maxCharsPerRun && items.length > 0 && nextCharCount > options.maxCharsPerRun) {
        metrics.limitedByChars = true;
        break;
      }

      let id = state.nodeIds.get(node);
      if (!id) {
        id = `t${state.nextId}`;
        state.nextId += 1;
        state.nodeIds.set(node, id);
      }

      if (!state.originals.has(id)) {
        state.originals.set(id, { node, text: node.nodeValue });
      }

      items.push({
        id,
        text,
        node
      });
      charCount = nextCharCount;
    }

    metrics.acceptedItems = items.length;
    metrics.acceptedChars = charCount;
    metrics.collectMs = elapsed(startedAt);
    return { items, metrics };
  }

  function isTextNodeInViewport(node, viewport, margin) {
    const ownerDocument = node.ownerDocument;
    if (!ownerDocument?.createRange) {
      return true;
    }

    const range = ownerDocument.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects());
    range.detach?.();
    return rects.some((rect) => core.rectIntersectsViewport(rect, viewport, margin));
  }

  function getViewport() {
    return {
      top: 0,
      left: 0,
      right: globalScope.innerWidth || document.documentElement.clientWidth || 0,
      bottom: globalScope.innerHeight || document.documentElement.clientHeight || 0
    };
  }

  function applyTranslations(items, translations, appliedIds = new Set()) {
    let count = 0;
    const ids = [];
    for (const item of items) {
      const translated = translations.get(item.id);
      const original = state.originals.get(item.id);
      if (!translated || !original?.node?.isConnected) {
        continue;
      }

      original.node.nodeValue = core.preserveOuterWhitespace(original.text, translated);
      state.translatedNodes.add(original.node);
      ids.push(item.id);
      if (!appliedIds.has(item.id)) {
        appliedIds.add(item.id);
        count += 1;
      }
    }
    return { count, ids };
  }

  function restorePage(options = {}) {
    const cancelledNow = !options.skipCancel && cancelActiveTranslation();
    if (!options.skipCancel) {
      state.cancelRequested = cancelledNow;
    }

    for (const original of state.originals.values()) {
      if (original.node?.isConnected) {
        original.node.nodeValue = original.text;
      }
    }
    state.originals.clear();
    state.nodeIds = new WeakMap();
    state.translatedNodes = new WeakSet();
    state.nextId = 1;
    state.active = false;

    if (!options.silent) {
      const detail = cancelledNow
        ? t("restoreCancelled")
        : t("restoreOk");
      reportStatus("restored", detail);
      showStatus(detail, "complete");
    }
  }

  function cancelActiveTranslation() {
    if (!state.running && !state.activeSession) {
      return false;
    }

    state.cancelRequested = true;
    perfLog("cancel-requested", {});
    state.abortController?.abort();
    state.activeSession?.destroy?.();
    for (const localRequestId of state.activeLocalRequests) {
      cancelLocalLlmRequest(localRequestId);
    }
    state.activeLocalRequests.clear();
    return true;
  }

  function showStatus(text, kind) {
    let host = document.querySelector("[data-ai-page-translator-ui='status']");
    if (!host) {
      host = document.createElement("div");
      host.setAttribute("data-ai-page-translator-ui", "status");
      host.setAttribute("role", "status");
      Object.assign(host.style, {
        position: "fixed",
        zIndex: "2147483647",
        top: "16px",
        right: "16px",
        maxWidth: "360px",
        padding: "10px 12px",
        borderRadius: "8px",
        font: "13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        color: "#ffffff",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
        pointerEvents: "none"
      });
      document.documentElement.appendChild(host);
    }

    const colors = {
      probing: "#2563eb",
      translating: "#7c3aed",
      complete: "#15803d",
      error: "#b91c1c"
    };
    host.style.background = colors[kind] || "#374151";
    host.textContent = text;

    if (kind === "complete" || kind === "error") {
      globalScope.setTimeout(() => {
        if (host.isConnected && host.textContent === text) {
          host.remove();
        }
      }, 5000);
    }
  }

  function reportStatus(statusState, detail) {
    try {
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.status,
        state: statusState,
        detail
      });
    } catch (error) {
      console.debug("Unable to report AllSight status:", error);
    }
  }

  function handleFatalError(error) {
    if (isCancellationError(error, state.abortController?.signal)) {
      reportStatus("restored", t("stopped"));
      showStatus(t("stopped"), "complete");
      state.running = false;
      return;
    }

    const detail = formatError(error);
    reportStatus("error", detail);
    showStatus(detail, "error");
    state.running = false;
  }

  function formatError(error) {
    if (!error) {
      return t("unknownError");
    }
    return error.message || String(error);
  }

  function assertNotCancelled(signal) {
    if (state.cancelRequested || signal?.aborted) {
      throw createAbortError();
    }
  }

  function isCancellationError(error, signal) {
    return state.cancelRequested ||
      signal?.aborted ||
      error?.name === "AbortError" ||
      /abort|cancel|중지|stopped/i.test(error?.message || "");
  }

  function normalizeUiLanguage(uiLanguage) {
    if (uiLanguage === "ko" || uiLanguage === "en") {
      return uiLanguage;
    }
    return String(globalScope.navigator?.language || "")
      .toLowerCase()
      .startsWith("ko")
      ? "ko"
      : "en";
  }

  function t(key, replacements = {}) {
    const dictionary = TEXT[state.uiLanguage] || TEXT.en;
    const template = dictionary[key] || TEXT.en[key] || key;
    return template.replace(/\{(\w+)\}/g, (_, name) => String(replacements[name] ?? ""));
  }

  function createAbortError() {
    return new DOMException("AllSight operation was cancelled.", "AbortError");
  }

  function now() {
    return globalScope.performance?.now?.() || Date.now();
  }

  function elapsed(start) {
    return Math.round((now() - start) * 10) / 10;
  }

  function createRequestId() {
    if (globalScope.crypto?.randomUUID) {
      return globalScope.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function perfLog(event, data = {}) {
    const entry = {
      event,
      at: new Date().toISOString(),
      ...data
    };
    state.perfEvents.push(entry);
    if (state.perfEvents.length > 200) {
      state.perfEvents.shift();
    }
    console.info(`[AiPageTranslator] ${JSON.stringify(entry)}`);
  }
})(globalThis);
