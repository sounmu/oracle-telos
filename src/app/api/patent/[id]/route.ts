import { getPatentIndex, MISSING_DATA_MESSAGE } from "@/lib/patents";

/** GET /api/patent/:id → PatentFull */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const index = await getPatentIndex();
  if (!index) return Response.json({ error: MISSING_DATA_MESSAGE }, { status: 503 });
  const patent = index.byId.get(id);
  if (!patent) return Response.json({ error: "특허를 찾을 수 없습니다." }, { status: 404 });
  return Response.json(patent);
}
