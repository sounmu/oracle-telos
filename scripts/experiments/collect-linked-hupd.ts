/**
 * HUPD 전체 샘플(약 2.7만 건)을 스트리밍하며, 분쟁 사례 키워드와 2개 이상 겹치는 특허만 남긴다.
 * 외부 API 호출 없음 (HuggingFace 공개 데이터셋 한 번 다운로드).
 *
 *   pnpm exec tsx scripts/experiments/collect-linked-hupd.ts
 *
 * 출력: .cache/experiments/hupd-linked.jsonl
 */
import fs from "node:fs";
import path from "node:path";
import { Parser, type ReadEntry } from "tar";
import { DISPUTE_CASES } from "../../src/lib/cases";

const SOURCE_URL = "https://huggingface.co/datasets/HUPD/hupd/resolve/main/data/sample-jan-2016.tar.gz";
const ROOT = process.cwd();
const OUT = path.join(ROOT, ".cache", "experiments", "hupd-linked.jsonl");

function matcher(keyword: string): (text: string) => boolean {
  if (/^[ -~]+$/.test(keyword)) {
    const re = new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`);
    return (text) => re.test(text);
  }
  return (text) => text.includes(keyword);
}

const tests = DISPUTE_CASES.map((item) => {
  const keys = [...new Set(item.keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 2))];
  return keys.map(matcher);
});

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const out = fs.createWriteStream(OUT);
  const res = await fetch(SOURCE_URL);
  if (!res.ok || !res.body) throw new Error(`다운로드 실패: HTTP ${res.status}`);
  let scanned = 0;
  let kept = 0;
  const parser = new Parser({
    onReadEntry: (entry: ReadEntry) => {
      if (entry.type !== "File" || !entry.path.endsWith(".json")) { entry.resume(); return; }
      const chunks: Buffer[] = [];
      entry.on("data", (c: Buffer) => chunks.push(c));
      entry.on("end", () => {
        scanned++;
        try {
          const r = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const title = String(r.title ?? "").replace(/\s+/g, " ").trim();
          const abstract = String(r.abstract ?? "").replace(/\s+/g, " ").trim();
          const text = `${title} ${abstract}`.toLowerCase();
          // 사례 중 하나라도 키워드 2개 이상이 겹치면 남긴다
          const matched = tests.some((ts) => ts.filter((t) => t(text)).length >= 2);
          if (!matched || !r.decision || !title || abstract.length < 40) return;
          kept++;
          out.write(JSON.stringify({
            id: String(r.application_number),
            title,
            abstract,
            decision: String(r.decision),
            cpc: String(r.main_cpc_label ?? ""),
            cpcLabels: Array.isArray(r.cpc_labels) ? r.cpc_labels : [],
            filed: String(r.filing_date ?? ""),
            firstClaim: String(r.claims ?? "").replace(/\s+/g, " ").trim().slice(0, 1500),
          }) + "\n");
        } catch {
          // 손상된 레코드는 건너뜀
        }
      });
    },
  });
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) parser.write(Buffer.from(chunk));
  parser.end();
  await new Promise<void>((resolve) => out.end(resolve));
  console.log(`전체 ${scanned.toLocaleString()}건 중 사례 키워드와 연결된 ${kept}건 저장: ${path.relative(ROOT, OUT)}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
