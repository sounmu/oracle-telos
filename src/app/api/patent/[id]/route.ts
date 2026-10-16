import { getPatentIndex, MISSING_DATA_MESSAGE } from "@/lib/patents";
import { patentFromDocument, readResearchIndex } from "@/lib/korea/index";
import { getKiprisPatent } from "@/lib/korea/kipris";
import { requireKey, SourceError } from "@/lib/korea/http";

/** GET /api/patent/:id → PatentFull */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (id.startsWith("kipris:")) {
    try {
      const index = await readResearchIndex();
      const document = index?.documents.find((document) => document.id === id);
      if (!index || !document || document.source !== "kipris") {
        return Response.json({ error: "한국 특허를 찾을 수 없습니다." }, { status: 404 });
      }
      if (new URL(request.url).searchParams.get("refresh") === "1") {
        const fresh = await getKiprisPatent(document.patent.applicationNumber, requireKey("KIPRIS_API_KEY"), request.signal);
        return Response.json(patentFromDocument(fresh, index));
      }
      return Response.json(patentFromDocument(document, index));
    } catch (error) {
      return Response.json({
        error: error instanceof SourceError ? error.message : "한국 특허 상세를 읽지 못했습니다.",
      }, { status: 502 });
    }
  }
  const index = await getPatentIndex();
  if (!index) return Response.json({ error: MISSING_DATA_MESSAGE }, { status: 503 });
  const patent = index.byId.get(id);
  if (!patent) return Response.json({ error: "특허를 찾을 수 없습니다." }, { status: 404 });
  return Response.json(patent);
}
