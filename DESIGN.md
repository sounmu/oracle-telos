# Telos UI 디자인 노트

특허 지도 + AI 특허 비교가 제품의 전부다. 법령·공시는 **선택적 보조 근거**이며 별도 대시보드가 아니다.
다크 테마 하나만 지원한다. 테마 전환·브랜딩 변경은 범위 밖이다.

## 1. 토큰 (`src/app/globals.css`)

| 토큰 | 값 | Tailwind 클래스 | 용도 |
|---|---|---|---|
| `--background` | `#0b0f17` | `bg-background` | 페이지·입력창 바탕 |
| `--panel` | `#111827` | `bg-panel` | 우측 패널, 오버레이 카드 (`/90`, `/95` 투명도) |
| `--border` | `#1f2937` | `border-border` | 구분선, 칩 테두리, 인라인 코드 바탕 |
| `--foreground` | `#e5e7eb` | `text-foreground` | 본문 (`/80`, `/75`로 2차 본문) |
| `--muted` | `#9ca3af` | `text-muted` | 보조 텍스트 (`/80`으로 3차) |
| `--accent` | `#818cf8` | `bg-accent` `text-accent` | 주 버튼, 활성 상태, 링크, 포커스 링 |

심사 결과 색은 `src/lib/colors.ts`의 `DECISION_COLORS`만 쓴다 (승인 초록, 거절 빨강, 심사중 회색, 상태 미확인 슬레이트).
오류는 `border-red-400/40 bg-red-400/10 text-red-200` 한 조합만 쓴다.

색·간격·글자 크기는 모두 Tailwind 스케일을 쓴다. 임의 픽셀 값 금지. 예외는 레이아웃 폭(`md:w-[380px] lg:w-[440px]`, `md:w-[420px]`)과 지도 높이(`h-[44dvh]`)뿐이다.

## 2. 타이포·간격

- 글자: `text-sm` 본문, `text-xs` 메타·버튼, `text-[11px]` 보조 메타, `text-[10px]` CPC 칩. 제목 `text-lg md:text-xl`.
- 섹션: `border-b border-border px-4 py-3`. 입력 영역은 `p-3 md:p-4`.
- 간격: `gap-1.5`(칩), `gap-2`(버튼·메타), `mt-3`(블록).
- 모서리: 칩·토글 `rounded-full`, 버튼·입력 `rounded-lg`, 목록 항목 `rounded-md`, 떠 있는 카드 `rounded-xl`.

## 3. 컴포넌트 패턴

| 패턴 | 클래스 |
|---|---|
| 주 버튼 | `rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-background hover:brightness-110 disabled:opacity-60` |
| 보조 버튼 | `rounded-lg border border-border px-3 py-2 text-sm hover:border-accent` (작은 것은 `px-3 py-1.5 text-xs`) |
| 칩/토글 | `rounded-full border border-border px-2.5 py-1 text-xs`, 활성은 `bg-accent text-background`, 꺼진 필터는 `line-through text-muted` |
| 세그먼트 선택 | `inline-flex rounded-full border border-border bg-panel/90 p-0.5` 안에 `aria-pressed` 버튼 |
| 떠 있는 카드 | `rounded-xl border border-border bg-panel/95 p-4 shadow-2xl backdrop-blur` |
| 메타 목록 | `dl.grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]` (`dt` muted, `dd` foreground/80) |
| 인라인 코드 | `rounded bg-white/10 px-1.5 py-0.5 text-[11px]` |

## 4. 화면 상태

### 지도 (`TelosApp`)
- 데이터셋 선택은 지도 좌상단 세그먼트 컨트롤. 기본값 `korea`. 라벨은 **한국 KIPRIS / 미국 USPTO 샘플**로 고정하고, 샘플을 한국 데이터처럼 표기하지 않는다.
- 부제에 건수·색인 날짜(`builtAt`)·출처를 적는다. 한국 데이터셋은 `실시간 조회 가능 / 꺼짐 (API 키 없음)`을 함께 보여준다. 환경변수 이름은 빈 상태의 설정 안내에서만 쓴다.
- 제목 블록은 `bg-background/70 backdrop-blur-sm`, 데이터셋 토글·범례 칩은 `bg-panel/90 backdrop-blur-sm`으로 지도 점 위에서도 읽힌다.
- 지도 맞춤은 오버레이 높이(`MAP_OVERLAY_INSET`, 184px)를 위쪽에서 비워 점이 헤더·칩 아래에 깔리지 않게 한다. 오버레이 항목을 늘리면 이 값도 함께 고친다. 선택 시 카메라는 오버레이 아래 영역의 가운데로 이동한다.
- 상태 미확인(`UNKNOWN`)은 네 번째 범례 칩. 건수가 0인 결정은 칩을 숨긴다. 보이는 칩 중 최소 하나는 켜져 있어야 한다.
- 빈 상태: 한국 색인 없음 → `KIPRIS_API_KEY` + `pnpm sync:korea --source kipris --query "반려동물"` 안내와 **미국 USPTO 샘플로 보기** 버튼. 샘플 없음 → `pnpm build:data` 안내. 실패 → 메시지 + 다시 시도.
- 데이터셋 전환은 진행 중 요청·하이라이트·선택·포커스·필터를 모두 초기화하고 `SearchPanel`을 `key={dataset}`으로 다시 마운트한다 (입력한 아이디어 텍스트는 상위에서 보존).

### 검색 패널 (`SearchPanel`)
- 두 동작은 그대로: **AI 분석**(SSE) / **유사 특허만 찾기**(임베딩). 결과는 지도 하이라이트 + 목록 클릭 → 상세.
- 결과 순서: 상태·도구 기록 → 오류 → **유사 특허 목록** → AI 답변 → 참고 자료. 스트리밍 답변이 특허 목록을 밀어내지 않게 목록을 위에 둔다.
- 점수는 `검색 점수 0.83` 형식, `text-muted`(accent는 링크·동작 전용). 퍼센트 금지 (한국 데이터셋 점수는 두 순위 목록을 0~1로 정규화한 값).
- 예시 칩은 입력 후에도 유지해 버튼 위치가 바뀌지 않게 한다 (더블클릭으로 AI 분석이 실행되는 것을 막는다).
- AI 답변은 표시 전 `readableKorean()`으로 닫는 따옴표+조사 강조 파싱과 `할 수 있다/없다` 줄바꿈만 보정한다. 내용은 바꾸지 않는다.
- 새 실행·중지·언마운트·데이터셋 전환 시 `AbortController`로 이전 요청을 끊고, 끊긴 요청의 결과는 버린다.
- SSE가 `done`/`error` 없이 닫히면 성공이 아니라 오류("응답이 끝나기 전에 연결이 끊겼습니다")로 표시한다.
- **법령·공시 참고 자료도 찾기** 체크박스는 기본 꺼짐. 켜면 기준일(선택) 입력이 나타나고, 실행 시 `/api/research/search`를 보조 요청으로 보낸다. 에이전트의 `references` 이벤트도 같은 목록에 합친다.
- 보조 요청 실패는 참고 자료 섹션 안에서만 표시하고 특허 결과·답변·실행 상태는 건드리지 않는다.
- 상태 줄은 `aria-live="polite"`, 오류 상자는 `role="alert"`. 이모지는 쓰지 않는다.

### 참고 자료 (`ResearchReferences`)
- 헤더에 "보조 근거 · 특허 결과와 별개"를 항상 표시한다.
- 출처 상태 칩: `법령 · API 키 설정됨 · 색인 N건`, `공시 · API 키 없음 · 색인 0건`. 환경변수 이름(`LAW_OC`, `DART_API_KEY`)은 빈 상태 안내에만 쓴다.
- 상세 본문은 높이 제한 없이 펼친다. 스크롤은 패널 하나만 소유한다.
- 항목: 출처 배지, 일자, 버전, 수집일, 검색 점수, 제목, 발췌(3줄), **원문 열기**(새 탭), **상세 보기**(`/api/research/document/:id`로 법령 시행일·조문·상태 / 공시 회사·보고서·접수번호·정정 여부 + 본문).
- 빈 상태: 색인이 비어 있는 출처별 설정 안내. 항상 "참고 자료가 없다고 해서 적용되는 법령이나 경쟁사가 없다는 뜻은 아닙니다" 문구를 붙인다.
- 상태 값으로 거절 사유를 추정하는 문구를 쓰지 않는다.

### 특허 상세 (`PatentDetail`)
- 데스크톱: 지도 좌하단 떠 있는 카드(`md:absolute md:w-[420px]`). 폰: 화면 하단 시트(`fixed inset-x-2 bottom-2 max-h-[60dvh]`).
- 배지·제목·CPC·출원일·요약은 `/api/patent/:id` 응답(`full`)을 우선하고 지도 점 메타는 폴백이다. 갱신 뒤에도 같은 규칙.
- 한국 특허는 내부 ID 대신 `출원번호 N`을 표시한다. 닫기는 44px 영역 + `Esc`.
- `원문 상태`(rawStatus)·출원인·공개번호는 있을 때만 메타 목록으로. 청구항은 `청구항 N건 보기` 토글. 청구항 원문의 번호를 그대로 쓰고 별도 번호를 붙이지 않는다. 요약·청구항에 따로 스크롤을 두지 않고 카드(시트)가 스크롤을 소유한다.
- 하단 줄: **원문 보기** 링크(`sourceUrl`, 없으면 "원문 링크 없음"), 수집일, 한국 데이터셋에서만 **KIPRIS 최신 정보 가져오기**(`?refresh=1`). 로딩("KIPRIS 조회 중…"), 실패("갱신 실패: 서버 메시지"), 성공("HH:MM 갱신됨")을 `aria-live`로 알린다.

## 5. 반응형·접근성

- `main`: 폰은 세로이며 페이지 전체가 하나의 스크롤(지도 `h-[44dvh]` → 입력 → 결과), `md` 이상은 가로(지도 `flex-1`, 패널 `380px`, `lg` `440px`, 결과 영역만 스크롤).
- 가로 넘침 금지: `html, body { overflow-x: clip }` (`hidden`은 폰에서 html·body 두 세로 스크롤러를 만든다). 폰의 두 주 동작 버튼은 `min-h-11`(44px), 긴 제목·URL·ID는 `break-words`/`break-all`, flex 자식은 `min-w-0`.
- 키보드 포커스: 전역 `:focus-visible` 링(`outline: 2px solid var(--accent)`). 텍스트 입력은 기존 `focus:border-accent`.
- 모든 컨트롤에 보이는 라벨 또는 `aria-label`. 토글은 `aria-pressed`, 펼침은 `aria-expanded`.
- `prefers-reduced-motion`에서는 펄스 애니메이션과 지도 카메라 이동 애니메이션을 끈다.
- 한국어는 `word-break: keep-all`로 어절 단위 줄바꿈, `text-wrap: pretty`로 마지막 줄 한 단어 방지. 고정 문구의 `~할 수 있습니다`, `~가 필요합니다`는 `&nbsp;`로 묶는다.

### 허용한 디자인 부채 (QA 2026-10-16)
- 본문·메타 글자는 기존 디자인의 `text-xs`/`text-[11px]` 스케일을 유지한다 (폰 권장 17pt보다 작다).
- 폰에서 범례 칩·보조 버튼·텍스트 링크의 터치 영역은 44pt 미만이다. 칩을 키우면 44dvh 지도 영역을 오버레이가 대부분 가리므로, AGENTS.md §7.8(데스크톱 우선)에 따라 모바일 재설계 때 함께 다룬다.

## 6. 문구 규칙

- 한국어 UI, 특허 제목은 원문 유지.
- 이모지·장식 기호 금지. 단축키 표기(`⌘↵`)는 허용.
- 퍼센트 유사도 금지, "검색 점수"로 통일.
- 없음을 단정하지 않는다: "참고 자료 없음"은 "관련 법령/경쟁사 없음"이 아니다.
- 환경변수는 이름만 안내하고 값은 보여주지 않는다.
