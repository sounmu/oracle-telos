# Telos — AI 특허 탐색기 (해커톤 MVP)

이 파일은 이 저장소에서 작업하는 모든 AI 에이전트와 사람이 먼저 읽는 문서다.
짧은 해커톤 일정이므로 **"동작하는 데모"가 최우선**이다. 완벽한 추상화보다 끝까지 이어지는 흐름을 먼저 만든다.

## 1. 서비스 요약

창업 지망생이 기존 특허를 간편하게 확인하고, 자기 아이템의 방향성을 정하도록 돕는다.

| 기능 | 설명 | 상태 |
|---|---|---|
| **기능 1 · 특허 지도 (메인 페이지)** | 기존 특허들을 임베딩 → 2D로 투영해 화면에 뿌린다. 승인된 특허와 **거절된 특허도 함께** 보이며 색으로 구분한다. 확대/이동, 호버, 클릭 시 상세 패널. | 구현 중 |
| **기능 2 · AI 특허 검색** | 사용자가 구상 중인 아이디어를 자연어(한국어 가능)로 입력하면 GPT 에이전트가 유사 특허를 찾아 비교·설명한다. 찾은 특허는 지도 위에서 하이라이트된다. | 구현 중 |

사용자 시나리오: "AI로 반려동물 식단을 추천하는 앱을 만들고 싶어요" → 유사 특허 N건 + 각 특허와의 겹침/차이 + 거절된 선행 사례가 있다면 왜 거절됐는지 힌트 + 방향 제안.

## 2. 기술 스택

- **Next.js 16 (App Router, `src/` 디렉토리, Turbopack) + TypeScript strict + Tailwind v4** — 프론트와 API를 한 프로젝트에서.
- **패키지 매니저: pnpm** (`pnpm install`, `pnpm add`). npm/yarn 명령을 섞지 않는다.
- **임베딩: `@huggingface/transformers`** (transformers.js) 로컬 실행. 모델은 `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384차원, 다국어 → 한국어 아이디어와 영어 특허를 같은 공간에 놓을 수 있음). API 키 불필요.
- **2D 투영: `umap-js`** (데이터 빌드 시 1회 실행, 결과를 JSON에 저장).
- **지도 렌더링: Canvas + `d3-zoom` / `d3-quadtree`** (수천 개 점을 60fps로, 호버 탐색은 quadtree).
- **AI 에이전트: `openai`** (OpenAI Responses API + function calling). 자세한 규칙은 §5.
- **데이터: HUPD (Harvard USPTO Patent Dataset)** 2016년 1월 샘플. §4.

Next.js는 학습 데이터와 다른 부분이 많다. **코드를 쓰기 전에 `node_modules/next/dist/docs/`의 관련 문서를 읽는다** (아래 자동 생성 블록 참고).

## 3. 디렉토리 구조

```
AGENTS.md                   ← 이 문서
README.md                   ← 사람용 실행 안내
.env.example                ← 필요한 환경변수 목록 (실제 .env는 커밋 금지)
scripts/
  build-data.ts             ← HUPD 다운로드 → 샘플링 → 임베딩 → UMAP → 산출물 저장
public/data/
  patents.json              ← 클라이언트가 받는 가벼운 특허 목록 (좌표, 제목, 결정, 요약 일부)
data/
  embeddings.f32            ← N×384 float32 (서버 전용, 유사도 검색용)
  patents.full.json         ← 청구항/상세 설명 포함 전체 레코드 (서버 전용)
src/
  app/
    page.tsx                ← 메인: <TelosApp/> (지도 + 우측 검색 패널)
    api/search/route.ts     ← POST {query, k, decision?} → 임베딩 코사인 유사도 top-k
    api/agent/route.ts      ← POST {idea} → GPT 에이전트 (SSE, AgentEvent 스트림)
    api/patent/[id]/route.ts ← GET → 전체 레코드 (첫 청구항 포함)
  lib/
    patents.ts              ← 서버에서 data/ 로드 (싱글턴, 프로세스당 1회)
    embeddings.ts           ← transformers.js 파이프라인 싱글턴 + embedTexts()
    similarity.ts           ← 코사인 유사도 / top-k
    agent.ts                ← OpenAI 도구 정의 + 시스템 프롬프트 + runPatentAgent()
    types.ts                ← Patent, PatentPoint, AgentEvent 등 공용 타입
    colors.ts               ← 결정별 색/라벨 (클라이언트·서버 공용)
  components/
    TelosApp.tsx            ← 상태 소유자: 점 목록, 필터, 하이라이트, 선택, 포커스
    PatentMap.tsx           ← Canvas 산점도 (zoom/pan/hover/click/highlight)
    SearchPanel.tsx         ← 아이디어 입력 + 에이전트 SSE 스트리밍 + 빠른 검색
    PatentDetail.tsx        ← 클릭한 특허 상세 (청구항 토글)
.claude/launch.json         ← 데스크톱 앱 브라우저 미리보기용 dev 서버 설정
```

## 4. 데이터 파이프라인

- 원본: `https://huggingface.co/datasets/HUPD/hupd/resolve/main/data/sample-jan-2016.tar.gz` (약 387MB, 내부는 `sample/2016/<application_number>.json`).
- 레코드당 약 1MB(`full_description` 때문). **스트리밍으로 받으면서 필요한 건수만 뽑고 중단**한다. 전체를 디스크에 풀지 않는다.
- 사용하는 필드: `application_number`, `title`, `abstract`, `decision` (`ACCEPTED` | `REJECTED` | `PENDING`), `main_cpc_label`, `cpc_labels`, `filing_date`, `claims` (첫 청구항만 상세 패널/에이전트용으로 보관).
- 임베딩 입력 텍스트: `title + "\n" + abstract` (청구항 제외 — 길이·노이즈 문제).
- 임베딩은 **L2 정규화**해서 저장한다. 그래야 코사인 유사도 = 내적.
- `public/data/patents.json`의 점 타입:
  ```ts
  type PatentPoint = { id: string; title: string; decision: "ACCEPTED"|"REJECTED"|"PENDING"; cpc: string; x: number; y: number; filed: string; abstract: string /* 300자 내외 */ };
  ```
- 기본 건수는 3,000건. 환경변수 `PATENT_COUNT`로 조절. 산출물(`public/data/patents.json`, `data/*`)은 **커밋한다** — 심사·데모 환경에서 파이프라인을 다시 돌리지 않아도 앱이 떠야 한다.
- 색상 규칙(지도·범례·에이전트 설명 모두 동일): ACCEPTED = 초록 계열, REJECTED = 빨강/코랄 계열, PENDING = 회색.

## 5. OpenAI API 규칙 (반드시 지킬 것)

- **공식 SDK만 사용**: `openai` 패키지. `fetch`로 직접 호출하지 않는다. Chat Completions가 아니라 **Responses API**(`client.responses.stream`)를 쓴다.
- **모델은 `OPENAI_MODEL` 환경변수**(기본 `gpt-5.5`), 추론 강도는 `OPENAI_REASONING_EFFORT`(기본 `low`). 둘 다 `src/lib/agent.ts` 상단에서만 읽는다. 코드에 모델명을 흩뿌리지 않는다.
- 클라이언트는 `new OpenAI()` 인자 없이 생성 → `OPENAI_API_KEY` 환경변수에서 읽는다. 키를 코드에 넣지 않는다. 키가 없으면 생성자가 던지므로 try/catch로 안내 메시지를 보낸다.
- 도구는 `strict: true` function tool. strict 모드는 모든 프로퍼티가 `required`여야 하므로 선택 값은 `nullable`(`type: ["string","null"]`)로 선언한다. 도구 인자는 JSON.parse 후 zod로 검증하고 실패하면 `{error}`를 돌려준다.
- 에이전트 루프는 `runPatentAgent`의 for 루프 하나뿐이다: 스트림에서 `response.output_text.delta`를 그대로 전달 → `finalResponse()`의 `function_call` 항목을 실행 → `function_call_output`만 `input`으로, `previous_response_id`로 대화를 이어간다. `instructions`는 이어지지 않으므로 매 요청에 다시 보낸다. 최대 10회.
- 도구는 두 개: `search_patents(query, k, decision|null)` (의미 검색), `get_patent(id)` (첫 청구항 포함 상세). 도구 결과 텍스트는 짧게(청구항 1,500자 제한).
- `response.status === "incomplete"`(출력 길이 초과 등)는 에러 이벤트로 바꿔 보낸다.
- 서버 → 클라이언트 이벤트는 `AgentEvent` 유니온(`src/lib/types.ts`) 하나로만 주고받는다. 새 이벤트가 필요하면 타입부터 추가.
- 한국어 입력을 받아도 특허 원문은 영어다. 시스템 프롬프트에 "사용자 언어로 답하되 특허 제목은 원문 유지"를 명시한다.

## 6. 실행 명령

```bash
pnpm install              # 의존성
cp .env.example .env      # OPENAI_API_KEY 채우기
pnpm build:data           # 데이터 파이프라인 (첫 실행 시 모델 ~120MB + 특허 수십 MB 다운로드)
pnpm dev                  # http://localhost:3000
pnpm typecheck            # tsc --noEmit
pnpm lint
```

배포 메모: `onnxruntime-node`는 동적 `require`로 네이티브 바이너리를 불러와 Next 파일 트레이싱이 놓친다. 그래서 `next.config.ts`의 `outputFileTracingIncludes`에서 직접 넣는다 (Vercel·standalone 공통). Vercel에서는 임베딩 모델을 `/tmp`에 받으므로 콜드 스타트 첫 검색이 느리다.

## 7. 작업 원칙

1. **끝까지 통하는 흐름 먼저.** 지도 → 점 클릭 → 상세, 아이디어 입력 → 에이전트 응답 → 지도 하이라이트. 이 두 흐름이 깨지면 다른 작업을 멈추고 먼저 고친다.
2. **데이터 산출물 없이도 앱이 떠야 한다.** `public/data/patents.json`이 없으면 빈 지도 + "pnpm build:data를 실행하세요" 안내를 보여준다. 크래시 금지.
3. **서버 전용 모듈**(`src/lib/patents.ts`, `embeddings.ts`, `agent.ts`, `similarity.ts`)은 route handler와 `scripts/`에서만 import한다. `src/components/`에서 절대 import하지 않는다 (transformers.js·fs가 클라이언트 번들에 들어가면 빌드가 깨진다). `server-only` 패키지는 쓰지 않는다 — `tsx` 스크립트에서 import하면 예외가 나기 때문.
4. 타입은 `src/lib/types.ts`에 모은다. `any` 금지. SDK 타입(`OpenAI.Responses.Tool`, `ResponseInput` 등)은 재정의하지 않고 그대로 쓴다.
5. 새 라이브러리는 꼭 필요할 때만. 추가하면 이 문서 §2를 갱신한다.
6. 구조·규칙이 바뀌면 **이 문서를 같이 고친다.** 문서와 코드가 다르면 코드가 아니라 문서가 틀린 것으로 간주하고 바로 수정한다.
7. 커밋은 의미 단위로 작게. 메시지는 한국어·영어 무관, 한 줄 요약 + 필요 시 본문.
8. 데모 UI는 다크 테마 기본, 데스크톱 우선. 모바일 대응은 후순위.

## 8. 하지 말 것

- `full_description`을 JSON에 넣지 않는다 (용량 폭발).
- 클라이언트에서 임베딩/유사도 계산을 하지 않는다 (서버 API 경유).
- API 키·`.env`·`node_modules`·모델 캐시(`.cache/`)를 커밋하지 않는다.
- 데이터 빌드 스크립트와 서버가 **다른 임베딩 모델**을 쓰게 만들지 않는다. 모델 이름은 `src/lib/embeddings.ts` 한 곳에만 둔다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
