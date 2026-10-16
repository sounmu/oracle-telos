# Telos — AI 특허 탐색기

창업 지망생이 기존 특허를 한눈에 보고, 자기 아이디어와 비교해 방향을 잡도록 돕는 해커톤 MVP.

- **특허 지도**: 특허 3,000건을 임베딩 → UMAP 2D 투영. 승인(초록)·거절(빨강)·심사중(회색)을 색으로 구분.
- **AI 특허 검색**: 아이디어를 한국어로 적으면 Claude 에이전트가 유사 특허를 찾아 겹침/차이/거절 사례/방향을 정리. 찾은 특허는 지도에서 하이라이트.

## 실행

```bash
pnpm install
cp .env.example .env        # ANTHROPIC_API_KEY 입력
pnpm build:data             # 최초 1회. 모델(~120MB) + 특허 데이터 다운로드 후 임베딩/UMAP (수 분)
pnpm dev                    # http://localhost:3000
```

API 키가 없어도 지도와 "유사 특허만 찾기"(로컬 임베딩 검색)는 동작한다. AI 분석만 키가 필요하다.

## 구조

[AGENTS.md](./AGENTS.md) 참고. 에이전트와 사람 모두 이 문서의 규칙을 따른다.

## 데이터

[HUPD (Harvard USPTO Patent Dataset)](https://huggingface.co/datasets/HUPD/hupd) 2016년 1월 출원 샘플. 각 출원의 심사 결과(ACCEPTED / REJECTED / PENDING)가 포함되어 있다.
