import {z} from 'zod';
export const pdfTemplate=z.object({title:z.string().trim().min(1).max(80).default('MATERIAL REQUEST FORM'),companyName:z.string().trim().max(100).default(''),paper:z.enum(['Letter','A4']).default('Letter'),accent:z.string().regex(/^#[a-fA-F0-9]{6}$/).default('#dce5f5'),descriptionPercent:z.number().int().min(40).max(70).default(58),fontSize:z.number().int().min(8).max(12).default(9)}).strict();
export type PDFTemplate=z.infer<typeof pdfTemplate>;
