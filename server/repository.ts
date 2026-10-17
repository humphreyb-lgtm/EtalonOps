import type { Store } from './store';
type AsyncCompatible<T> = { [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => R | Promise<R> : T[K] };
export type Repository = AsyncCompatible<Pick<Store, 'engine' | 'health' | 'member' | 'requireAdmin' | 'audit' | 'search' | 'getProjectDraft' | 'getDraft' | 'saveDraft' | 'previewImport' | 'applyImport' | 'rollbackImport' | 'exportCsv' | 'listImports'>>;
