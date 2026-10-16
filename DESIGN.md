# Telos UI 디자인 노트

찾기, 비교, 근접도 온도가 제품의 중심이다. 기술 지도는 그 결과를 공간으로 보여 주는 보조 화면이고, 분쟁 사례는 같은 기술로 다툰 선례를 붙여 준다. 법령·공시는 **선택적 보조 근거**이며 별도 대시보드가 아니다.
밝은 테마 하나만 지원한다(토스형 카드 UI: 연회색 바탕, 흰 카드, 파란 주 동작). 테마 전환은 범위 밖이다.

## 1. 토큰 (`src/app/globals.css`)

| 토큰 | 값 | Tailwind 클래스 | 용도 |
|---|---|---|---|
| `--background` | `#f2f4f6` | `bg-background` | 페이지 바탕, 카드 안 입력창·보조 버튼 바탕 |
| `--panel` | `#ffffff` | `bg-panel` | 카드, 지도 영역, 지도 위 칩(`/90`, `/95`) |
| `--surface` | `#f9fafb` | `bg-surface` | 로딩 자리 표시, 연한 면 |
| `--border` | `#e5e8eb` | `border-border` | 구분선, 칩 테두리 |
| `--foreground` | `#191f28` | `text-foreground` `bg-foreground` | 본문, 검은 세그먼트·폰 전환 버튼 |
| `--ink-2` | `#4e5968` | `text-ink-2` | 2차 본문 |
| `--muted` | `#6b7684` | `text-muted` | 보조 텍스트, 메타 |
| `--accent` | `#3182f6` | `bg-accent` `text-accent` | 주 버튼(찾아보기), 선택 링, 포커스 링 |
| `--accent-strong` | `#1b64da` | `text-accent-strong` | 링크, 주 버튼 hover |
| `--accent-soft` | `#e8f3ff` | `bg-accent-soft` | 보조 동작(AI 분석까지, 기술 요소별 비교) |

서체는 Pretendard(`layout.tsx`에서 CDN 로드). `letter-spacing: -0.01em`.

색 규칙
- 심사 결과 점 색은 `DECISION_COLORS`, 밝은 바탕의 상태 태그는 `DECISION_TAG_STYLES`(`src/lib/colors.ts`)만 쓴다. 승인 초록, 거절 빨강, 심사중 회색, 상태 미확인 슬레이트.
- 근접도 색은 `PROXIMITY_STYLE`(`Comparison.tsx`)만 쓴다. 서늘 파랑, 따뜻 주황빛 노랑, 뜨거움 주황, 자료 부족 연보라. 심사 결과 색과 겹치지 않게 둔다.
- 분쟁 사례 핀은 보라(`#7c5cff`, 선택 `#5b3df5`, 연한 바탕 `#f0edff`). 근접도 '자료 부족'의 연보라보다 진하게 둔다.
- 오류는 `bg-red-50 text-red-700` 한 조합만 쓴다.

## 2. 타이포·간격

- 글자: 본문 `text-[15px]`, 카드 제목 `text-lg font-bold`, 상세 제목 `text-[22px] md:text-2xl font-extrabold`, 메타 `text-[13px]`, 주 버튼 `text-[17px] font-bold`.
- 카드: `rounded-3xl bg-panel p-5 md:p-6`. 카드 사이 `gap-3`.
- 모서리: 카드 `rounded-3xl`, 버튼·입력·목록 안 블록 `rounded-2xl`, 작은 버튼 `rounded-xl`, 칩 `rounded-full`, 상태 태그 `rounded-md`.
- 터치 영역: 주 버튼 `min-h-14`, 보조 버튼 `min-h-10`~`min-h-12`, 칩 `min-h-9`.

## 3. 컴포넌트 패턴

| 패턴 | 클래스 |
|---|---|
| 주 버튼 | `min-h-14 rounded-2xl bg-accent px-4 text-[17px] font-bold text-white hover:bg-accent-strong disabled:opacity-50` |
| 보조 버튼(강조) | `rounded-2xl bg-accent-soft px-5 font-bold text-accent-strong hover:brightness-95` |
| 보조 버튼(중립) | `min-h-10 rounded-xl bg-background px-3.5 text-sm font-semibold text-ink-2 hover:bg-border` |
| 입력 방식·검색어 칩 | `rounded-full`, 선택은 `bg-foreground text-white`, 나머지 `bg-background text-ink-2`. 폰에서는 `scroll-row`로 한 줄 가로 스크롤 |
| 지도 위 칩 | `min-h-9 rounded-full bg-panel/95 px-3 text-[13px] font-semibold shadow-sm backdrop-blur-sm`, 꺼진 필터는 `bg-panel/60 text-muted line-through` |
| 탭 | `grid grid-cols-2 rounded-2xl bg-background p-1`, 선택 탭 `bg-panel shadow-sm` |
| 펼침 카드 | `details.rounded-2xl border border-border bg-panel px-4`, 요약 줄에 아래 화살표 |
| 메타 목록 | `dl.grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm` (`dt` muted, `dd` ink-2) |

## 4. 화면 구성

### 배치 (`TelosApp`)
- `md` 이상: 왼쪽 열(입력 → 결과 → 비교, 이 열만 스크롤)과 오른쪽 기술 지도 카드. 왼쪽 열 폭 `md:520px`, `lg:640px`, `xl:720px`, `2xl:800px`. 지도는 나머지 폭.
- 폰(`md` 미만): 왼쪽 열 내용이 페이지 하나로 스크롤된다. 아래 가운데 검은 버튼으로 목록과 전체 화면 지도를 오간다. 버튼 이름은 상황에 따라 `지도 보기` / `지도에서 N건 보기` / `지도에서 위치 보기` / `목록 보기`.
- 데이터셋은 한국 KIPRIS 하나만 보인다. 미국 USPTO 샘플은 화면에서만 뺐고(`DATASETS`), API·데이터는 남아 있다. 샘플을 다시 보일 때도 한국 데이터처럼 표기하지 않는다.
- 헤더는 왼쪽 열 위에 붙는다(`sticky`, `bg-background/90 backdrop-blur-md`). 부제에 건수·색인 날짜·실시간 조회 가능 여부를 적는다.

### 찾기 (`SearchPanel`)
- 입력 방식 칩: 기술 설명 / 질문 / 특허·회사 / 카테고리. 예시 칩은 입력 후에도 남긴다.
- 동작 두 개: **찾아보기**(주 버튼, 빠른 검색) / **AI 분석까지**(보조, 에이전트 SSE, `⌘↵`). 서버에 `OPENAI_API_KEY`가 없으면(`PatentMapResponse.aiConfigured === false`) AI 분석까지·자동 비교·근접도 보기를 끄고 입력 아래에 안내를 띄운다. 이때 `⌘↵`는 찾아보기를 실행한다.
- 결과 순서: 근접도 온도 요약(`ProximitySummary`) → 검색 요약(기술 요소 칩, 검색어, 후보 수) → 결과 탭(관련 특허 / 분쟁 사례) → AI 답변 → 참고 자료.
- 관련 특허 탭: 근접도 필터 칩, 특허 카드(상태 태그, 출원일, 제목, 비교 요약 또는 초록, 근접도 배지, 검색 점수). 비교 전에는 `근접도 보기` 버튼.
- 검색 점수는 `검색 점수 0.83` 형식. 퍼센트 금지.
- 새 실행·중지·언마운트 시 `AbortController`로 이전 요청을 끊는다. SSE가 `done`/`error` 없이 닫히면 오류로 표시한다.
- 상태 줄은 `aria-live="polite"`, 오류 상자는 `role="alert"`.

### 근접도 온도 (`Comparison`, `ProximitySummary`)
- 온도 = 32° + (근거가 확인된 행 중 공통 비율 × 8°). 단계(서늘·따뜻·뜨거움·자료 부족)는 서버 `proximityOf`를 그대로 쓰고, 자료 부족이면 온도를 적지 않는다.
- 온도계 캐릭터(`ProximityFace`)와 "왜 이 온도인가요?" 설명을 함께 둔다. 법적 위험도·침해 확률이 아니라는 문구를 결과 아래에 항상 붙인다.

### 비교 (`PatentDetail`)
- 왼쪽 열에서 결과를 대신해 열린다. 맨 위 `결과로 돌아가기`(`Esc`).
- 순서: 특허 머리 카드(상태 태그, 출원번호, 검색 점수, 제목, 메타, 초록, 내 기술) → 기술 요소별 비교(공통·차이·확인 필요 필터, 원문 인용) → 청구항(`청구항 N건 보기` 토글, KIPRIS 최신 정보, 원문 링크) → 같은 기술로 다툰 분쟁 → `상담용 요약 복사` / `다른 특허 보기`.
- 한국 특허는 내부 ID 대신 `출원번호 N`. 청구항 원문의 번호를 그대로 쓴다.

### 분쟁 사례 (`DisputeCases`, `CasePanel`)
- 사례 데이터는 `src/lib/cases.ts`(정적, 24건). 결과의 분쟁 사례 탭과 비교 화면은 키워드가 겹친 사례를 보여 준다(`matchCases`).
- 사례 카드는 펼침 카드: 절차 태그, 원고 vs 피고, 기술, 기간 → 펼치면 분쟁 과정 단계, 결과, 판단 이유, 기술적·사업 영향, 식별 정보, 출처.
- 지도 핀: 사례 키워드가 2개 이상 제목·초록에 든 지도 점 묶음의 한가운데 점(`locateCases`, `src/lib/caseMap.ts`)에 보라 핀을 꽂는다. 사례에 나온 특허 자체가 아니라는 점을 `CasePanel`에 적는다.
- 핀이 있는 사례 카드에는 `지도에서 보기`. 누르거나 지도에서 핀을 누르면 왼쪽 열이 `CasePanel`(사례 + 키워드가 겹친 특허 목록)로 바뀌고, 지도는 검색 하이라이트 대신 겹친 특허를 강조한다. 범례의 `분쟁 사례 N` 칩으로 핀을 숨긴다.

### 기술 지도 (`PatentMap`)
- 왼쪽 위 오버레이: `기술 지도` 칩, 안내 칩, 심사 결과 필터 칩, 분쟁 사례 칩, 하이라이트(또는 사례 강조) 해제 칩. 폰에서 필터 칩은 한 줄 가로 스크롤.
- 지도 맞춤은 오버레이 높이(`MAP_OVERLAY_INSET`, 104px)를 위쪽에서 비운다. 오버레이 줄을 늘리면 이 값도 고친다.
- 선택 점은 파란 링, 하이라이트 점은 크게 그리고 어두운 테두리. 툴팁은 마우스일 때만 띄운다. 폰 지도 화면에서는 점·핀을 누르면 아래에 미리보기 카드가 뜬다.
- 빈 상태: 한국 색인 없음 → `KIPRIS_API_KEY`와 `pnpm sync:korea` 안내. 실패 → 메시지 + 다시 시도.

### 참고 자료 (`ResearchReferences`)
- 헤더에 "보조 근거 · 특허 결과와 별개"를 항상 표시한다.
- 출처 상태 칩: `법령 · API 키 설정됨 · 색인 N건` 형식. 환경변수 이름은 빈 상태 안내에만 쓴다.
- 항상 "참고 자료가 없다고 해서 적용되는 법령이나 경쟁사가 없다는 뜻은 아닙니다" 문구를 붙인다. 상태 값으로 거절 사유를 추정하지 않는다.

### 시연 모드 (`?demo=1`)
- `DemoFetch`가 한국 데이터셋 API(`/api/patents`, `/api/search`, `/api/compare`, `/api/patent`, `/api/agent`)를 `src/lib/demo.ts`의 예시 응답으로 대신한다. 키 없이 화면 흐름을 보여 주기 위한 것이며, 예시 제목·출원인에는 `[예시]`를 붙인다.

## 5. 반응형·접근성

- 가로 넘침 금지: `html, body { overflow-x: clip }`. 긴 제목·URL·ID는 `break-words`/`break-all`, flex 자식은 `min-w-0`.
- 폰 하단 고정 요소는 `env(safe-area-inset-bottom)`을 더한다. 왼쪽 열 아래 여백 `pb-28`로 전환 버튼에 내용이 가리지 않게 한다.
- 키보드 포커스: 전역 `:focus-visible` 링(`3px`, accent 45%).
- 모든 컨트롤에 보이는 라벨 또는 `aria-label`. 토글은 `aria-pressed`, 펼침은 `aria-expanded`/`details`, 탭은 `role="tab"`.
- `prefers-reduced-motion`에서는 펄스·스핀 애니메이션과 지도 카메라 이동 애니메이션을 끈다.
- 한국어는 `word-break: keep-all`, `text-wrap: pretty`.

## 6. 문구 규칙

- 한국어 UI는 해요체. 특허 제목은 원문 유지.
- 이모지·장식 기호 금지. 단축키 표기(`⌘↵`)는 허용.
- 퍼센트 유사도 금지, "검색 점수"로 통일. 근접도 온도는 법적 위험도가 아니라고 적는다.
- 없음을 단정하지 않는다: "참고 자료 없음"은 "관련 법령/경쟁사 없음"이 아니다.
- 환경변수는 이름만 안내하고 값은 보여주지 않는다.
