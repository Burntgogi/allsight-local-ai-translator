![AllSight Local AI Translator banner](assets/brand/github-title.png)

# AllSight Local AI Translator

Chrome MV3 웹 페이지 번역 확장입니다. Chrome 내장 AI(`LanguageModel`, Gemini Nano) 또는 사용자가 지정한 OpenAI 호환 Local LLM API로 현재 페이지의 DOM 텍스트를 번역합니다.

## 제작 아이디어

X.com(트위터)의 자동 번역 경험에서 출발해, LLM으로 웹 페이지 전체를 자연스럽게 번역하는 기능을 구상했습니다.

기본 설계는 Chrome의 Gemini Nano를 이용합니다. 다만 현재 Gemini Nano는 긴 페이지 번역 품질과 속도에서 부족한 부분이 있었고, 개발 중 체감상 Gemma3 또는 Gemma4 E2B급 소형 모델 기반일 가능성을 염두에 두었습니다. 그래서 사용자가 가진 Local LLM을 연결하는 기능을 추가했습니다.

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
```
