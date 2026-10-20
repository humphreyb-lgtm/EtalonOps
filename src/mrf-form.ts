export type MRFForm={workArea:string;packagingMethod:string;specialPackagingInstructions:string;defaultTaskCode:string;deliveryInstructions:string;purchasingNotes:string};
export const emptyMRFForm=():MRFForm=>({workArea:'',packagingMethod:'Standard',specialPackagingInstructions:'',defaultTaskCode:'',deliveryInstructions:'',purchasingNotes:''});
export function printedTaskCode(item:string|undefined,defaultCode:string|undefined){const code=(item??'').trim();return code&&code!==(defaultCode??'').trim()?code:'';}
export function effectiveTaskCode(item:string|undefined,defaultCode:string|undefined){return (item??'').trim()||(defaultCode??'').trim();}
