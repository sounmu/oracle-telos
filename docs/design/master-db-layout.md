# 마스터 DB 파일 구성 (원천 → 마스터)

확정 범위: **원천 데이터 → 마스터 DB**. 파생 기능은 `problem-feature-mapping.md`에서 정한다.

## 1. 정의

- **원천 데이터**: 있는 그대로의 자료. 빌드할 때만 읽는다. 데이터끼리는 합치지 않는다.
  - 샘플 특허 (HUPD 2016.01)
  - 한국 특허 (KIPRIS 색인, 비공개)
  - 분쟁 사례 (정적 카드)
- **마스터 DB**: 원천을 임베딩해 만든 지도. 세 종류로 나누어 저장한다.
  1. **임베딩·좌표**: 점 목록, 벡터, 2D 좌표
  2. **위험도 격자**: 셀마다의 밀집도와 사례 도달도 값
  3. **관계선**: 점 사이의 연결 쌍과 연결 이유

원칙: **데이터셋마다 따로 저장한다.** 샘플 결과와 한국 결과를 한 파일에 합치지 않는다. 같은 종류끼리 나란히 둔다.

## 2. 목표 디렉터리

```
data/
  raw/                          원천 (빌드 입력만)
    hupd/                       샘플 특허 레코드 (현재 .cache/hupd-compact.jsonl)
    kipris/                     한국 특허 레코드, 검색 캐시 (현재 data/korea/)
    cases/cases.json            분쟁 사례 원본 (현재 src/lib/cases.ts)
  master/
    sample/                     샘플 데이터셋의 마스터
      manifest.json             모델, 차원, 건수, 원천 시점, 빌드 시각
      embedding.json            점 목록: id, 제목, 초록, 상태, CPC, 출원일, 좌표
      vectors.f32               벡터 N×384
      risk.json                 위험도 격자: 셀 좌표와 밀집도, 사례 도달도
      edges.json                관계선: 점 쌍, 연결 이유(CPC 등)
    kipris/                     한국 데이터셋의 마스터 (같은 네 파일)
    cases/                      분쟁 사례의 벡터와 지도 위 위치
      manifest.json
      vectors.f32
      placement.json            사례별 연결 점 목록과 기준점
public/data/
  sample/embedding.json         클라이언트용 축약본 (초록 300자, 빌드 산출물)
scripts/build/
  build-master.ts               원천 → 마스터 (데이터셋 인자로 실행)
  ingest-hupd.ts                HUPD → raw/hupd
  ingest-kipris.ts              KIPRIS → raw/kipris
  embed.ts                      임베딩 입력 텍스트 규칙 (한 곳)
  layout.ts                     좌표 계산 (UMAP, 신규 점 규칙)
  risk.ts                       위험도 격자 계산 (계산식은 실험 결과로 확정)
  edges.ts                      관계선 계산 (규칙은 실험 결과로 확정)
experiments/                    실험 결과 (마스터와 분리, 사용한 manifest 기록)
```

## 3. 현재 파일 → 목표 위치

| 현재 | 목표 | 비고 |
|---|---|---|
| `.cache/hupd-compact.jsonl` | `raw/hupd/` | 캐시를 원천으로 승격 |
| `data/korea/index.json` | `raw/kipris/` + `master/kipris/` | 레코드와 지도를 분리 |
| `src/lib/cases.ts` | `raw/cases/cases.json` | 코드는 타입과 로더만 |
| `public/data/patents.json` | `public/data/sample/embedding.json` | 빌드 산출물로 생성 |
| `data/patents.full.json` | `master/sample/embedding.json` | 전체 필드 |
| `data/embeddings.f32` | `master/sample/vectors.f32` | |
| `data/meta.json` | `master/sample/manifest.json` | 버전 정보 확장 |
| `data/cases.f32`, `cases.meta.json` | `master/cases/vectors.f32`, `manifest.json` | |
| `risk` 계산 (브라우저) | `master/{데이터셋}/risk.json` | 지금은 화면에서 계산 |
| `relations` 계산 (브라우저) | `master/{데이터셋}/edges.json` | 지금은 화면에서 계산 |
| `scripts/build-data.ts` | `scripts/build/build-master.ts` 등으로 분리 | |
| `scripts/sync-korea.ts` | `scripts/build/ingest-kipris.ts` | |
| `scripts/embed-cases.ts` | `scripts/build/embed.ts` 호출 | |
| `scripts/experiments/`, `docs/research/` | `experiments/` 또는 그대로 | 마스터와 분리 |

## 4. 규칙

1. 기능 코드는 `master/`와 `public/`만 읽는다. `raw/`는 빌드에서만 읽는다.
2. 데이터셋마다 빌드를 따로 돌린다. 결과 파일도 따로 둔다.
3. 임베딩 입력 텍스트(제목 + 초록) 규칙은 `embed.ts` 한 곳에서만 정한다.
4. 위험도 격자와 관계선은 마스터에 저장한다. 계산식이나 규칙이 바뀌면 `manifest.json`에 규칙 버전을 적고 다시 빌드한다.

## 5. 열린 질문

- 사례 벡터(`master/cases/`)를 지도 위 좌표와 어떻게 맞출지. 지금은 키워드로 점을 찾는 방식이 쓰이고, 벡터는 아직 쓰이지 않는다.
- 위험도 계산식과 관계선 규칙은 실험 결과가 나와야 확정할 수 있다. 확정 전에는 현재 값을 버전 1로 기록한다.
