# Chrome Web Store 업로드 준비

## 패키지 만들기

```powershell
npm run check
npm test
npm run package:store
```

업로드 파일:

```text
dist/allsight-local-ai-translator-0.1.0.zip
```

ZIP에는 Chrome 확장 실행에 필요한 `manifest.json`, `src/`, `assets/`만 포함합니다.

## 대시보드 절차

1. [Chrome 웹 스토어 개발자 대시보드](https://chrome.google.com/webstore/devconsole)에 접속합니다.
2. 새 항목을 만들고 `dist/allsight-local-ai-translator-0.1.0.zip`을 업로드합니다.
3. 스토어 등록정보를 작성합니다.
4. 개인정보 처리 관련 항목을 작성합니다.
5. 공개 전에는 자동 게시를 끄고 검토 승인 후 수동 게시로 스테이징합니다.
6. 초기 테스트는 비공개 또는 일부 공개 배포로 진행합니다.

## 등록정보 초안

짧은 설명:

```text
Chrome AI 또는 사용자가 지정한 Local LLM으로 웹 페이지를 로컬 중심으로 번역합니다.
```

상세 설명:

```text
AllSight Local AI Translator는 현재 웹 페이지의 DOM 텍스트를 번역하는 Chrome 확장입니다.

기본 모드는 Chrome 내장 AI(LanguageModel, Gemini Nano)를 사용합니다. 옵션에서 Local LLM을 켜면 LM Studio 등 OpenAI 호환 로컬 서버를 사용할 수 있습니다.

주요 기능:
- 보이는 페이지만 번역
- 전체 페이지 번역
- 번역 중지 및 원문 복원
- Chrome AI 또는 Local LLM 선택
- 목적 언어 설정
- Local LLM 청크 크기 조절

Google Translate, Translator API, Gemini Cloud API를 번역 엔진으로 사용하지 않습니다. Local LLM 모드는 사용자가 옵션에 입력한 endpoint만 호출합니다.
```

카테고리:

```text
Productivity
```

언어:

```text
Korean, English
```

## 권한 설명

`activeTab`:

```text
사용자가 현재 탭에서 우클릭 메뉴나 단축키로 번역을 요청했을 때 해당 페이지의 표시 텍스트를 읽고 번역문으로 교체하기 위해 사용합니다.
```

`contextMenus`:

```text
페이지 번역, 전체 페이지 번역, 원문 복원, 지원 상태 검사, 설정 메뉴를 우클릭 메뉴에 표시하기 위해 사용합니다.
```

`scripting`:

```text
사용자가 번역을 요청한 현재 탭에 content script를 주입하기 위해 사용합니다.
```

`storage`:

```text
목적 언어, 표시 언어, Local LLM API 주소, 모델명, 청크 설정을 저장하기 위해 사용합니다.
```

Host permissions:

```text
localhost와 127.0.0.1의 OpenAI 호환 Local LLM API에 접근하기 위해 사용합니다.
```

## 개인정보 처리 설명

```text
확장은 자체 서버를 운영하지 않으며 개발자에게 데이터를 전송하지 않습니다.

Chrome AI 모드는 Chrome 내장 AI API를 사용합니다.

Local LLM 모드는 사용자가 옵션에 저장한 localhost 또는 127.0.0.1 endpoint로 번역 요청을 보냅니다. 페이지 텍스트는 사용자가 지정한 Local LLM 서버로만 전송됩니다.

설정값은 chrome.storage.sync에 저장됩니다. API 키는 요구하지 않습니다.
```

## 참고 문서

- [Chrome Extensions: 확장 프로그램 게시](https://developer.chrome.com/docs/extensions/develop/migrate/publish-mv3?hl=ko)
- [Chrome 웹 스토어 개발자 대시보드](https://chrome.google.com/webstore/devconsole)
