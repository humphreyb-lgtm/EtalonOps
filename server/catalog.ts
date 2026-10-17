import { parse } from 'csv-parse/sync';
import { importRow, csvColumns, type ImportRow } from './contracts';
import { normalize } from './search';
export type Report = { rows: number; errors: { row: number; message: string }[]; kind: string };
export function parseCatalog(file: string) {
    const rows: ImportRow[] = [], errors: Report['errors'] = [];
    let records: Record<string, string>[];
    try {
      records = parse(file, { bom: true, columns: header => {
        if (header.length !== csvColumns.length || new Set(header).size !== header.length || csvColumns.some(name => !header.includes(name))) throw new Error('CSV headers must exactly match the v1 contract.');
        return header;
      }, skip_empty_lines: true, max_record_size: 25000 });
    } catch { return { rows, report: { rows: 0, kind: '', errors: [{ row: 1, message: 'Malformed CSV or invalid header.' }] } }; }
    if (!records.length || records.length > 1000) errors.push({ row: 1, message: 'Import must contain 1–1000 records.' });
    const keys = new Set<string>(), aliasOwners = new Map<string, string>();
    records.forEach((record, i) => {
      try {
        // Reversible spreadsheet escaping on export; accept only our convention.
        for (const key of Object.keys(record)) if (/^'[\t\r\n =+@\-']/.test(record[key])) record[key] = record[key].slice(1);
        const row = importRow.parse(record);
        if (keys.has(row.external_key.toLowerCase())) throw new Error('Duplicate external_key.');
        keys.add(row.external_key.toLowerCase());
        const list = JSON.parse(row.aliases_json), specs = JSON.parse(row.specifications_json), conversion = JSON.parse(row.conversion_basis_json);
        if (!Array.isArray(list) || !list.length || list.length > 50 || !list.every(a => typeof a === 'string' && a.trim() && a.length <= 200)) throw new Error('Aliases must be a nonempty JSON string array.');
        if (!Array.isArray(specs) || specs.length > 30 || !specs.every(s => typeof s === 'string' && s.length <= 500)) throw new Error('Specifications must be a JSON string array.');
        // Conversions require a future reviewed structured contract. Never infer them.
        if (conversion !== null) throw new Error('CSV v1 supports null conversion basis only; no conversions are inferred.');
        if (row.dataset_kind === 'reviewed' && !/^https:\/\//.test(row.source_url)) throw new Error('Reviewed records require an HTTPS evidence URL.');
        if (row.source_url && new URL(row.source_url).protocol !== 'https:') throw new Error('Source URL must be HTTPS.');
        for (const alias of list) {
          if (!normalize(alias) || normalize(alias).length > 200) throw new Error('Aliases must normalize to 1–200 searchable characters.');
          const key = `${normalize(alias)}|${row.requested_uom}`;
          if (aliasOwners.has(key) && aliasOwners.get(key) !== row.external_key) throw new Error('Ambiguous alias within this file.');
          aliasOwners.set(key, row.external_key);
        }
        rows.push(row);
      } catch (error) { errors.push({ row: i + 2, message: error instanceof Error && !('issues' in error) ? error.message : 'Invalid fields or unit.' }); }
    });
    const kinds = new Set(rows.map(row => row.dataset_kind));
    if (kinds.size > 1) errors.push({ row: 1, message: 'Do not mix fixtures and reviewed records in one batch.' });
    return { rows, report: { rows: records.length, errors, kind: rows[0]?.dataset_kind ?? '' } };
  }
