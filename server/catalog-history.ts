import { candidate, type DraftBody } from './contracts';

// Only an unchanged snapshot from this owner's existing draft line is historical.
// Parse both sides through the public contract, ignoring server-only provenance.
export function historicalSnapshot(previous: {materialId: unknown; candidate: unknown; source: unknown}|undefined, line: DraftBody['lines'][number]) {
  if (!previous || !line.candidate || String(previous.materialId).toLowerCase() !== line.candidate.id.toLowerCase() || previous.source !== line.source || !previous.candidate) return null;
  try {
    const stored = JSON.parse(String(previous.candidate));
    const parsed = candidate.safeParse(stored);
    if (!parsed.success || JSON.stringify(parsed.data) !== JSON.stringify(candidate.parse(line.candidate))) return null;
    return stored;
  } catch { return null; }
}
