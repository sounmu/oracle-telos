# PatenTrace — AI 특허 탐색기 (해커톤 MVP)

이 파일은 이 저장소에서 작업하는 모든 AI 에이전트와 사람이 먼저 읽는 문서다.
짧은 해커톤 일정이므로 **"동작하는 데모"가 최우선**이다. 완벽한 추상화보다 끝까지 이어지는 흐름을 먼저 만든다.

## 1. 서비스 요약

창업 지망생이 기존 특허를 간편하게 확인하고, 자기 아이템의 방향성을 정하도록 돕는다.

| 기능 | 설명 | 상태 |
|---|---|---|
| **기능 1 · 특허 지도 (메인 페이지)** | 기존 특허들을 임베딩 → 2D로 투영해 화면에 뿌린다. 승인된 특허와 **거절된 특허도 함께** 보이며 색으로 구분한다. 확대/이동, 호버, 클릭 시 상세 패널. | 구현 중 |
| **기능 2 · 아이템 세션** | 사업 아이템을 자연어(한국어 가능)로 입력하면 세션이 열리고 입력·탐색·검증·요약 4단계로 진행한다. 입력을 템플릿으로 바꿔 유사 특허를 조회하고, 조회 결과는 지도 위에서 하이라이트된다. 특허를 고르면 청구항 1 대비와 기술 요소별 비교를 볼 수 있다. | 구현 중 |

사용자 시나리오: "AI로 반려동물 식단을 추천하는 앱을 만들고 싶어요" → 유사 특허 N건 + 각 특허와의 겹침/차이 + 거절된 선행 사례가 있다면 왜 거절됐는지 힌트 + 방향 제안.

한국 확장에서도 **특허 지도와 특허 비교가 중심**이다. 법령·DART는 사용자가 선택한 경우에만 참고 패널/도구로 연결한다. 거절결정서 원문이 없으면 거절 이유를 추정하지 않는다. 한국 데이터가 없을 때 미국 샘플을 한국 데이터인 것처럼 대체하지 않는다.

## 2. 기술 스택

- **Next.js 16 (App Router, `src/` 디렉토리, Turbopack) + TypeScript strict + Tailwind v4** — 프론트와 API를 한 프로젝트에서.
- **패키지 매니저: pnpm** (`pnpm install`, `pnpm add`). npm/yarn 명령을 섞지 않는다.
- **임베딩: `@huggingface/transformers`** (transformers.js) 로컬 실행. 모델은 `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384차원, 다국어 → 한국어 아이디어와 영어 특허를 같은 공간에 놓을 수 있음). API 키 불필요.
- **2D 투영: `umap-js`** (데이터 빌드 시 1회 실행, 결과를 JSON에 저장).
- **지도 렌더링: Canvas + `d3-zoom` / `d3-quadtree`** (수천 개 점을 60fps로, 호버 탐색은 quadtree).
- **AI 에이전트: `openai`** (OpenAI Responses API + function calling). 자세한 규칙은 §5.
- **데이터: HUPD (Harvard USPTO Patent Dataset)** 2016년 1월 샘플. §4.
- **한국 데이터:** KIPRIS Plus, 국가법령정보 공동활용, Open DART. Node 런타임 XML 파싱은 `fast-xml-parser`, ZIP 파싱은 `fflate`, 스크립트 환경변수 로딩은 `@next/env`.
- **한국 색인:** 비공개 파일 기반 MVP (`data/raw/kipris/index.json`), 키워드·벡터 순위 결합. PostgreSQL/pgvector는 아직 도입하지 않았다.
- **한국 어휘 검색:** `src/lib/korea/bm25.ts`의 BM25(k1=1.2, b=0.75). Node `Intl.Segmenter` 단어 분할 + 한글 2/3글자 토큰, NFKC·소문자 정규화. 형태소 분석기는 아니다. 질의·청크에 같은 토크나이저를 쓰며, 조회 범위에 포함된 청크로 IDF·평균 길이를 계산한다. 청크 객체별 토큰 빈도를 WeakMap으로 캐시하고 BM25 순위와 임베딩 순위를 RRF로 결합한다. 추가 의존성·재임베딩은 필요 없다.
- **한국 검색은 하이브리드:** 검색할 때 KIPRIS를 키워드로 실시간 조회 → 색인에 없는 특허만 상세 수신(질의당 최대 20건, 에이전트는 2~3회 검색) → 로컬 색인에 캐시 → 임베딩+키워드 재정렬. `pnpm sync:korea`는 기본 지도 시드와 `--reindex` 전체 재배치용이다.

Next.js는 학습 데이터와 다른 부분이 많다. **코드를 쓰기 전에 `node_modules/next/dist/docs/`의 관련 문서를 읽는다** (아래 자동 생성 블록 참고).

## 3. 디렉토리 구조

```
AGENTS.md                   ← 이 문서
README.md                   ← 사람용 실행 안내
.env.example                ← 필요한 환경변수 목록 (실제 .env는 커밋 금지)
scripts/
  build-data.ts             ← HUPD 다운로드 → 샘플링 → 임베딩 → UMAP → 산출물 저장
  sync-korea.ts             ← 출처별 수집 → 정규화 → 변경 청크 임베딩 → 한국 색인
public/data/
  patents.json              ← 클라이언트가 받는 가벼운 특허 목록 (좌표, 제목, 결정, 요약 일부)
data/
  master/sample/vectors.f32 ← N×384 float32 (서버 전용, 유사도 검색용)
  master/sample/embedding.json ← 청구항/상세 설명 포함 전체 레코드 (서버 전용)
  raw/kipris/index.json     ← 한국 문서·벡터·지도 (비공개, Git 제외)
  raw/kipris/queries.json   ← 질의 캐시: 정규화한 질의 → KIPRIS 출원번호 (비공개, 7일 유효)
src/
  app/
    page.tsx                ← 메인: <TelosApp/> (세션 목록 + 지도 + 세션 단계)
    api/search/route.ts     ← POST {query, k, dataset?, decision?} → top-k (한국은 하이브리드, addedPoints·warnings 포함)
    api/agent/route.ts      ← POST {idea} → GPT 에이전트 (SSE, AgentEvent 스트림). 현재 화면에서는 호출하지 않는다
    api/compare/route.ts    ← POST {idea, id} → 기술 요소별 비교표 + 기술 근접도 (PatentComparison)
    api/patent/[id]/route.ts ← GET → 전체 레코드 (첫 청구항 포함)
    api/patents/route.ts     ← 한국/미국 샘플 지도 및 출처 준비 상태
    api/research/           ← 선택적 법령·공시 검색과 문서 상세
  lib/
    patents.ts              ← 서버에서 data/ 로드 (싱글턴, 프로세스당 1회)
    embeddings.ts           ← transformers.js 파이프라인 싱글턴 + embedTexts()
    similarity.ts           ← 코사인 유사도 / top-k
    agent.ts                ← OpenAI 도구 정의 + 시스템 프롬프트 + runPatentAgent(), planPatentSearch(), comparePatent()
    types.ts                ← Patent, PatentPoint, AgentEvent 등 공용 타입
    colors.ts               ← 결정별 색/라벨 (클라이언트·서버 공용)
    proximity.ts            ← 기술 근접도 단계 규칙·근거 판례·문구·색 (클라이언트·서버 공용)
    korea/                  ← 수집기, XML 경계, 스키마, 버전 색인·검색 (서버 전용)
      search.ts             ← searchKoreanPatents: 검색어 묶음 → KIPRIS 후보 → 제목·초록 선별 → 상위 상세 → 색인 캐시 → 재정렬
      compare.ts            ← 비교 초안의 원문 인용 검증(finalizeComparison)
  components/
    TelosApp.tsx            ← 상태 소유자: 세션, 점 목록, 필터, 하이라이트, 선택, 포커스
    Dashboard.tsx           ← 좌측 세션 목록과 새 대화
    SessionSteps.tsx        ← 세션 4단계(입력·탐색·검증·요약) 화면
    PatentMap.tsx           ← Canvas 산점도 (zoom/pan/hover/click/highlight)
    PatentDetail.tsx        ← 클릭한 특허 상세 (청구항 토글, 내 기술과 비교)
    Comparison.tsx          ← 기술 근접도 단계 표시와 청구항 1 대비표·기술 요소별 비교 카드
    ResearchReferences.tsx  ← 선택적 참고 자료와 원문·버전 표시
tests/                     ← 합성 출처 응답, 버전/검색, 하이브리드 캐시, API 회귀 테스트 (kipris-fixtures.ts는 공용 합성 XML)
.claude/launch.json         ← 데스크톱 앱 브라우저 미리보기용 dev 서버 설정
```

## 4. 데이터 파이프라인

- 원본: `https://huggingface.co/datasets/HUPD/hupd/resolve/main/data/sample-jan-2016.tar.gz` (약 387MB, 내부는 `sample/2016/<application_number>.json`).
- 레코드당 약 1MB(`full_description` 때문). **스트리밍으로 받으면서 필요한 건수만 뽑고 중단**한다. 전체를 디스크에 풀지 않는다.
- 사용하는 필드: `application_number`, `title`, `abstract`, `decision` (`ACCEPTED` | `REJECTED` | `PENDING`), `main_cpc_label`, `cpc_labels`, `filing_date`, `claims` (첫 청구항만 상세 패널/에이전트용으로 보관).
- 임베딩 입력 텍스트: `title + "\n" + abstract` (청구항 제외 — 길이·노이즈 문제).
- 임베딩은 **L2 정규화**해서 저장한다. 그래야 코사인 유사도 = 내적.
- `public/data/sample/embedding.json`의 점 타입:
  ```ts
  type PatentPoint = { id: string; title: string; decision: "ACCEPTED"|"REJECTED"|"PENDING"|"UNKNOWN"; cpc: string; x: number; y: number; filed: string; abstract: string /* 300자 내외 */ };
  ```
- HUPD 기본 건수는 3,000건. 환경변수 `PATENT_COUNT`로 조절. HUPD 산출물(`public/data/sample/embedding.json`, `data/master/sample/vectors.f32`, `data/master/sample/embedding.json`, `data/master/sample/manifest.json`)은 **커밋한다**. **한국 수집물 `data/korea/`는 예외이며 커밋/공개 정적 배포하지 않는다.**
- 색상 규칙(지도·범례·에이전트 설명 모두 동일): ACCEPTED = 초록 계열, REJECTED = 빨강/코랄 계열, PENDING = 회색.
- UNKNOWN은 별도 회색·"상태 미확인" 라벨이다. KIPRIS `공개`를 심사 중으로 간주하지 않는다.
- 한국 문서는 `ResearchDocument` 출처별 타입으로 보존하고, 법령 버전 시행일과 조문 시행일을 분리한다. 변경된 청크만 재임베딩하며 모델/차원이 바뀌면 재색인한다. `--remove`는 문서와 파생 청크·지도 점을 함께 제거한다.
- 초기 한국 수집은 제한된 범위다. 매번 동일 조건으로 재수집해 병합하고, 완전한 변경·삭제 피드 또는 전국 데이터 커버리지를 주장하지 않는다. ZIP은 압축 해제 크기를 제한한다.
- KIPRIS 수집은 출원일 최신순(`sortSpec=AD`, `descSort=true`)이며 기본 최대 100건이다. `--limit`으로 변경할 수 있고, 법령·공시의 기본 제한은 20건이다.
- **검색 시 실시간 캐시** (`searchKoreanPatents`): `KIPRIS_API_KEY`가 있으면 `searchKiprisLive`가 출원번호 최대 20건을 받고, 색인에 없는 번호만 상세를 받는다. 상세는 1건당 2회 호출이므로 **질의당 최대 20건(`LIVE_DETAIL_LIMIT`, 호출 최대 40회)**으로 제한한다. 전체 20초 제한이며, 상세 수신 중 시간이 다하면 받은 만큼만 캐시하고 경고를 남긴다(다음 검색이 나머지를 받는다).
- 검색 요청은 `{ description, queries }`다. 빠른 검색은 `planPatentSearch`가 기술 설명을 기술 요소 3~5개와 KIPRIS 검색어 2~4개로 나누고(OPENAI_API_KEY가 없거나 실패하면 입력 문장 하나), 에이전트 도구는 자기 키워드를 그대로 쓴다. 검색어마다 후보를 받아 출원번호로 중복 제거하고, 상세 조회 전에 검색 목록의 제목·초록을 기술 설명과 임베딩 유사도로 정렬해 색인에 없는 상위 `LIVE_DETAIL_LIMIT`건만 상세를 받는다. 최종 순위는 기술 설명(의미)과 검색어 묶음(키워드)으로 매기며, 확보한 후보 안의 순위다. 결과의 `coverage`에 검색어·후보 수·상세 수를 담는다.
- 검색 목록은 `data/raw/kipris/queries.json`에 검색어 단위로 캐시한다(NFKC·소문자·공백 정규화, **7일 유효**, 제목·초록·출원인 포함). 유효한 캐시가 있으면 `getAdvancedSearch`를 호출하지 않는다. 따라서 같은 검색어를 7일 안에 다시 실행하고 후보가 모두 색인에 있으면 KIPRIS 호출은 0회다. 파일에 쓸 수 없으면 프로세스 메모리에만 남긴다.
- KIPRIS 실패는 인증·호출 한도·네트워크·시간 초과로 나눠 warning으로 안내한다(`describeKiprisFailure`).
- **기술 요소별 비교**(`comparePatent`, `POST /api/compare`)는 검색과 같은 기술 요소를 쓰고, 모델에는 제목·초록·청구항 처음 5개만 보낸다(청구항 1은 대비의 기준이므로 `FIRST_CLAIM_CHARS` 6,000자까지 통째로, 나머지는 각 1,500자). 모델이 낸 인용이 그 원문에 그대로 있을 때만 공통/차이로 인정하고, 아니면 '확인되지 않음'으로 내린다. 내 기술에 없는 요소는 '미기재'. 이 표는 참고용이며 근접도에 쓰지 않는다.
- 같은 호출에서 **청구항 1 구성요소 대비표**(`claimChart`)도 만든다. 구성 문구는 청구항 1 원문에, 내 설명 대응 문구는 입력 설명에 글자 그대로 있어야 인정한다(`finalizeClaimChart`). 구성 문구가 원문에 없으면 표에서 빼고 '확인 필요' 개수로 센다. 대응 문구가 설명에 없으면 present/modified를 unconfirmed로 내린다. 정규화(NFKC·공백·인용부호 제거·소문자)한 구성 문구가 같은 행은 하나로 합치고, 상태가 서로 다르면 어느 쪽도 확정하지 않고 '확인 필요'(unconfirmed)로 남긴다(`dedupeClaimRows`, 구성 수·대응 수는 고유 구성 기준).
- 대비표가 청구항 1을 **끝까지 담았는지**(`Proximity.completeness`)를 함께 판정한다. 모델에 보낸 청구항 1이 6,000자를 넘어 잘렸으면 `truncated`, 청구항 1 원문에서 대비표 구성과 발명의 명칭을 지운 뒤, 첫 구성 앞에서는 청구항 번호와 "…에 있어서,"·"…로서," 꼴 전제 문구만 지우고(맨 앞 구성을 빠뜨려도 잡히게), "…를 포함하는 X." 꼴 종결 주어를 빼고, 연결 문구·수량 표현(복수의·제1·도면 부호 등)·조사·문장부호를 제거해도 2자 이상 남는 문구는 `uncovered`(최대 3개, 화면에 그대로 표시)로 돌려준다(`uncoveredClaimText`). 단위가 붙은 수치·범위("5V", "40℃", "1~5mm", "10% 이상", "2개")가 남으면 길이와 무관하게 `uncovered`다. 모델이 숫자를 빼고 구성을 인용하면 수치 조건이 검토되지 않은 것이므로 전체 대응으로 보지 않는다. 이 검사는 글자 기준 휴리스틱이므로 '모두 대응'·'다른 수단 포함' 판정을 막는 데만 쓰고, 빠진 구성의 개수를 세거나 '추출된 구성'을 '전체 구성'으로 표현하는 데 쓰지 않는다.
- **기술 근접도**(`proximityOf`)는 임베딩 점수나 비율 구간이 아니라 청구항 1 대비표에 구성요소 완비 원칙(대법원 98후836)과 균등 판단 틀(대법원 2017후424)을 순서대로 적용한다. 실행 순서는 화면의 `PROXIMITY_RULES`와 같다: 설명에 없는 구성 1개 이상 → 빠진 구성 있음(원문 확인 구성이 하나뿐이어도), 원문 확인 구성 2개 미만 → 자료 부족, 청구항 1이 잘림 → 자료 부족, 확인 못 한 구성 있음 → 자료 부족, 대비표에 담기지 않은 원문 있음 → 자료 부족, 다른 수단 구성 있음 → 다른 수단 포함, 모두 같음 → 모두 대응. 화면 라벨은 `PROXIMITY_LABELS`에 두고, 내부 키(`cool`·`warm`·`hot`·`insufficient`)는 화면에 쓰지 않는다. 화면 숫자는 "대응 구성/전체 구성"이며 다른 척도로 환산하지 않는다. 규칙과 판례 출처는 `PROXIMITY_RULES`·`PROXIMITY_SOURCES`에 두고 "왜 이 단계인가요?"에 그대로 보여 준다. 법적 위험도·침해 확률이 아니며, 색은 특허 상태 색(초록·빨강·회색)과 겹치지 않게 둔다. 비교는 특허 상세 패널의 '기술 요소별 비교' 버튼을 눌렀을 때만 실행한다(자동 비교 없음).
- `upsertLivePatents`는 새 청크만 임베딩하고(`buildResearchIndex`와 해시 재사용 로직 공유) UMAP을 다시 돌리지 않는다. 새 점 좌표 = 코사인 top-5 기존 점 좌표의 유사도 가중 평균. 기존 점이 3개 이하면 기존 배치 규칙(UMAP/두 축)을 전체에 다시 적용한다. **전체 재배치는 `pnpm sync:korea --reindex`에서만** 한다.
- 색인 쓰기는 프로세스 내 Promise 체인으로 직렬화한다. 파일 쓰기가 실패하면(읽기 전용 FS) 메모리 캐시로 유지하고 경고만 남긴다. 키가 없거나 실패·시간 초과면 로컬 색인만 검색하고 warning을 함께 돌려준다. 색인 파일이 없어도 실시간 결과로 새 색인을 만든다.

## 5. OpenAI API 규칙 (반드시 지킬 것)

- **공식 SDK만 사용**: `openai` 패키지. `fetch`로 직접 호출하지 않는다. Chat Completions가 아니라 **Responses API**(`client.responses.stream`)를 쓴다.
- **모델은 `OPENAI_MODEL` 환경변수**(기본 `gpt-5.5`), 추론 강도는 `OPENAI_REASONING_EFFORT`(기본 `low`). 둘 다 `src/lib/agent.ts` 상단에서만 읽는다. 코드에 모델명을 흩뿌리지 않는다.
- 클라이언트는 `new OpenAI()` 인자 없이 생성 → `OPENAI_API_KEY` 환경변수에서 읽는다. 키를 코드에 넣지 않는다. 키가 없으면 생성자가 던지므로 try/catch로 안내 메시지를 보낸다.
- 도구는 `strict: true` function tool. strict 모드는 모든 프로퍼티가 `required`여야 하므로 선택 값은 `nullable`(`type: ["string","null"]`)로 선언한다. 도구 인자는 JSON.parse 후 zod로 검증하고 실패하면 `{error}`를 돌려준다.
- `planPatentSearch`와 `comparePatent`는 루프 없는 단일 호출이다. 같은 `client.responses.stream`을 쓰고 `text.format`을 strict `json_schema`로 두며, 결과는 zod로 검증한다. 두 결과 모두 프로세스 메모리에 캐시한다(같은 기술 설명 → 같은 기술 요소).
- 에이전트 루프는 `runPatentAgent`의 for 루프 하나뿐이다: 스트림에서 `response.output_text.delta`를 그대로 전달 → `finalResponse()`의 `function_call` 항목을 실행 → `function_call_output`만 `input`으로, `previous_response_id`로 대화를 이어간다. `instructions`는 이어지지 않으므로 매 요청에 다시 보낸다. 최대 10회.
- 기본 도구는 `search_patents`, `get_patent(id, refresh|null)`. 한국 `search_patents`는 `searchKoreanPatents`(실시간 KIPRIS + 로컬 캐시)를 쓰며, query는 문장이 아니라 **한국어 핵심 기술 키워드 2~4개**다. 도구 출력은 `{ results, warnings }`이고, 새로 캐시된 점은 `matches`보다 먼저 `points_added` 이벤트로 보내 지도에 병합한다(클라이언트는 id 기준 중복 없이 병합). `includeContext=true`일 때만 `search_laws`, `get_law_article`, `search_disclosures`, `get_disclosure`를 추가한다. 한국 상세는 청구항 처음 최대 5개를 각 1,500자 이하로 제공하고 전체 확인으로 표현하지 않는다.
- `response.status === "incomplete"`(출력 길이 초과 등)는 에러 이벤트로 바꿔 보낸다.
- 서버 → 클라이언트 이벤트는 `AgentEvent` 유니온(`src/lib/types.ts`) 하나로만 주고받는다. 새 이벤트가 필요하면 타입부터 추가.
- 한국 색인은 한국어 질의, HUPD 미국 샘플은 영어 질의를 사용한다. 사용자 언어로 답하되 특허 제목은 원문 유지. 검색 점수는 등록 가능성/침해 확률이 아니다.

## 6. 실행 명령

```bash
pnpm install              # 의존성
cp .env.example .env      # OPENAI_API_KEY 채우기
pnpm build:data           # 데이터 파이프라인 (첫 실행 시 모델 ~120MB + 특허 수십 MB 다운로드)
pnpm sync:korea --help    # 한국 수집·증분 색인·삭제 방법
pnpm test                 # 합성 출처 응답과 검색/API 회귀 테스트
pnpm experiment:search --dry-run # 다섯 검색 방식 비교 입력·예상 호출 확인 (호출 없음)
pnpm experiment:search    # 임베딩/기존 키워드/BM25/최종 하이브리드/기술 비교; OpenAI 호출, KIPRIS 호출 없음
pnpm dev                  # http://localhost:3000
pnpm typecheck            # tsc --noEmit
pnpm lint
```

배포 메모: `onnxruntime-node`는 동적 `require`로 네이티브 바이너리를 불러와 Next 파일 트레이싱이 놓친다. 그래서 `next.config.ts`의 `outputFileTracingIncludes`에서 직접 넣는다 (Vercel·standalone 공통). Vercel에서는 임베딩 모델을 `/tmp`에 받으므로 콜드 스타트 첫 검색이 느리다.

## 7. 작업 원칙

발표용 검색 실험은 `scripts/experiments/compare-search-methods.ts`, 설명은 `docs/research/search-comparison-presentation.md`에 있다. 서비스 UI에 검색 모드를 추가하지 않는다. 동일 색인·청크에서 임베딩 단독, 기존 부분 문자열 단독, BM25 단독, 최종 RRF(임베딩+BM25), RRF 상위 후보 기술 요소 재정렬을 비교한다. 기술 재정렬은 공통/전체 요소 비율을 쓰며 확인된 요소가 2개 미만인 후보는 자리를 유지한다. 독립 정답이 없으면 정확도·상관성·우월성을 주장하지 않는다. 한국 색인 스냅샷·원문 인용·실험 결과는 `.cache/experiments/`에만 저장하고 커밋하지 않는다.

1. **끝까지 통하는 흐름 먼저.** 지도 → 점 클릭 → 상세, 아이템 입력 → 탐색 조회 → 지도 하이라이트. 이 두 흐름이 깨지면 다른 작업을 멈추고 먼저 고친다.
2. **데이터 산출물 없이도 앱이 떠야 한다.** `public/data/sample/embedding.json`이 없으면 빈 지도 + "pnpm build:data를 실행하세요" 안내를 보여준다. 크래시 금지.
3. **서버 전용 모듈**(`src/lib/patents.ts`, `embeddings.ts`, `agent.ts`, `similarity.ts`, `korea/*`)은 서버 모듈·route handler·`scripts/`·테스트에서만 import한다. `src/components/`에서 절대 import하지 않는다 (transformers.js·fs가 클라이언트 번들에 들어가면 빌드가 깨진다). `server-only` 패키지는 쓰지 않는다 — `tsx` 스크립트에서 import하면 예외가 나기 때문.
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
