export type Purchasing={productId:string|null;manufacturer:string;partNumber:string;noSubstitutions:boolean};
export type ManufacturerProduct={id:string;manufacturerId?:string;title?:string;sourceUrl?:string;details?:Record<string,string|number>;manufacturer:string;partNumber:string;verification?:'provisional'|'reviewed';allowed?:boolean};
export type Unit = 'EA' | 'FT' | 'STICK' | 'BOX' | 'ROLL' | 'PAIR';
export const units: Unit[] = ['EA', 'FT', 'STICK', 'BOX', 'ROLL', 'PAIR'];
export type Source = 'verified_fixture' | 'ai_fixture' | 'user_description' | 'verified';
export type Candidate = {
  id: string;
  description: string;
  specs: string[];
  productUnit: Unit;
  source: Exclude<Source, 'user_description'>;
  verification?: 'provisional'|'reviewed';
  products?: ManufacturerProduct[];
  preferredProductId?: string|null;
  highUse?: boolean;
  category: 'conduit' | 'screw' | 'tape' | 'general';
};
export type Line = {
  taskCode?:string;
  id: string;
  quantity: string;
  requestedUnit: Unit;
  description: string;
  rawInput: { quantity: string; description: string; requestedUnit: Unit };
  candidate: Candidate | null;
  source: Source;
  purchasing?:Purchasing;
  deliveryMode: 'inherit' | 'override';
  overrideDate: string | null;
};
export type Draft = {
  foreman?:{id:string;name:string};
  submitted?:{id:string;number:string;revision:number;submittedAt:string};
  revisionOf?:string|null;
  name?: string;
  id?: string;
  version?: number;
  schemaVersion: 1;
  projectId: string;
  ownerId: 'local-demo-foreman';
  deliveryDate: string;
  lines: Line[];
  savedAt: string | null;
};

export const projects = [
  { id: 'riverside', name: 'Riverside Office Complex', number: '24-1187' },
  { id: 'northside', name: 'Northside Service Center', number: '24-1204' },
];

// Explicitly fictional fixtures. They are not verified product or catalog facts.
export const verifiedFixtures: Candidate[] = [
  { id: 'fixture-pvc-40', description: '1 in. PVC conduit, Schedule 40', specs: ['10 ft length', 'Plain end', 'Gray'], productUnit: 'STICK', source: 'verified_fixture', category: 'conduit' },
  { id: 'fixture-pvc-80', description: '1 in. PVC conduit, Schedule 80', specs: ['10 ft length', 'Heavy wall', 'Gray'], productUnit: 'STICK', source: 'verified_fixture', category: 'conduit' },
  { id: 'fixture-pvc-elbow', description: '1 in. PVC 90° conduit elbow', specs: ['Schedule 40', 'Standard radius', 'Gray'], productUnit: 'EA', source: 'verified_fixture', category: 'conduit' },
  { id: 'fixture-tape', description: 'Black electrical tape', specs: ['3/4 in. width', 'General purpose', 'Black'], productUnit: 'ROLL', source: 'verified_fixture', category: 'tape' },
];

export const discoveryFixtures: Candidate[] = [
  { id: 'fixture-device-screw', description: 'Black 6-32 device mounting screws', specs: ['6-32 thread', 'Black finish', 'Length needs confirmation'], productUnit: 'EA', source: 'ai_fixture', category: 'screw' },
  { id: 'fixture-device-screw-long', description: 'Black 6-32 extended device screws', specs: ['6-32 thread', 'Black finish', 'Confirm required length'], productUnit: 'EA', source: 'ai_fixture', category: 'screw' },
];

export const clarificationOptions = [
  { id: 'hex', title: '1/4 in. hex-head self-drilling screws', detail: 'For metal framing and sheet metal.' },
  { id: 'tek', title: 'Tek screws for metal studs', detail: 'Self-drilling screws commonly used for metal studs.' },
  { id: 'pan', title: 'Self-tapping pan-head screws', detail: 'General-purpose screws with a pan head.' },
  { id: 'other', title: 'Other / none of these', detail: 'Tell the assistant what you need in your own words.' },
];

export function searchFixtures(input: string): Candidate[] {
  const normalized = input.toLowerCase().replace(/["″]/g, ' in ').replace(/\s+/g, ' ').trim();
  if (/pvc|conduit/.test(normalized)) return verifiedFixtures.filter(item => item.category === 'conduit');
  if (/tape/.test(normalized)) return verifiedFixtures.filter(item => item.category === 'tape');
  return [];
}

export function positiveQuantity(value: string): boolean {
  return /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) && Number.isFinite(Number(value)) && Number(value) > 0;
}

export function localDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function formatDate(value: string): string {
  if (!value) return 'Choose a date';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export function freshDraft(projectId: string): Draft {
  return { name:'New MRF', schemaVersion: 1, projectId, ownerId: 'local-demo-foreman', deliveryDate: localDate(), lines: [], savedAt: null };
}

export const storageKey = (projectId: string) => `etalonops:demo:v1:${projectId}`;

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isUnit(value: unknown): value is Unit {
  return typeof value === 'string' && units.includes(value as Unit);
}

export function loadDraft(projectId: string, id?:string): { draft: Draft; error?: string; restored?: boolean } {
  try {
    const saved = localStorage.getItem(id?`${storageKey(projectId)}:draft:${id}`:storageKey(projectId));
    if (!saved) return { draft: freshDraft(projectId) };
    const value = JSON.parse(saved);
    const candidateValid = (candidate: unknown) => {
      if (candidate === null) return true;
      if (!candidate || typeof candidate !== 'object') return false;
      const c = candidate as Candidate;
      return typeof c.id === 'string' && typeof c.description === 'string' && Array.isArray(c.specs)
        && c.specs.every(s => typeof s === 'string') && isUnit(c.productUnit)
        && ['conduit', 'screw', 'tape'].includes(c.category) && ['verified_fixture', 'ai_fixture'].includes(c.source);
    };
    if (value.schemaVersion !== 1 || value.ownerId !== 'local-demo-foreman' || value.projectId !== projectId
      || (value.foreman!==undefined&&(!value.foreman||typeof value.foreman.id!=='string'||value.foreman.id.length>64||typeof value.foreman.name!=='string'||value.foreman.name.length>200))
      || !isDate(value.deliveryDate) || !Array.isArray(value.lines) || value.lines.length > 500
      || (value.savedAt !== null && (typeof value.savedAt !== 'string' || Number.isNaN(Date.parse(value.savedAt))))
      || !value.lines.every((line: Line) => line && (line.taskCode===undefined||(typeof line.taskCode==='string'&&line.taskCode.length<=16)) && typeof line.id === 'string' && typeof line.description === 'string'
        && line.description.trim() && line.description.length <= 2000 && positiveQuantity(line.quantity)
        && isUnit(line.requestedUnit) && ['verified_fixture', 'ai_fixture', 'user_description'].includes(line.source)
        && (!line.purchasing || (typeof line.purchasing.manufacturer==='string' && typeof line.purchasing.partNumber==='string' && typeof line.purchasing.noSubstitutions==='boolean' && (line.purchasing.productId===null||typeof line.purchasing.productId==='string') && (!line.purchasing.noSubstitutions||Boolean(line.purchasing.manufacturer.trim()&&line.purchasing.partNumber.trim()))))
        && line.rawInput && typeof line.rawInput.description === 'string' && typeof line.rawInput.quantity === 'string'
        && isUnit(line.rawInput.requestedUnit) && candidateValid(line.candidate)
        && ((line.deliveryMode === 'inherit' && line.overrideDate === null) || (line.deliveryMode === 'override' && isDate(line.overrideDate))))
      || new Set(value.lines.map((line: Line) => line.id)).size !== value.lines.length) {
      throw new Error('Invalid local draft');
    }
    if(value.name!==undefined&&(typeof value.name!=='string'||!value.name.trim()||value.name.length>120))throw new Error('Invalid draft name');
    return { draft: {...value,name:value.name??'Saved MRF'} as Draft, restored: true };
  } catch {
    return { draft: freshDraft(projectId), error: 'This browser’s saved draft could not be opened. It has not been deleted. Saving a new draft will replace it.' };
  }
}
