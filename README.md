![AllSight Local AI Translator banner](assets/brand/github-title.png)

# AllSight Local AI Translator

<p align="center">
  <a href="#english">English</a> · <a href="#korean">한국어</a>
</p>

## English

AllSight Local AI Translator is a Chrome MV3 extension that translates web page DOM text with Chrome built-in AI (`LanguageModel`, Gemini Nano) or an OpenAI-compatible Local LLM endpoint configured by the user.

## Idea

The project was inspired by X.com (Twitter) automatic translation. The goal is to make web page translation more natural with an LLM while keeping the translation path local or user-controlled.

The default design uses Chrome Gemini Nano. In practice, Gemini Nano has been limited for long page translation quality and speed, so Local LLM support was added for users who already run stronger local models.

Chrome AI mode does not use Google Translate, the `Translator API`, or Gemini Cloud API as a translation engine. Local LLM mode calls only the endpoint saved in the extension options.

## Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load this folder as an unpacked extension.
4. For Chrome AI mode, enable these flags if needed.
   - `chrome://flags/#optimization-guide-on-device-model`
   - `chrome://flags/#prompt-api-for-gemini-nano`
5. Check model status in `chrome://on-device-internals`.

## Use

Right-click a web page and choose an AllSight menu item.

- `AllSight: Translate visible page`
- `AllSight: Translate full page`
- `AllSight: Restore original`
- `AllSight: Check support`
- `AllSight: Options`

Keyboard shortcuts:

- `Ctrl+Shift+Y`: check support
- `Ctrl+Shift+L`: translate visible page
- `Ctrl+Shift+F`: translate full page
- `Ctrl+Shift+U`: stop and restore original text

## Local LLM

For first-time Local LLM users, [LM Studio](https://lmstudio.ai/download) is recommended.

1. Install LM Studio.
2. Download and load a translation model in LM Studio.
3. Start the API server from the Developer tab.
4. Turn on `Use Local LLM` in the extension options.
5. Enter an API base URL, for example `http://localhost:1234/v1`.
6. Click `Check API`, then select a model.
7. Save and run translation from the page context menu.

LM Studio docs:

- [Download](https://lmstudio.ai/download)
- [API server](https://lmstudio.ai/docs/developer/core/server)
- [OpenAI-compatible endpoints](https://lmstudio.ai/docs/developer/openai-compat)

Recommended models are default Gemma4 or default Qwen3.6 families. If the selected model name is detected as `Gemma4`, requests include `temperature=1.0`, `top_p=0.95`, and `top_k=64`. Other models do not receive extra sampling overrides.

`Local LLM chunk text count` is the number of DOM text fragments grouped into one request. `Local LLM chunk character limit` is the total source-text character budget for the same request. A new request starts when either limit is reached.

## Development

```powershell
npm run check
npm test
npm run package:store
```

The store package is generated under `dist/` and includes only `manifest.json`, `src/`, and `assets/`.

<a id="korean"></a>

## 한국어

AllSight Local AI Translator는 Chrome 내장 AI(`LanguageModel`, Gemini Nano) 또는 사용자가 지정한 OpenAI 호환 Local LLM API로 현재 웹 페이지의 DOM 텍스트를 번역하는 Chrome MV3 확장입니다.

## 제작 아이디어

X.com(트위터)의 자동 번역 경험에서 출발해, LLM으로 웹 페이지 전체를 자연스럽게 번역하는 기능을 구상했습니다.

기본 설계는 Chrome의 Gemini Nano를 이용합니다. 다만 현재 Gemini Nano는 긴 페이지 번역 품질과 속도에서 부족한 부분이 있어, 더 강한 로컬 모델을 쓰는 사용자를 위해 Local LLM 연동 기능을 추가했습니다.

Chrome AI 모드는 Google Translate, `Translator API`, Gemini Cloud API를 번역 엔진으로 호출하지 않습니다. Local LLM 모드는 옵션에서 지정한 endpoint만 호출합니다.

## 설치

1. `chrome://extensions`를 엽니다.
2. 개발자 모드를 켭니다.
3. 이 폴더를 압축해제된 확장으로 로드합니다.
4. Chrome AI 모드는 필요 시 다음 flag를 켭니다.
   - `chrome://flags/#optimization-guide-on-device-model`
   - `chrome://flags/#prompt-api-for-gemini-nano`
5. 모델 상태는 `chrome://on-device-internals`에서 확인합니다.

## 사용

웹 페이지에서 우클릭 후 AllSight 메뉴를 선택합니다.

- `AllSight: 보이는 페이지만 번역`
- `AllSight: 전체 페이지 번역`
- `AllSight: 번역 해제`
- `AllSight: 지원 상태 검사`
- `AllSight: 설정`

단축키:

- `Ctrl+Shift+Y`: 지원 상태 검사
- `Ctrl+Shift+L`: 보이는 페이지만 번역
- `Ctrl+Shift+F`: 전체 페이지 번역
- `Ctrl+Shift+U`: 중지 및 원문 복원

## Local LLM

처음 Local LLM을 쓰는 사용자는 [LM Studio](https://lmstudio.ai/download)를 권장합니다.

1. LM Studio를 설치합니다.
2. LM Studio에서 번역용 모델을 다운로드하고 로드합니다.
3. Developer 탭에서 API server를 시작합니다.
4. 확장 옵션에서 `Local LLM 사용`을 켭니다.
5. API 주소를 입력합니다. 예: `http://localhost:1234/v1`
6. `API 확인`을 눌러 모델 목록을 불러오고 사용할 모델을 선택합니다.
7. 저장 후 페이지에서 번역을 실행합니다.

LM Studio 공식 문서:

- [다운로드](https://lmstudio.ai/download)
- [API 서버 실행](https://lmstudio.ai/docs/developer/core/server)
- [OpenAI 호환 endpoint](https://lmstudio.ai/docs/developer/openai-compat)

추천 모델은 기본 Gemma4 또는 기본 Qwen3.6 계열입니다. 모델명이 `Gemma4`로 감지되면 요청에 `temperature=1.0`, `top_p=0.95`, `top_k=64`를 포함합니다. 다른 모델은 sampling 값을 추가 지정하지 않습니다.

`Local LLM 청크 텍스트 개수`는 한 번의 요청에 묶는 DOM 텍스트 조각 수입니다. `Local LLM 청크 최대 문자 수`는 같은 요청에 포함하는 원문 텍스트의 총 문자 기준입니다. 둘 중 하나가 먼저 한계에 닿으면 다음 요청으로 나뉩니다.

## 개발

```powershell
npm run check
npm test
npm run package:store
```

스토어 패키지는 `dist/` 아래에 생성되며 `manifest.json`, `src/`, `assets/`만 포함합니다.
