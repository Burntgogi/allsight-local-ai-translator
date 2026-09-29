const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../src/content-core.js");

test("shouldTranslateText rejects empty, punctuation-only, and numeric-only text", () => {
  assert.equal(core.shouldTranslateText("   "), false);
  assert.equal(core.shouldTranslateText("... --- !!!"), false);
  assert.equal(core.shouldTranslateText("12345"), false);
});

test("shouldTranslateText accepts natural language snippets", () => {
  assert.equal(core.shouldTranslateText("Hello world"), true);
  assert.equal(core.shouldTranslateText("今日は良い天気です。"), true);
});

test("isProbablyKorean requires meaningful Hangul content", () => {
  assert.equal(core.isProbablyKorean("안녕하세요. 오늘은 좋은 날씨입니다."), true);
  assert.equal(core.isProbablyKorean("Hello, this is English."), false);
  assert.equal(core.isProbablyKorean("한국어 English English English English"), false);
});

test("language helpers canonicalize and detect strict output languages", () => {
  assert.equal(core.canonicalizeLanguageCode("pt_br"), "pt-BR");
  assert.equal(core.languageBase("ko-KR"), "ko");
  assert.equal(core.isStrictOutputLanguage("en-US"), true);
  assert.equal(core.isStrictOutputLanguage("ko-KR"), false);
});

test("isProbablyTargetLanguage validates known output scripts", () => {
  assert.equal(core.isProbablyTargetLanguage("안녕하세요", "ko-KR"), true);
  assert.equal(core.isProbablyTargetLanguage("こんにちは", "ja"), true);
  assert.equal(core.isProbablyTargetLanguage("Hello there", "en"), true);
  assert.equal(core.isProbablyTargetLanguage("Hello there", "ko"), false);
  assert.equal(core.isProbablyTargetLanguage("hasil terjemahan", "id"), true);
});

test("preserveOuterWhitespace keeps original leading and trailing whitespace", () => {
  assert.equal(
    core.preserveOuterWhitespace("  Hello world\n", "안녕하세요"),
    "  안녕하세요\n"
  );
});

test("chunkItems respects item and character limits", () => {
  const items = Array.from({ length: 7 }, (_, index) => ({
    id: `t${index}`,
    text: "abc"
  }));
  const chunks = core.chunkItems(items, { maxItems: 3, maxChars: 100 });
  assert.deepEqual(chunks.map((chunk) => chunk.length), [3, 3, 1]);

  const charChunks = core.chunkItems(items, { maxItems: 10, maxChars: 7 });
  assert.deepEqual(charChunks.map((chunk) => chunk.length), [2, 2, 2, 1]);
});

test("rectIntersectsViewport respects margins and zero-size rectangles", () => {
  const viewport = { top: 0, left: 0, right: 100, bottom: 100 };
  assert.equal(
    core.rectIntersectsViewport({ top: 10, left: 10, right: 20, bottom: 20, width: 10, height: 10 }, viewport),
    true
  );
  assert.equal(
    core.rectIntersectsViewport({ top: 120, left: 10, right: 20, bottom: 130, width: 10, height: 10 }, viewport),
    false
  );
  assert.equal(
    core.rectIntersectsViewport({ top: 120, left: 10, right: 20, bottom: 130, width: 10, height: 10 }, viewport, 30),
    true
  );
  assert.equal(
    core.rectIntersectsViewport({ top: 10, left: 10, right: 10, bottom: 20, width: 0, height: 10 }, viewport),
    false
  );
});

test("default translation chunks are small enough for viewport translation", () => {
  const items = Array.from({ length: 25 }, (_, index) => ({
    id: `t${index}`,
    text: "x".repeat(200)
  }));
  const chunks = core.chunkItems(items, { maxItems: 12, maxChars: 1800 });
  assert.ok(chunks.every((chunk) => chunk.length <= 9));
  assert.equal(chunks.length, 3);
});

test("parseTranslationResponse returns matching translated text only", () => {
  const result = core.parseTranslationResponse(
    JSON.stringify([
      { id: "t1", translatedText: "안녕하세요" },
      { id: "t2", translatedText: "" },
      { id: "x", translatedText: "무시" },
      { id: "t3", translatedText: "좋은 날씨입니다" }
    ]),
    ["t1", "t2", "t3"]
  );

  assert.equal(result.get("t1"), "안녕하세요");
  assert.equal(result.has("t2"), false);
  assert.equal(result.has("x"), false);
  assert.equal(result.get("t3"), "좋은 날씨입니다");
});

test("parseTranslationResponse accepts fenced JSON", () => {
  const result = core.parseTranslationResponse(
    "```json\n[{\"id\":\"t1\",\"translatedText\":\"안녕\"}]\n```",
    ["t1"]
  );
  assert.equal(result.get("t1"), "안녕");
});

test("parseTranslationResponse extracts JSON arrays from surrounding model text", () => {
  const result = core.parseTranslationResponse(
    "Here is the translation:\n[{\"id\":\"t1\",\"translatedText\":\"안녕\"}]\nDone.",
    ["t1"]
  );
  assert.equal(result.get("t1"), "안녕");
});

test("parseTranslationResponse ignores trailing text after a JSON array", () => {
  const result = core.parseTranslationResponse(
    "[{\"id\":\"t1\",\"translatedText\":\"안녕\"}]\nDone.",
    ["t1"]
  );
  assert.equal(result.get("t1"), "안녕");
});

test("getMissingTranslationItems returns untranslated ids in original order", () => {
  const items = [
    { id: "t1", text: "one" },
    { id: "t2", text: "two" },
    { id: "t3", text: "three" }
  ];
  const missing = core.getMissingTranslationItems(items, new Set(["t1", "t3"]));

  assert.deepEqual(missing.map((item) => item.id), ["t2"]);
});

test("translation telemetry helpers distinguish response omissions from unapplied ids", () => {
  const items = [
    { id: "t1", text: "one" },
    { id: "t2", text: "two" },
    { id: "t3", text: "three" }
  ];
  const translations = new Map([
    ["t1", "하나"],
    ["t3", "셋"]
  ]);

  assert.deepEqual(
    core.getMissingFromResponseIds(items, translations),
    ["t2"]
  );
  assert.deepEqual(
    core.getUnappliedTranslationIds(translations, ["t1"]),
    ["t3"]
  );
});

test("retry chunk limits shrink progressively for missing retries", () => {
  const limits = { chunkMaxItems: 48, chunkMaxChars: 7200 };

  assert.deepEqual(core.getRetryChunkLimits(limits, 1), {
    chunkMaxItems: 24,
    chunkMaxChars: 3600
  });
  assert.deepEqual(core.getRetryChunkLimits(limits, 2), {
    chunkMaxItems: 12,
    chunkMaxChars: 1800
  });
  assert.deepEqual(core.getRetryChunkLimits(limits, 3), {
    chunkMaxItems: 6,
    chunkMaxChars: 900
  });
});

test("dom rescan skips already translated target-language text", () => {
  assert.equal(core.shouldSkipDomRescanText("이미 번역된 문장입니다.", "ko"), true);
  assert.equal(core.shouldSkipDomRescanText("This source text still needs translation.", "ko"), false);
  assert.equal(core.shouldSkipDomRescanText("English text can still be translated to Spanish.", "es"), false);
});

test("buildTranslationPrompt includes strict JSON-only instruction and ids", () => {
  const prompt = core.buildTranslationPrompt(
    [{ id: "t1", text: "Hello" }],
    "ko"
  );
  assert.match(prompt, /Return only a JSON array/);
  assert.match(prompt, /Avoid literal, translationese phrasing/);
  assert.match(prompt, /natural Korean/);
  assert.match(prompt, /Target language is Korean \(한국어\)/);
  assert.match(prompt, /Do not copy Japanese source text/);
  assert.match(prompt, /Never use the key text in the output/);
  assert.match(prompt, /already Korean/);
  assert.match(prompt, /"id":"t1"/);
  assert.match(prompt, /"sourceText":"Hello"/);
  assert.doesNotMatch(prompt, /"text":"Hello"/);
});

test("translation prompts distinguish strict and forced language modes", () => {
  const strictPrompt = core.buildTranslationPrompt([{ id: "t1", text: "Hello" }], "en", {
    forceTargetLanguage: false
  });
  const forcedPrompt = core.buildTranslationPrompt([{ id: "t1", text: "Hello" }], "ko", {
    forceTargetLanguage: true
  });
  assert.match(strictPrompt, /declared output language naturally/);
  assert.doesNotMatch(strictPrompt, /not declared as a model capability/);
  assert.match(forcedPrompt, /not declared as a model capability/);
});

test("retry translation prompts explicitly require every omitted id", () => {
  const prompt = core.buildTranslationPrompt([{ id: "t2", text: "Retry me" }], "ko", {
    forceTargetLanguage: true,
    retryMissing: true
  });

  assert.match(prompt, /retry for items omitted/);
  assert.match(prompt, /Return every input id exactly once/);
  assert.match(prompt, /"id":"t2"/);
});

test("non-Korean target prompts do not preserve Korean as the output language", () => {
  const prompt = core.buildTranslationPrompt([{ id: "t1", text: "안녕하세요" }], "en", {
    forceTargetLanguage: false
  });
  assert.match(prompt, /Translate every input item into English/);
  assert.doesNotMatch(prompt, /already Korean/);
  assert.doesNotMatch(prompt, /non-Korean source text/);

  const probePrompt = core.buildProbePrompt("en", {
    forceTargetLanguage: false
  });
  assert.doesNotMatch(probePrompt, /Do not answer in English/);
});

test("parseTranslationResponse accepts translation alias but not copied source text key", () => {
  const result = core.parseTranslationResponse(
    JSON.stringify([
      { id: "t1", translation: "안녕하세요" },
      { id: "t2", text: "こんにちは" }
    ]),
    ["t1", "t2"]
  );

  assert.equal(result.get("t1"), "안녕하세요");
  assert.equal(result.has("t2"), false);
});
