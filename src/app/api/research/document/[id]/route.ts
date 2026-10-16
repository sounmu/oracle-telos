import { readResearchIndex } from "@/lib/korea/index";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const index = await readResearchIndex();
    const document = index?.documents.find((document) => document.id === id);
    if (!document) return Response.json({ error: "참고 자료를 찾을 수 없습니다." }, { status: 404 });
    return Response.json(document);
  } catch {
    return Response.json({ error: "참고 자료 색인을 읽지 못했습니다." }, { status: 500 });
  }
}
