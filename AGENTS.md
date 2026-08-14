# AGENTS.md

## 적용 범위

이 문서는 저장소 전체에서 작업하는 GitHub Copilot 및 기타 코딩 에이전트에
적용됩니다. 하위 디렉터리에 더 구체적인 `AGENTS.md`가 추가되면 해당
디렉터리에서는 가장 가까운 문서의 지침을 우선합니다.

## 프로젝트 개요

이 저장소는 NEIS 공개 API를 활용해 초중고 학교의 중식 메뉴를 조회하는
웹 애플리케이션과 그 개발 과정을 설명하는 워크숍입니다.

- `frontend/`: React 19, TypeScript 5.8, Vite 7과 Fluent UI로 구현한
  프론트엔드
- `backend/`: FastAPI, Pydantic, HTTPX로 구현한 Python 백엔드
- `compose.yml`: 프론트엔드, 백엔드와 Playwright E2E 서비스를 실행하는
  Docker Compose 구성
- `frontend/src/`: UI, 백엔드 API 클라이언트와 프론트엔드 통합 테스트
- `frontend/e2e/`: Playwright E2E 테스트
- `backend/app/`: API 엔드포인트, 도메인 모델과 NEIS 클라이언트
- `backend/tests/`: 백엔드 단위·통합 테스트
- `data/openapi.json`: NEIS 외부 API 계약
- `src/openapi.json`: 프론트엔드와 백엔드 사이의 내부 API 계약
- `PRD.md`, `TRD.md`: 제품 및 기술 요구사항
- `docs/`: 단계별 워크숍 가이드
- `.github/`: 이슈·Pull Request 템플릿과 CI 구성

새로운 구조나 명령을 추측하지 말고 작업 시점에 존재하는 코드, 구성 파일,
`PRD.md`와 `TRD.md`를 기준으로 작업하세요.

## 기술 스택과 도구

### 프론트엔드

- Node.js 24와 npm을 사용합니다. CI와 Docker 이미지도 Node.js 24를
  사용합니다.
- npm 의존성은 `frontend/package.json`과 `frontend/package-lock.json`으로
  관리합니다.
- UI는 React와 Fluent UI, 빌드·개발 서버는 Vite, 정적 타입 검사는
  TypeScript를 사용합니다.
- ESLint로 TypeScript와 React Hooks 규칙을 검사하고, Vitest,
  Testing Library와 jsdom으로 통합 테스트를 실행합니다.
- Playwright는 `frontend/e2e/`의 브라우저 기반 E2E 테스트에만 사용합니다.

### 백엔드

- Python 3.11 이상이 필요하며 CI와 Docker 이미지는 Python 3.12를
  사용합니다.
- Python 의존성과 pytest 설정은 `backend/pyproject.toml`에서 관리합니다.
- FastAPI가 내부 HTTP API를 제공하고, Pydantic이 요청·응답 및 외부 데이터
  검증을 담당하며, HTTPX 비동기 클라이언트가 NEIS API를 호출합니다.
- pytest와 pytest-asyncio로 단위·통합 테스트를 실행합니다.

### 컨테이너

- `backend/Dockerfile`은 Uvicorn으로 FastAPI 앱을 실행합니다.
- `frontend/Dockerfile`은 Vite 정적 산출물을 빌드하고 Nginx로 제공하며,
  `frontend/nginx.conf`가 `/api/` 요청을 백엔드 서비스로 프록시합니다.
- `compose.yml`의 `backend`, `frontend`, `e2e` 서비스 이름과 헬스체크를
  유지하세요. `e2e` 서비스는 `test` 프로필에서만 실행됩니다.

## 설치, 실행 및 검증 명령

명령은 아래에 표시된 디렉터리에서 실행하세요. 의존성이나 스크립트를
추가하지 않은 상태에서 임의의 도구나 명령을 만들지 마세요.

### 프론트엔드

```sh
cd frontend
npm ci
npm run dev
```

Vite 개발 서버는 기본적으로 `http://localhost:5173`에서 실행되며 `/api`
요청을 `http://localhost:8000`으로 프록시합니다.

```sh
cd frontend
npm run lint
npm run build
npm test
```

`npm run build`는 `tsc --noEmit -p tsconfig.app.json` 타입 검사 후 Vite
프로덕션 빌드를 실행합니다. 별도의 프론트엔드 포맷 스크립트는 현재
구성되어 있지 않습니다.

### 백엔드

```sh
cd backend
python -m venv .venv
# 사용 중인 셸에서 .venv를 활성화합니다.
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload
```

백엔드는 저장소 루트의 `.env`를 읽고 기본적으로
`http://localhost:8000`에서 실행됩니다. API 문서는
`http://localhost:8000/api/docs`에서 확인할 수 있습니다.

```sh
cd backend
pytest
```

백엔드에는 현재 별도의 포맷터, 린터 또는 정적 타입 검사기가 구성되어 있지
않습니다. 해당 검사를 필요로 하는 변경에서는 먼저 프로젝트 구성과
의존성 변경 범위를 검토하고 승인된 도구를 구성한 뒤 명령을 문서화하세요.

### 전체 애플리케이션과 E2E

저장소 루트에서 `.env.example`을 `.env`로 복사하고 실제
`NEIS_API_KEY`를 로컬에만 설정한 후 실행합니다.

```sh
docker compose config
docker compose up --build
```

프론트엔드는 `http://localhost:3000`, 백엔드는
`http://localhost:8000`에서 제공됩니다.

Compose 환경의 E2E 테스트는 저장소 루트에서 다음 순서로 실행합니다.

```sh
docker compose up --build --detach --wait frontend
docker compose --profile test run --rm e2e
docker compose --profile test down --volumes
```

## 일반 작업 지침

- 사용자 요청과 관련 이슈의 인수 조건을 먼저 확인하고 필요한 범위만
  변경하세요.
- 이 문서보다 구체적인 기존 코드, 구성, 문서 및 저장소 규칙을 우선하고
  서로 충돌하는 지침을 발견하면 임의로 결정하지 마세요.
- 기존 파일을 불필요하게 덮어쓰거나 관련 없는 코드와 문서를 정리하지
  마세요.
- 가장 단순하고 명확한 구현을 선택하고 실제 재사용 요구 없이 계층,
  추상화, 프레임워크 또는 범용 유틸리티를 추가하지 마세요.
- 기존 명명법, 디렉터리 구조, 한국어 UI 문구와 형식 패턴을 유지하세요.
- 동작, 공개 인터페이스, 구성 또는 개발 절차가 바뀌면 `README.md`,
  `PRD.md`, `TRD.md`와 관련 워크숍 문서를 함께 검토하세요.
- 데이터 손실을 일으킬 수 있는 명령, 대규모 자동 변환 또는 의존성 전체
  업그레이드는 명시적인 요청 없이 수행하지 마세요.
- 공개 API, 데이터 형식 또는 사용자 경험의 호환성을 깨는 변경은 명시적인
  요구사항과 문서화 없이 도입하지 마세요.
- 범위가 불명확하거나 기존 규칙과 요청이 충돌하면 구현 전에 확인하세요.

## 프론트엔드 규칙

- 프론트엔드는 NEIS API를 직접 호출하거나 `NEIS_API_KEY`를 읽지 않습니다.
  모든 학교·급식 데이터는 `/api` 백엔드 경계를 통해 조회하세요.
- 백엔드 호출은 `frontend/src/api.ts`에 모으고 외부 응답을 `unknown`으로
  받은 뒤 런타임 검증을 거쳐 `frontend/src/types.ts`의 도메인 타입으로
  변환하세요.
- `src/openapi.json`의 엔드포인트, 매개변수, 응답 및 오류 계약을
  준수하세요. 계약을 바꾸면 TypeScript 타입, 백엔드 모델과 관련 문서를
  같은 변경에서 동기화하세요.
- 엄격한 타입을 유지하고 `any`, 불필요한 타입 단언, null 가능성을 숨기는
  non-null assertion을 사용하지 마세요.
- 비동기 작업의 로딩, 성공, 빈 결과와 실패 상태를 명시적으로 처리하고
  Promise 오류를 무시하지 마세요. 연속 요청에서는 이전 요청을 취소하거나
  가장 최근 응답만 반영하세요.
- 기존 Fluent UI 컴포넌트와 접근 가능한 레이블·상태 메시지를 유지하고,
  원문 HTML을 직접 렌더링하지 마세요.
- 의존성은 npm으로 변경하고 `package-lock.json`을 직접 편집하지 마세요.

## 백엔드 규칙

- 공개 함수, 메서드와 Pydantic 모델에 구체적인 타입을 사용하고 타입 검사를
  피하기 위한 `Any`나 무분별한 타입 무시를 사용하지 마세요.
- API 요청, 환경 변수와 NEIS 응답은 신뢰 경계에서 검증하고 도메인 모델로
  변환한 뒤 사용하세요.
- NEIS 연동은 `backend/app/neis.py`의 비동기 클라이언트 경계를 유지하세요.
  요청마다 클라이언트를 만들거나 비동기 경로에서 블로킹 I/O를 사용하지
  말고, 앱 수명 주기에서 리소스를 명시적으로 닫으세요.
- `data/openapi.json`의 NEIS 경로와 매개변수 계약을 준수하고 중식 조회에는
  `MMEAL_SC_CODE=2`를 사용하세요.
- 잘못된 입력, 데이터 없음, 타임아웃, 제한 응답과 외부 API 실패를 구분해
  처리하세요. 예외를 광범위하게 포착하거나 오류를 성공 값처럼 반환하지
  마세요.
- API 키가 없으면 외부 요청 전에 명시적인 오류를 반환하고, 키나 요청
  자격 증명을 로그에 기록하지 마세요.
- 의존성은 `backend/pyproject.toml`에서 관리하고 표준 라이브러리나 기존
  의존성으로 해결할 수 있는 문제에 새 패키지를 추가하지 마세요.

## 테스트 작성 원칙

- 프론트엔드 통합 테스트는 `frontend/src/**/*.test.tsx`에 작성하고 Vitest와
  Testing Library로 사용자 흐름을 검증하세요. TRD에 따라 프론트엔드
  컴포넌트별 단위 테스트를 별도로 늘리지 않습니다.
- 프론트엔드 테스트는 `fetch`를 모킹하고 정상 흐름뿐 아니라 검색 결과 없음,
  잘못된 날짜, 급식 정보 없음, API 오류와 연속 요청을 검증하세요.
- 백엔드 단위·통합 테스트는 `backend/tests/`에 작성하세요. NEIS 파싱과
  오류·재시도 분기는 HTTPX 전송 계층을 모킹하고, FastAPI 엔드포인트는
  의존성 오버라이드와 ASGI 전송을 사용하세요.
- E2E 테스트는 `frontend/e2e/`에 작성하고 Playwright로 학교 검색부터
  급식 표시까지 전체 사용자 흐름을 검증하세요.
- 테스트에서 실제 NEIS API나 실제 API 키를 사용하지 말고 외부 호출을
  결정적으로 모킹하세요.
- 변경한 동작에는 정상 경로와 중요한 실패 경로를 검증하는 테스트를
  추가하거나 수정하고, 버그 수정에는 회귀 테스트를 포함하세요.
- 작업을 마치기 전에 변경 영역에 구성된 테스트, 린트, 타입 검사와 빌드를
  실행하세요. 검사를 우회하거나 기존 테스트를 삭제·약화하지 마세요.

## 보안과 데이터 관리

- API 키, 토큰, 자격 증명, 개인정보 또는 기타 비밀정보를 코드, 예제,
  로그와 커밋에 포함하지 마세요.
- 실제 값이 있는 `.env`는 커밋하지 말고 `.env.example`에는 자리표시자만
  유지하세요. 브라우저 빌드 인수나 `VITE_` 변수에 비밀정보를 넣지 마세요.
- 최소 권한을 적용하고 인증서 검증, 입력 검증 또는 보안 검사를 편의를 위해
  비활성화하지 마세요.
- `data/*.xlsx`, `data/openapi.json`, `src/openapi.json`,
  `frontend/package-lock.json` 같은 원본·생성 산출물은 출처와 갱신 절차를
  확인한 뒤 변경하세요. 생성 산출물을 손으로 편집해 원본과 불일치시키지
  마세요.
- 취약점은 공개 이슈로 등록하지 말고 `SECURITY.md`의 비공개 신고 절차를
  따르세요.

## 문서화

- 문서는 현재 구현과 실행 가능한 절차만 설명하고 아직 구현되지 않은
  기능을 완료된 것처럼 표현하지 마세요.
- 명령, 경로, 구성 키와 코드 식별자는 백틱으로 표시하고 저장소 내부 링크는
  상대 경로를 사용하세요.
- API 계약을 변경하면 관련 OpenAPI 명세, `PRD.md`, `TRD.md`와 사용 문서를
  함께 갱신하세요.
- 기존 문서의 언어, 용어, 제목 구조와 Markdown 스타일을 유지하세요.
- 자동 검사가 없는 문서나 데이터 변경은 구조, 링크, 형식과 요구사항을
  수동으로 확인하고 검증 내용을 Pull Request에 기록하세요.

## Git 커밋 및 Pull Request

- 직접 브랜치를 생성하는 경우 `CONTRIBUTING.md`에 따라 `feat/`, `fix/`,
  `docs/` 중 하나의 접두사를 사용하세요. 도구가 브랜치를 자동으로
  생성·관리하는 환경에서는 해당 도구의 브랜치를 그대로 사용하세요.
- 커밋 메시지는 `CONTRIBUTING.md`의 Conventional Commits 형식을 따르고
  하나의 논리적 변경에 집중하세요.
- 관련 없는 변경을 같은 커밋이나 Pull Request에 포함하지 마세요.
- Pull Request는 `.github/PULL_REQUEST_TEMPLATE.md`의 모든 섹션과
  체크리스트를 실제 변경 내용에 맞게 작성하세요.
- 관련 이슈는 `Closes #<번호>` 형식으로 연결하고 수행한 검증 명령 또는
  수동 확인 내용을 기록하세요.
- 자체 검토와 관련 로컬 검사를 완료한 뒤 PR을 만들고, 사용자 검토 없이
  병합하지 마세요.
