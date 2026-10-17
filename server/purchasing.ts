import { z } from 'zod';
export const purchaseSchema=z.object({productId:z.uuid().nullable(),manufacturer:z.string().trim().max(200),partNumber:z.string().trim().max(200),noSubstitutions:z.boolean()}).strict().refine(v=>Boolean(v.manufacturer)===Boolean(v.partNumber),'Supply both manufacturer and part number.').refine(v=>!v.noSubstitutions||Boolean(v.manufacturer&&v.partNumber),'No Substitutions requires manufacturer and part number.');
export type Purchasing=z.infer<typeof purchaseSchema>;
