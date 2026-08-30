import type { EvidenceEvent } from '@aes/contracts';

export type GraphIssueKind =
  | 'orphan'
  | 'cycle'
  | 'duplicate'
  | 'conflicting-result'
  | 'missing-acknowledgement'
  | 'transport-gap'
  | 'unknown-write';

export interface GraphIssue {
  kind: GraphIssueKind;
  eventIds: string[];
  message: string;
}

export interface GraphAnalysis {
  issues: GraphIssue[];
  replay: EvidenceEvent[];
  complete: boolean;
}

export function analyzeEventGraph(events: EvidenceEvent[]): GraphAnalysis {
  const issues: GraphIssue[] = [];
  const byId = new Map<string, EvidenceEvent>();
  const duplicates = new Map<string, EvidenceEvent[]>();

  for (const event of events) {
    const existing = byId.get(event.eventId);
    if (existing) duplicates.set(event.eventId, [...(duplicates.get(event.eventId) ?? [existing]), event]);
    else byId.set(event.eventId, event);
  }

  for (const [eventId, copies] of duplicates) {
    issues.push({ kind: 'duplicate', eventIds: [eventId], message: `Event ${eventId} appears ${copies.length} times.` });
    if (new Set(copies.map((copy) => copy.digest)).size > 1) {
      issues.push({ kind: 'conflicting-result', eventIds: [eventId], message: `Event ${eventId} has conflicting digests.` });
    }
  }

  for (const event of byId.values()) {
    const missing = event.parentIds.filter((parentId) => !byId.has(parentId));
    if (missing.length) {
      issues.push({ kind: 'orphan', eventIds: [event.eventId, ...missing], message: `${event.eventId} references missing parent evidence.` });
    }
    if (event.deliveryState === 'unknown') {
      issues.push({ kind: 'unknown-write', eventIds: [event.eventId], message: 'Remote write outcome is unknown and requires read-back reconciliation.' });
    }
    if (event.deliveryState === 'failed') {
      issues.push({ kind: 'transport-gap', eventIds: [event.eventId], message: 'Evidence delivery failed.' });
    }
    if (event.deliveryState === 'pending' && Date.now() - Date.parse(event.timestamp) > 60_000) {
      issues.push({ kind: 'missing-acknowledgement', eventIds: [event.eventId], message: 'Delivery acknowledgement is overdue.' });
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const replay: EvidenceEvent[] = [];
  const cycleKeys = new Set<string>();

  const visit = (event: EvidenceEvent, path: string[]) => {
    if (visited.has(event.eventId)) return;
    if (visiting.has(event.eventId)) {
      const cycle = [...path.slice(path.indexOf(event.eventId)), event.eventId];
      const key = [...new Set(cycle)].sort().join(':');
      if (!cycleKeys.has(key)) {
        cycleKeys.add(key);
        issues.push({ kind: 'cycle', eventIds: cycle, message: 'Causal cycle prevents a complete replay.' });
      }
      return;
    }
    visiting.add(event.eventId);
    for (const parentId of event.parentIds) {
      const parent = byId.get(parentId);
      if (parent) visit(parent, [...path, event.eventId]);
    }
    visiting.delete(event.eventId);
    visited.add(event.eventId);
    replay.push(event);
  };

  [...byId.values()]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.eventId.localeCompare(right.eventId))
    .forEach((event) => visit(event, []));

  return { issues, replay, complete: issues.every((issue) => !['orphan', 'cycle', 'duplicate'].includes(issue.kind)) };
}
