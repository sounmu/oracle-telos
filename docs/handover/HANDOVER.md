# 인수인계 프롬프트 (Telos)

아래 블록을 새 세션에 그대로 붙여 넣으면 이어서 작업할 수 있습니다.

---

너는 Telos 프로젝트(특허 기반 사업 아이디어 탐색기, 2026 해커톤)를 이어받았다. 먼저 아래 파일을 읽고 시작해라.

- `AGENTS.md`: 저장소 규칙과 구조 (반드시 먼저)
- `docs/design/master-db-layout.md`: 원천 → 마스터 DB 구성
- `docs/design/phase-features.md`: 사업 단계별 기능과 세션 구조
- `docs/design/problem-feature-mapping.md`: 문제 체계
- `docs/design/decision-archive.md`: 지금까지의 결정 (D16~)

## 현재 상태

- 저장소: `sounmu/oracle-telos`, 작업 브랜치 `feat/telos-phases-sessions` (origin에 푸시됨)
- PR #4: `main` 대상, 열려 있음 (https://github.com/sounmu/oracle-telos/pull/4). 머지 전 확인할 것은 PR 본문 참고.
- 커밋 기준 타입 검사와 테스트 62개 통과. 실패하는 테스트 4개(`korea-live`)는 main에서도 같은 결과다.
- 로컬 작업 트리는 커밋 시점과 같고, 이후에 추가한 `docs/design/decision-archive.md`와 `docs/handover/HANDOVER.md`는 커밋되지 않았다.

## 실행

```bash
pnpm install
pnpm build:data              # 샘플 마스터 재생성 (HuggingFace 다운로드, 최초 1회 수 분)
pnpm embed:cases             # 분쟁 사례 벡터 (data/master/cases)
TELOS_MOCK_API=1 pnpm dev -p 3000   # 외부 API 없이 화면만 확인
pnpm test && pnpm typecheck && pnpm exec eslint src
```

- 실제 KIPRIS·OpenAI 호출은 `.env`의 키가 필요하다. `.env`는 Git에 올리지 않는다.
- 목업 모드는 실제 API 한도를 쓰지 않는다. 화면 작업은 목업 모드로 한다.

## 지금 구조

- 원천: 샘플 특허(HUPD 2016.01), 한국 특허(KIPRIS 색인, 비공개), 분쟁 사례(`src/lib/cases.ts` 31건)
- 마스터 DB: `data/master/sample`(manifest, embedding, vectors), `data/master/cases`(manifest, vectors)
- 원천 캐시: `data/raw/` (Git 제외)
- 화면: 홈 = 지도. 왼쪽 세션 목록, 지도 위 "오늘의 랜덤 특허 뽑기", 아래 입력창과 기능 막대. 기능을 고르거나 문장을 보내면 세션이 열린다. 세션은 상태·분야·정렬·개수를 정하는 조회 조건이다.
- 사업 단계 3개: 탐색(지형 보기, 아이디어 위치, 빈 자리), 검증(요소 비교), 리스크(연결 사례, 주변 밀집도)

## 아직 안 한 것 (우선순위 순)

1. **PR #4 머지 준비**: `ui/integrate-design`(PR #3)과 `TelosApp.tsx`, `PatentMap.tsx`, `src/lib/cases.ts`가 겹친다. 어느 쪽을 먼저 머지할지 정하고 충돌을 해결한다.
2. **판결 출처 검증**: 드라이브 `01_기술탈취_사례` 원본에 있는 판결을 원문으로 확인한다. 검증된 1~2건만 시연에 쓰고, 나머지 더미는 숨긴다. 현재 `cases.ts`에는 검증되지 않은 출처가 섞여 있다.
3. **경쟁 서비스 조사와 차별점 정리**: 실제 서비스가 있는 제품만 대상으로 한다 (그림 메모 기준).
4. **발표 자료, 시연 계획, PC 화면 다듬기**: 모바일과 시니어 버전은 선택 사항이다.
5. **위험도 격자·관계선 저장**: 현재 화면에서 계산한다. 좌표 기준(데이터 좌표와 반경)을 정한 뒤 `data/master/sample/risk.json`, `edges.json`으로 저장한다.
6. **한국 데이터 위치 계산**: 샘플만 지원한다. 한국 색인에서 특허별 벡터를 모으는 방식을 정한다.
7. **분쟁 사례 JSON화**: `src/lib/cases.ts`를 `data/raw/cases/cases.json`으로 옮기고 로더를 만든다.

## 실험 (보류)

- 위험도 계산식 실험은 판단 보류다. 사례와 연결되는 특허가 샘플에 거의 없다 (전체 HUPD 26,808건 중 4건, 그중 3건은 무관).
- 실험 매뉴얼: `docs/research/experiment-manual.md`
- KIPRIS의 우선권·패밀리 호출 이름과 파라미터는 아직 확인하지 못했다. 계정주가 KIPRIS Plus 상세 문서에서 요청 URL과 변수명을 확인해야 한다. 추정으로 호출하면 한도만 줄어든다.

## 주의할 점

- 노션 페이지(결정 필요한 것들 등)는 연결 앱에 공유되지 않으면 열리지 않는다. 노션 워크스페이스는 '서연의 Notion'이다.
- 구글 드라이브 폴더(`1nOw67Jr8X32gib9WLeyGI7DI1OS_Bknm`)에 사례 원본이 있다.
- 커밋 작성자는 SeoyeonKoh로 했다. 다음 커밋도 같은 작성자로 하고, 커밋 메시지 끝에는 Co-Authored-By 줄을 남긴다.
- 기능 단위 커밋 중 중간 커밋은 개별 빌드를 확인하지 않았다. 충돌 해결 후 HEAD 기준으로만 검증해도 된다.

## 작업 방식

- 결정이 필요한 것은 한 번에 정리해서 사용자에게 묻는다.
- 화면을 바꾸면 목업 모드에서 브라우저로 확인한다.
- 큰 변경은 새 브랜치와 기능 단위 커밋으로 올린다. `main`에 직접 올리지 않는다.
