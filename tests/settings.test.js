const test = require("node:test");
const assert = require("node:assert/strict");

test("normalizes translator settings with Local LLM and full-page scope", async () => {
  const settingsModule = await import("../src/settings.js");
  const settings = settingsModule.normalizeSettings({
    translationEngine: "localLlm",
    translationScope: "page",
    localLlmBaseUrl: " http://localhost:1234/v1/ ",
    localLlmModel: "google/gemma-4-26b-it",
    localLlmModels: ["google/gemma-4-26b-it"],
    localLlmChunkMaxItems: "64",
    localLlmChunkMaxChars: "12000",
    localLlmFullPageRetryLimit: "5"
  });

  assert.equal(settings.translationEngine, "localLlm");
  assert.equal(settings.translationScope, "page");
  assert.equal(settings.localLlmBaseUrl, "http://localhost:1234/v1");
  assert.equal(settings.localLlmModel, "google/gemma-4-26b-it");
  assert.equal(settings.uiLanguage, "auto");
  assert.equal(settings.localLlmChunkMaxItems, 64);
  assert.equal(settings.localLlmChunkMaxChars, 12000);
  assert.equal(settings.localLlmFullPageRetryLimit, 5);
});

test("defaults to Chrome AI, browser language, and visible-page translation", async () => {
  const settingsModule = await import("../src/settings.js");
  const settings = settingsModule.normalizeSettings({});

  assert.equal(settings.translationEngine, "chromeAi");
  assert.equal(settings.translationScope, "viewport");
  assert.equal(settings.targetMode, "browser");
  assert.equal(settings.presetLanguage, "ko");
  assert.equal(settings.uiLanguage, "auto");
  assert.equal(settings.localLlmChunkMaxItems, 48);
  assert.equal(settings.localLlmChunkMaxChars, 7200);
  assert.equal(settings.localLlmFullPageRetryLimit, 3);
});

test("clamps Local LLM chunk settings to safe numeric bounds", async () => {
  const settingsModule = await import("../src/settings.js");
  const low = settingsModule.normalizeSettings({
    localLlmChunkMaxItems: "-1",
    localLlmChunkMaxChars: "10",
    localLlmFullPageRetryLimit: "-3"
  });
  const high = settingsModule.normalizeSettings({
    localLlmChunkMaxItems: "9999",
    localLlmChunkMaxChars: "999999",
    localLlmFullPageRetryLimit: "999"
  });

  assert.equal(low.localLlmChunkMaxItems, 1);
  assert.equal(low.localLlmChunkMaxChars, 500);
  assert.equal(low.localLlmFullPageRetryLimit, 0);
  assert.equal(high.localLlmChunkMaxItems, 200);
  assert.equal(high.localLlmChunkMaxChars, 50000);
  assert.equal(high.localLlmFullPageRetryLimit, 10);
});

test("normalizes and resolves UI language", async () => {
  const settingsModule = await import("../src/settings.js");

  assert.equal(settingsModule.normalizeSettings({ uiLanguage: "ko" }).uiLanguage, "ko");
  assert.equal(settingsModule.normalizeSettings({ uiLanguage: "en" }).uiLanguage, "en");
  assert.equal(settingsModule.normalizeSettings({ uiLanguage: "fr" }).uiLanguage, "auto");
  assert.equal(settingsModule.resolveUiLanguage({ uiLanguage: "auto" }, "ko-KR"), "ko");
  assert.equal(settingsModule.resolveUiLanguage({ uiLanguage: "auto" }, "en-US"), "en");
  assert.equal(settingsModule.resolveUiLanguage({ uiLanguage: "ko" }, "en-US"), "ko");
});
