import { z } from "zod";
import type { ResearchDocument, ResearchIndex } from "../types";

const decision = z.enum(["ACCEPTED", "REJECTED", "PENDING", "UNKNOWN"]);
const base = {
  id: z.string().min(1),
  sourceId: z.string().min(1),
  version: z.string().min(1),
  title: z.string().min(1),
  text: z.string(),
  url: z.url().refine((value) => /^https?:\/\//.test(value)),
  publishedAt: z.string().nullable(),
  fetchedAt: z.iso.datetime(),
};

export const researchDocumentSchema: z.ZodType<ResearchDocument> = z.discriminatedUnion("source", [
  z.object({
    ...base,
    source: z.literal("kipris"),
    patent: z.object({
      applicationNumber: z.string().min(1),
      publicationNumber: z.string(),
      filingDate: z.string(),
      cpc: z.array(z.string()),
      applicants: z.array(z.string()),
      decision,
      rawStatus: z.string(),
      abstract: z.string(),
      claims: z.array(z.string()),
    }),
  }),
  z.object({
    ...base,
    source: z.literal("law"),
    law: z.object({
      lawId: z.string().min(1),
      mst: z.string().min(1),
      articleNumber: z.string(),
      versionEffectiveFrom: z.iso.date(),
      effectiveFrom: z.iso.date(),
      effectiveTo: z.iso.date().nullable(),
      promulgatedAt: z.string(),
      state: z.enum(["current", "scheduled", "historical"]),
    }),
  }),
  z.object({
    ...base,
    source: z.literal("dart"),
    disclosure: z.object({
      corpCode: z.string().regex(/^\d{8}$/),
      corpName: z.string(),
      receiptNo: z.string().regex(/^\d{14}$/),
      reportName: z.string(),
      reportDate: z.iso.date(),
      section: z.string(),
      correction: z.boolean(),
    }),
  }),
]);

export const researchIndexSchema: z.ZodType<ResearchIndex> = z.object({
  schemaVersion: z.literal(1),
  model: z.string().min(1),
  dim: z.number().int().positive(),
  builtAt: z.iso.datetime(),
  documents: z.array(researchDocumentSchema),
  chunks: z.array(z.object({
    id: z.string(),
    documentId: z.string(),
    text: z.string(),
    hash: z.string(),
    vector: z.array(z.number().finite()),
  })),
  points: z.array(z.object({
    id: z.string(),
    title: z.string(),
    decision,
    cpc: z.string(),
    filed: z.string(),
    x: z.number().finite(),
    y: z.number().finite(),
    abstract: z.string(),
  })),
}).superRefine((index, context) => {
  const ids = new Set(index.documents.map((document) => document.id));
  if (ids.size !== index.documents.length) {
    context.addIssue({ code: "custom", message: "중복 문서 ID" });
  }
  for (const chunk of index.chunks) {
    if (!ids.has(chunk.documentId) || chunk.vector.length !== index.dim) {
      context.addIssue({ code: "custom", message: `색인 불일치: ${chunk.id}` });
    }
  }
});
