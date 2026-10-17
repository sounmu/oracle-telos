# PatenTrace — AI 특허 탐색기

창업 지망생이 기존 특허를 한눈에 보고, 자기 아이디어와 비교해 방향을 잡도록 돕는 해커톤 MVP.

- **특허 지도**: 특허 3,000건을 임베딩 → UMAP 2D 투영. 승인(초록)·거절(빨강)·심사중(회색)을 색으로 구분.
- **아이템 세션**: 사업 아이템을 한국어로 적으면 세션이 열리고 입력·탐색·검증·요약 4단계로 진행한다. 탐색 단계에서 유사 특허를 조회해 지도에서 하이라이트한다.
- **기술 요소별 비교와 기술 근접도**(해커톤 MVP, [docs/hackathon-mvp.md](docs/hackathon-mvp.md)): 한국 특허 상세에서 '기술 요소별 비교'를 누르면 청구항 1 구성 대비와 기술 요소별 비교, 원문 인용·링크를 보여 준다. 근접도는 모두 대응·다른 수단 포함·빠진 구성 있음·자료 부족 중 하나로 표시한다. OPENAI_API_KEY가 필요하다.

한국 데이터에서도 중심은 **특허 지도와 아이디어 비교**다. 법령과 기업공시는 사용자가 선택할 때만 펼쳐보는 참고 자료이며, 특허 결과와 별도 표시한다.

## 실행

```bash
pnpm install
cp .env.example .env        # OPENAI_API_KEY 입력
pnpm build:data             # 최초 1회. 모델(~120MB) + 특허 데이터 다운로드 후 임베딩/UMAP (수 분)
pnpm dev                    # http://localhost:3000
```

API 키가 없어도 지도와 탐색 조회(로컬 임베딩 검색)는 동작한다. 기술 요소별 비교만 키가 필요하다.

한국 특허는 **검색할 때 KIPRIS를 실시간 조회해 로컬 색인에 캐시**한다(아래 "하이브리드 검색"). `KIPRIS_API_KEY`만 있으면 미리 수집하지 않아도 검색 결과로 지도가 채워진다. 키도 색인도 없으면 설정 안내를 표시한다. 화면에서 **미국 샘플**로 전환하면 기존 데모를 사용할 수 있다. 미국 샘플을 한국 특허로 표시하거나 가짜 한국 문서를 기본 데이터로 넣지 않는다.

## 한국 데이터 수집

기존 `.env`를 덮어쓰지 말고 `.env.example`의 필요한 항목을 추가한다.

| 환경변수 | 용도 |
|---|---|
| `KIPRIS_API_KEY` | KIPRIS Plus 특허 검색·서지·청구항·CPC 조회 |
| `LAW_OC` | 국가법령정보 공동활용의 승인받은 API 인증값 |
| `DART_API_KEY` | Open DART 공시 목록·원문 ZIP 조회 |
| `TELOS_RESEARCH_DIR` | 비공개 색인 디렉터리. 기본 `data/raw/kipris` |

```bash
# (선택) 기본 지도 시드. 검색 시 실시간 조회가 나머지 분야를 채운다
pnpm sync:korea --source kipris --query "반려동물" --limit 100 # 출원일 최신순, 기본 100건

# 선택적 참고자료. 법령명/본문을 검색해 현행 법령의 조문을 수집
pnpm sync:korea --source law --query "동물보호법" --limit 200

# 실제 대상 기업의 DART 8자리 고유번호를 사용
pnpm sync:korea --source dart --corp-code <고유번호> --since 2026-01-01 --until 2026-10-16 --limit 30

# 동일 명령 재실행: ID로 병합, 변경된 청크만 재임베딩
# 모델 변경 시 기존 원문 전체 재색인(외부 API 호출 없음)
pnpm sync:korea --reindex

# 출처 삭제·철회 요청을 반영할 때 문서와 파생 색인 제거
pnpm sync:korea --remove <문서ID>
pnpm sync:korea --help
```

`--limit`은 특허·법령 조문·공시 절의 최대 개수이며 API 호출 수가 아니다. KIPRIS는 검색 뒤 특허별 상세·CPC 조회가 추가된다. 법령 본문이나 공시는 제한에 따라 일부 조문·절만 수집될 수 있다. DART의 `--query`는 공시 본문 검색 조건이 아니며, 기업코드와 접수기간으로 수집 범위를 정한다. 기업코드를 생략하면 최근 기간의 제한된 정기공시만 수집한다. 모든 스타트업을 포괄하지 않는다.

### 하이브리드 검색 (실시간 KIPRIS + 로컬 캐시)

한국 특허는 수백만 건이고 KIPRIS Plus는 호출 한도가 있어 전부 미리 넣지 않는다. 대신 검색할 때마다 다음 순서로 동작한다 (`src/lib/korea/search.ts`).

1. 기술 설명을 검색어 묶음으로 나눈다. 빠른 검색은 OpenAI가 기술 요소와 동의어를 반영한 검색어 2~4개를 만들고(키가 없으면 입력 문장 그대로), 에이전트는 아이디어를 기술 요소로 나눠 2~3회 검색한다.
   `KIPRIS_API_KEY`가 있으면 검색어마다 KIPRIS `getAdvancedSearch`에서 후보 최대 20건(제목·초록·출원인 포함, 출원일 최신순)을 받고 출원번호로 중복을 없앤다. 전체 20초 제한.
2. 상세를 받기 전에 후보의 제목·초록을 기술 설명과 의미 유사도로 정렬해, 색인에 **없는** 가까운 후보부터 상세(서지상세 + CPC, 1건당 2회 호출)를 받는다. **질의당 최대 20건(호출 최대 40회)**이다. 시간이 다하면 받은 만큼만 캐시하고 다음 검색에서 나머지를 받는다. 검색 결과(출원번호 목록)는 `data/raw/kipris/queries.json`에 질의별로 7일간 캐시하므로, 같은 질의(띄어쓰기·대소문자 차이 무시)를 7일 안에 다시 실행하면 KIPRIS 호출은 검색·상세 모두 0회다. 7일이 지나면 검색만 다시 하고 새로 나온 특허만 상세를 받는다.
3. 새 문서를 로컬 색인에 병합한다. 새 청크만 임베딩하고, 지도 좌표는 UMAP을 다시 돌리지 않고 **코사인 top-5 기존 점 좌표의 유사도 가중 평균**으로 근사한다. 기존 점이 3개 이하일 때만 전체 배치를 다시 계산한다.
4. 기술 설명(임베딩)과 검색어 묶음(키워드)의 순위(RRF)로 로컬 색인을 재정렬해 돌려준다. 확보한 후보 안의 순위이며 국내 전체 검색이 아니다. 새로 추가된 점은 `points_added` 이벤트(에이전트)·`addedPoints`(빠른 검색)로 지도에 바로 병합된다.

키가 없거나 KIPRIS가 실패·시간 초과하면 로컬 색인만 검색하고 경고를 함께 돌려준다. 색인 파일을 쓸 수 없는 환경(읽기 전용 FS)에서는 프로세스 메모리에만 캐시하고 경고 로그를 남긴다. 근사 좌표가 쌓여 지도가 어색해지면 `pnpm sync:korea --reindex`로 전체를 다시 배치한다. KIPRIS 검색은 키워드 매칭이므로 에이전트는 문장이 아니라 핵심 기술 키워드 2~4개로 검색한다. 빠른 검색은 입력 문장을 그대로 보내므로 짧은 키워드로 입력할수록 실시간 결과가 잘 나온다.

### 관계선 API 명세와 확인 호출 (2026-10-17)

관계선 구현을 위해 계정주가 [KIPRIS Plus 특허·실용 공개·등록공보 공식 명세](https://plus.kipris.or.kr/portal/data/apiClas/DBII_000000000000001/view.do)의 `REST → 서지정보`에서 아래 항목을 확인했다. **명세 확인과 실제 호출 검증을 구분하며, 지도 관계선 연동은 아직 구현하지 않았다.**

공통 요청 경로는 `https://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/{operation}`이다. `Sevice` 철자는 명세 그대로 사용한다. 입력은 `applicationNumber`(출원번호), 인증 변수는 `accessKey`이며 응답은 XML이다. 인증키는 기존 `KIPRIS_API_KEY` 환경변수에서 읽고 문서·로그에 기록하지 않는다. 검색 API의 `ServiceKey`와 혼동하지 않는다.

| 서지정보 항목 | 오퍼레이션 | 출력 그룹 및 필드 | 확인 상태 |
|---|---|---|---|
| 8. 패밀리정보 | `patentFamilyInfo` | `patentFamilyInfo`: `applicationNumber`, `countryCode`, `countryName`, `familyKind`, `familyNumber`, `literatureKind`, `literatureNumber`, `openingNumber` | 계정주 제공 명세 확인, 호출 미검증 |
| 13. 우선권정보 | `patentPriorityInfo` | `items → priorityInfo`: `priorityApplicationCountry`, `priorityApplicationDate`, `priorityApplicationNumber` | 계정주 제공 명세 확인, 호출 미검증 |
| 15. 선행기술조사문헌 | `patentPriorArtDocumentsInfo` | `items → priorArtDocumentsInfo`: `documentsNumber`, `examinerQuotationFlag` | 승인받은 1회 호출 성공 |
| 17. 패밀리출원정보 | `patentFamilyInfoV1` | `items → familyInfoV1`: `familyApplicationNumber` | 계정주 제공 명세 확인, 호출 미검증 |

선행기술조사문헌 API는 2026-10-17(KST), 계정주 승인 후 샘플 출원번호 `1020037015908`로 HTTPS 요청을 **1회** 실행했다. 재시도나 다른 관계 API 호출은 하지 않았다. HTTP `200`, Content-Type `text/xml;charset=utf-8`, `resultCode=00`, `resultMsg=success`를 확인했다.

```text
GET https://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/patentPriorArtDocumentsInfo?applicationNumber=1020037015908&accessKey=<인증키>
```

실제 응답은 다음과 같다(공백·줄바꿈만 정리).

```xml
<response>
  <header>
    <resultCode>00</resultCode>
    <resultMsg>success</resultMsg>
  </header>
  <body>
    <items>
      <priorArtDocumentsInfo>
        <documentsNumber>US03960611 A1</documentsNumber>
        <examinerQuotationFlag>Y</examinerQuotationFlag>
      </priorArtDocumentsInfo>
      <priorArtDocumentsInfo>
        <documentsNumber>US04501615 A1</documentsNumber>
        <examinerQuotationFlag>Y</examinerQuotationFlag>
      </priorArtDocumentsInfo>
    </items>
  </body>
</response>
```

두 결과 모두 심사관 인용 여부가 `Y`인 미국 문헌이다. 이 데이터로 표현할 관계는 **해당 출원 → 인용된 선행문헌**이며, 후속 연구·거절 사유로 단정하지 않는다. 패밀리·우선권 관계도 인용 관계와 별도로 표시해야 한다. `documentsNumber`는 국가코드·문헌번호·문헌종류를 포함하므로 출원번호 기반 지도 ID와 직접 같다고 볼 수 없다. 연동 전 번호 정규화와 문헌번호→출원번호 매칭이 필요하며, 이번 호출만으로 지도 내 연결 대상의 존재나 매칭 성공을 확인한 것은 아니다.

### 저장·검색·갱신

- 한국 원문과 색인은 `data/raw/kipris/index.json`에 함께 저장하며 `.gitignore`로 제외한다. 파일을 원자적으로 교체해 검색 중 부분 쓰기를 읽지 않게 한다.
- 처음에는 기존 앱과 같은 파일 기반 소규모 색인을 사용한다. PostgreSQL/pgvector나 전체 한국 데이터 Bulk 수집은 이 MVP에 포함하지 않는다. 규모가 커지면 저장소를 교체한다.
- 문서 ID·버전·원문 주소·수집일, 법령의 버전 시행일과 조문 시행일, 공시 접수번호·정정 여부를 보존한다.
- 한국 검색은 키워드 순위와 임베딩 순위를 결합한다. 점수는 상대적 검색 순위이며 등록 가능성·침해 확률이 아니다.
- 특허 본문은 청크로 검색하고, 지도는 각 특허의 첫 검색 청크 벡터를 UMAP으로 투영한다. 1~3건은 UMAP 대신 벡터 두 축으로 배치한다. 검색 중 추가된 특허는 이웃 근사 좌표를 쓰며, 재색인하면 지도 위치가 달라질 수 있다.
- 법령은 수집된 버전 중 검색 기준일에 맞는 조문을 선택한다. 새 법령 버전 수집 시 이전 버전의 적용 종료를 연결한다. 수집하지 않은 연혁이나 삭제·폐지 사실까지 자동으로 알 수는 없다.
- 공시는 수집된 정정보고서 중 최신본을 우선하고 과거 기준일에는 이전본을 사용할 수 있다. 숫자 중심 재무표와 첨부는 기본 검색 대상에서 제외한다.
- 일괄 갱신은 명령 재실행 방식이고, 검색 중 실시간 조회는 처음 보는 특허만 추가한다(이미 있는 특허의 상태는 갱신하지 않는다). 완전한 변경·삭제 피드나 자동 스케줄러는 구현하지 않았으며, 출처의 삭제 요청은 `--remove`로 반영한다.
- 한국 특허 상세의 최신 조회는 KIPRIS API를 다시 호출한다. 이 조회 결과는 화면에만 적용되며 색인·지도 갱신은 수집 명령을 다시 실행해야 한다.

KIPRIS의 `공개`는 심사 중으로 단정하지 않고 **상태 미확인**으로 표시한다. 거절결정서 수집은 아직 포함하지 않았으므로 AI는 상태만으로 거절 사유를 추정하지 않는다. 한국 청구항 전체를 보관하되 에이전트에는 처음 최대 5개, 각 1,500자까지만 전달한다.

### API와 배포

- `GET /api/patents?dataset=korea|sample`: 지도·색인 시각·출처별 준비 상태
- `POST /api/search`: `{query, k?, dataset?, decision?}` → `{hits}`. 한국은 `{hits, addedPoints, warnings, coverage, elements}`이며 실시간 조회 결과를 색인에 캐시한다. KIPRIS 실패는 인증·호출 한도·네트워크·시간 초과로 나눠 `warnings`에 담는다
- `POST /api/compare`: `{idea, id: "kipris:<출원번호>"}` → 기술 요소별 비교표와 기술 근접도. 원문에 그대로 있는 인용만 근거로 인정하며, 근접도는 법적 위험도가 아니다
- `POST /api/agent`: `{idea, dataset?, includeContext?, asOf?}` → SSE. 참고자료 기본값은 `false`; `asOf`는 참고자료 기준일
- `GET /api/patent/:id`: 상세. 한국 특허는 `?refresh=1`로 실시간 조회
- `POST /api/research/search`: `{query, sources?: ["law","dart"], k?, asOf?: "YYYY-MM-DD"}`
- `GET /api/research/document/:id`: 출처·버전이 포함된 참고 문서

키는 서버에서만 사용한다. 수집 전에 상품 이용 범위, 저장·임베딩·화면 표시 권한과 계정별 호출 한도를 확인한다. 한국 수집 데이터를 공개 저장소나 `public/data`에 복사하지 않는다.

수집 명령은 쓰기 가능한 Node 환경에서 실행한다. 운영에서는 색인을 비공개 영속 볼륨에 배치하고 `TELOS_RESEARCH_DIR`로 연결한다. 읽기 전용/서버리스 배포에서 이 로컬 수집 명령을 요청 처리 중 실행하지 않는다. 검색 중 실시간 캐시는 이런 환경에서 인스턴스 메모리에만 남는다. 기존 미국 샘플 파일은 그대로 유지한다.

## 검증

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

커넥터 테스트는 **합성 XML/ZIP/JSON 응답**으로 실제 파서를 검증한다. 실제 인증키·상품 권한·IP 등록·실서버 데이터 품질을 검증한 것으로 간주하지 않는다. 키를 설정한 뒤 소량 수집으로 각 계정의 연동을 확인한다.

## 구조

[AGENTS.md](./AGENTS.md) 참고. 에이전트와 사람 모두 이 문서의 규칙을 따른다.

## 데이터

[HUPD (Harvard USPTO Patent Dataset)](https://huggingface.co/datasets/HUPD/hupd) 2016년 1월 출원 샘플. 각 출원의 심사 결과(ACCEPTED / REJECTED / PENDING)가 포함되어 있다.
