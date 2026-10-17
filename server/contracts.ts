import { z } from 'zod';

export const unit = z.enum(['EA', 'FT', 'STICK', 'BOX', 'ROLL', 'PAIR']);
const text = z.string().trim().min(1).max(2000);
const date = z.iso.date();
const quantity = z.string().regex(/^(?:\d{1,12}(?:\.\d{1,6})?|\.\d{1,6})$/).refine(value => Number(value) > 0);
export const candidate = z.object({
  id: z.string().max(100), description: text, specs: z.array(z.string().max(500)).max(30),
  productUnit: unit, source: z.enum(['verified_fixture', 'ai_fixture', 'verified']),
  category: z.enum(['conduit', 'screw', 'tape', 'general']),
});
export const line = z.object({
  id: z.uuid(), quantity, requestedUnit: unit, description: text,
  rawInput: z.object({ quantity, description: text, requestedUnit: unit }).strict(),
  candidate: candidate.nullable(), source: z.enum(['verified_fixture', 'ai_fixture', 'user_description', 'verified']),
  deliveryMode: z.enum(['inherit', 'override']), overrideDate: date.nullable(),
}).strict().superRefine((value, context) => {
  if ((value.deliveryMode === 'inherit') !== (value.overrideDate === null)) context.addIssue({ code: 'custom', message: 'Inherited lines cannot have an override; overridden lines require a date.' });
  if ((value.source === 'user_description') !== (value.candidate === null)) context.addIssue({ code: 'custom', message: 'Candidate/source mismatch.' });
  if (value.candidate && value.source !== value.candidate.source) context.addIssue({ code: 'custom', message: 'Candidate/source mismatch.' });
});
export const draftBody = z.object({
  projectId: z.enum(['riverside', 'northside']), deliveryDate: date,
  lines: z.array(line).max(500), version: z.number().int().nonnegative(),
}).strict().refine(value => new Set(value.lines.map(item => item.id)).size === value.lines.length, 'Duplicate line identifiers');
export type DraftBody = z.infer<typeof draftBody>;
export type Principal = { tenant: string; oid: string; roles: string[] };
export const importRow = z.object({
  schema_version: z.literal('1'), external_key: z.string().regex(/^[\w.-]{1,100}$/),
  description: text, aliases_json: z.string().max(10000), requested_uom: unit, product_uom: unit,
  manufacturer: z.string().max(200), manufacturer_part_number: z.string().max(200),
  specifications_json: z.string().max(10000), conversion_basis_json: z.string().max(10000),
  source_url: z.string().max(2000), verification_basis: text,
  dataset_kind: z.enum(['fixture', 'reviewed']),
}).strict();
export const csvColumns = Object.keys(importRow.shape);
export type ImportRow = z.infer<typeof importRow>;
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
