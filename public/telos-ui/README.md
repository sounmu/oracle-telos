# Telos UI 프로토타입 (public/telos-ui)

기존 Next.js 앱과 별개로 돌아가는 정적 HTML·CSS·JS 화면이다. 기존 API를 그대로 호출하고, 기존 컴포넌트와 데이터 파일은 건드리지 않는다.

## 실행

- 개발 서버: `pnpm dev` 후 `http://localhost:3000/telos-ui/` 접속. 같은 출처라 `/api/*`를 바로 호출한다.
- 예시 데이터: `http://localhost:3000/telos-ui/?mock=1`, 또는 `index.html`을 파일로 직접 열기(file://). `telos.mock.js`의 목업 응답을 쓴다.
- 바로 시연: 주소 끝에 `#demo`를 붙이면 예시 문장으로 검색을 시작한다. 예: `/telos-ui/?mock=1#demo`. `#demo-cases`는 분쟁 사례 탭, `#demo-compare`는 첫 특허 비교 화면까지 연다.
- 모바일: 폭 560px 이하에서 한 줄 칩은 가로로 넘기고, 결과 행·비교 머리말은 세로로 쌓는다. 손가락 입력에서는 버튼·칩 높이를 44px 이상으로, 지도 점 선택 범위를 22px로 넓힌다. 아이폰 홈 바 영역(safe area)만큼 하단 버튼을 띄운다.
- 다른 서버 주소: `?api=http://localhost:3000` (그 서버에 CORS 허용 필요)

## 화면

1. 찾기: 입력 방식 5가지(기술 설명, 질문, 특허번호·회사명, 카테고리, 자료 올리기). 5자 이상 입력, `Ctrl/⌘+Enter`로 실행
2. 결과
	- 근접도 온도: 비교를 마친 특허 중 가장 가까운 특허 기준. 근거·공통 요소·단계별 건수를 '왜 이 온도인가요?'에 펼침
	- 검색 요약: `elements`(기술 요소), `coverage.queries`(검색어 묶음), 후보 수, `warnings`
	- 찾은 특허: 상위 3건 자동 비교, 나머지는 '근접도 보기'. 근접도 단계로 필터
	- 분쟁 사례: 내 기술·기술 요소·특허 제목과 키워드가 겹치는 사례
	- AI 해설: `/api/agent` SSE를 받아 그대로 표시
	- 기술 지도: canvas. 색 기준을 근접도·특허 상태·CPC로 바꿈. 점을 누르면 비교 화면
3. 비교: 기술 요소별 공통·차이·확인 필요, 원문 인용, 청구항 목록, KIPRIS 최신 정보(`?refresh=1`), 관련 분쟁 사례, 상담용 요약 복사

## 사용하는 API

| 화면 동작 | 요청 | 응답 타입 (`src/lib/types.ts`) |
|---|---|---|
| 처음 열 때 | `GET /api/patents?dataset=korea` | `PatentMapResponse` |
| 찾기 | `POST /api/search` `{ query, k: 12, dataset: "korea" }` | `SearchResponse` |
| 근접도·비교 | `POST /api/compare` `{ idea, id }` | `PatentComparison` |
| 특허 상세 | `GET /api/patent/:id`, 갱신은 `?refresh=1` | `PatentFull` |
| AI 해설 | `POST /api/agent` `{ idea, dataset, includeContext: false }` | SSE `AgentEvent` |

- 오류는 응답의 `{ error }` 문구를 그대로 보여준다. `503`은 "서버 설정이 필요해요"로 구분한다.
- 새 검색·중지·화면 전환 때 `AbortController`로 이전 요청을 끊는다.

## 근접도 온도 숫자

- 단계(`hot`·`warm`·`cool`·`insufficient`)는 백엔드 `src/lib/proximity.ts` 값을 그대로 쓴다.
- 온도 숫자는 화면용이다. 원문 근거가 확인된 행 중 `common` 비율을 32~40°로 옮긴다(`32 + 비율 × 8`). 단계 경계 1/3, 2/3은 34.7°, 37.3°에 해당한다. `insufficient`는 `--°`로 표시한다.
- 화면 문구는 "법적 위험도가 아니다"를 함께 보여준다.

## 아직 백엔드에 없는 것

- 분쟁 사례: 지금은 `telos.cases.js`(조사 자료에서 뽑은 사례)를 키워드로 고른다. `GET /api/cases?q=` 같은 API가 생기면 `telos.js`의 `api.cases()`만 바꾸면 된다. 사례 객체 형태는 `telos.cases.js` 맨 위 설명 참고.
- 자료 올리기: `.txt`는 입력창에 넣고, PDF·PPTX·DOCX는 기술 요소 추출 API가 생기면 연결한다.
- 보관함: 지금은 브라우저 `localStorage`에만 저장한다.

## 파일

- `index.html`: 화면 뼈대
- `telos.css`: 색·간격 토큰(맨 위 `:root`)과 컴포넌트 스타일
- `telos.js`: API 호출, 상태, 화면 그리기
- `telos.mock.js`: 목업 응답 (특허 제목·출원인·번호는 모두 예시값)
- `telos.cases.js`: 분쟁 사례 데이터

`telos*.js`는 빌드를 거치지 않는 브라우저용 스크립트라 맨 위에 `/* eslint-disable */`를 두었다.

## 기존 디자인과 다른 점

- 기존 `DESIGN.md`는 다크 테마만 정했지만 이 프로토타입은 밝은 테마다. 어느 쪽으로 갈지 팀에서 정한다.
- 서체는 Pretendard(CDN)를 쓴다.
