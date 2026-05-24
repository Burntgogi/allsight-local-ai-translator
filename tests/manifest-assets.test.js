const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("manifest uses AllSight branding and existing icon assets", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifest.json"), "utf8")
  );

  assert.equal(manifest.name, "AllSight Local AI Translator");
  assert.equal(manifest.action.default_title, "AllSight Local AI Translator");

  for (const size of ["16", "32", "48", "128"]) {
    const iconPath = manifest.icons[size];
    const actionIconPath = manifest.action.default_icon[size];
    assert.equal(actionIconPath, iconPath);
    assert.equal(fs.existsSync(path.join(root, iconPath)), true);
  }
});

test("manifest does not hard-code private Local LLM hosts", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifest.json"), "utf8")
  );
  const hostPermissions = manifest.host_permissions || [];

  assert.deepEqual(hostPermissions, [
    "http://localhost/*",
    "https://localhost/*",
    "http://127.0.0.1/*",
    "https://127.0.0.1/*"
  ]);
});

test("github title banner exists", () => {
  assert.equal(
    fs.existsSync(path.join(root, "assets", "brand", "github-title.png")),
    true
  );
});

test("options page exposes UI language switch and LM Studio guide links", () => {
  const optionsHtml = fs.readFileSync(path.join(root, "src", "options.html"), "utf8");

  assert.match(optionsHtml, /id="ui-language"/);
  assert.match(optionsHtml, /https:\/\/lmstudio\.ai\/download/);
  assert.match(optionsHtml, /https:\/\/lmstudio\.ai\/docs\/developer\/core\/server/);
  assert.match(optionsHtml, /https:\/\/lmstudio\.ai\/docs\/developer\/openai-compat/);
});

test("readme defaults to English and keeps Korean docs with centered language switch", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

  assert.match(readme, /<p align="center">/);
  assert.ok(readme.indexOf("## English") < readme.indexOf("## 한국어"));
  assert.match(readme, /AllSight Local AI Translator is a Chrome MV3 extension/);
  assert.match(readme, /X\.com\(트위터\)/);
  assert.match(readme, /Chrome의 Gemini Nano/);
  assert.match(readme, /Local LLM/);
  assert.match(readme, /https:\/\/lmstudio\.ai\/download/);
  assert.match(readme, /https:\/\/lmstudio\.ai\/docs\/developer\/core\/server/);
});
