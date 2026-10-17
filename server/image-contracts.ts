import { z } from 'zod';
export const imageEvidence = z.object({
  sourceUrl: z.url().max(2000).refine(value => { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }, 'Use a public HTTPS evidence URL without embedded credentials.'),
  rightsBasis: z.string().trim().min(10).max(2000),
}).strict();
export type ImageEvidence = z.infer<typeof imageEvidence>;
export type ImageRecord = { id: string; materialId: string; contentHash: string; sourceUrl: string; rightsBasis: string; status: 'pending' | 'approved' | 'rejected'; reviewer: string | null; reviewedAt: string | null };
export const imageDecision = z.object({ status: z.enum(['approved','rejected']), approval: z.string().optional() }).strict().superRefine((value, context) => {
  if (value.status === 'approved' && value.approval !== 'I verified the product image and usage rights') context.addIssue({ code:'custom',message:'Explicit product and rights review is required.' });
});

export const imageLimits = { maxAssociations:500, maxSourceBytes:5*1024*1024,maxStoredBytes:2*1024*1024,maxPixels:16_000_000,maxDimension:1024 };
