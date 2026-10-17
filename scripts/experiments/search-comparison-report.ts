import type { SearchExperimentMethod, SearchExperimentReport } from "../../src/lib/types";

const labels: Record<SearchExperimentMethod, string> = {
  embedding: "임베딩 단독", keyword: "기존 부분 문자열", bm25: "BM25 단독", hybrid: "임베딩 + BM25", elements: "하이브리드 + 기술 요소 비교",
};
const cell = (value: string) => value.replace(/\|/g, "／").replace(/[\r\n]+/g, " ");

export function renderSearchComparison(report: SearchExperimentReport): string {
  const lines = [
    "# 다섯 가지 검색 방식 비교", "",
    `실행: ${report.createdAt} · 완료 질의: ${report.results.length}/${report.queryCount} · 고정 특허: ${report.corpusSize}건 · 재정렬 후보: 상위 ${report.top}건`,
    `색인 SHA-256: ${report.indexSha256}`, "",
    `임베딩: ${report.embeddingModel} · 기술 비교: ${report.agentModel}`, "",
    "**탐색 실험입니다. 독립 정답이 없는 질의는 정확도·상관계수·성능 개선을 판정하지 않습니다.**",
    `토크나이저: ${report.lexical.tokenizer} · BM25 k1=${report.lexical.k1}, b=${report.lexical.b}`,
    "KIPRIS 추가 수집 없이 같은 색인·청크·검색어로 비교했습니다. 기존 부분 문자열은 대조군이며, 최종 서비스는 한국어 단어·한글 2/3글자 토큰 기반 BM25와 임베딩을 RRF로 결합합니다. 형태소 분석기는 아닙니다.",
    "기술 비교는 원문 인용이 확인된 공통 요소 수 / 전체 질의 요소 수로 재정렬합니다. 확인된 요소가 2개 미만이거나 실패한 후보는 원래 자리를 유지합니다.",
    "처리 시간은 단일 순차 실행의 관찰값입니다. BM25 단독 실행에서 생성한 토큰 캐시를 하이브리드가 재사용합니다. 공통 준비(검색 계획·질의 임베딩)는 별도이며, 마지막 방식에는 하이브리드 검색 시간이 포함됩니다. API 토큰 비용은 계측하지 않았습니다.",
    "점수는 방식마다 척도가 다릅니다. 법적 위험·등록 가능성·침해 확률을 의미하지 않습니다.", "",
  ];
  for (const result of report.results) {
    lines.push(`## ${cell(result.query.id)}: ${cell(result.query.idea)}`, "",
      `공통 준비: ${result.setupMs.toFixed(0)}ms · 검색어: ${result.plan.queries.map(cell).join(" / ")}`,
      `기술 요소: ${result.plan.elements.map(cell).join(" / ")}`, "",
      "| 방식 | 상위 3건 (출원번호) | 처리 시간(ms) | nDCG@3 | Precision@3 |",
      "|---|---|---:|---:|---:|");
    for (const method of result.methods) {
      lines.push(`| ${labels[method.method]} | ${method.ranking.slice(0, 3).map((hit) => cell(hit.id)).join(" → ") || "결과 없음"} | ${method.elapsedMs.toFixed(0)} | ${method.metrics?.ndcgAt3.toFixed(3) ?? "미평가"} | ${method.metrics?.precisionAt3.toFixed(3) ?? "미평가"} |`);
    }
    const hybrid = result.methods.find((method) => method.method === "hybrid")?.ranking ?? [];
    const elements = result.methods.find((method) => method.method === "elements")?.ranking ?? [];
    const changed = elements.filter((hit, position) => hybrid[position]?.id !== hit.id).length;
    lines.push("", `재정렬로 위치가 바뀐 후보: ${changed}/${hybrid.length}건. 순위 변화 자체는 정확도 향상의 증거가 아닙니다.`, "",
      "| 특허 | 비교 전 → 후 순위 | 공통/전체 | 확인/전체 | 검토 청구항 |",
      "|---|---:|---:|---:|---:|");
    for (const comparison of result.comparisons) {
      const hit = hybrid.find((item) => item.id === comparison.patentId);
      const common = comparison.rows.filter((row) => row.relation === "common").length;
      const confirmed = comparison.rows.filter((row) => row.relation !== "unconfirmed").length;
      lines.push(`| ${cell(hit?.title ?? comparison.patentId)} (${comparison.patentId}) | ${hybrid.findIndex((item) => item.id === comparison.patentId) + 1} → ${elements.findIndex((item) => item.id === comparison.patentId) + 1} | ${common}/${comparison.rows.length} | ${confirmed}/${comparison.rows.length} | ${comparison.claimsReviewed}/${comparison.claimsTotal} |`);
    }
    if (result.query.judgments) lines.push("", `정답 출처: ${cell(result.query.judgments.source)}. 상위 결과에 미판정 문서가 있거나 관련 정답이 없으면 미평가입니다. Precision의 관련 기준은 라벨 > 0입니다.`);
    for (const error of result.errors) lines.push("", `실패: ${cell(error)}`);
    lines.push("", "### 기술 요소와 원문 근거", "");
    for (const comparison of result.comparisons) {
      lines.push(`**${comparison.patentId}**`, "");
      for (const row of comparison.rows) lines.push(`- ${cell(row.element)}: ${row.relation} — ${cell(row.evidence ?? "원문 근거 미확인")}`);
      lines.push("");
    }
  }
  return lines.join("\n") + "\n";
}
