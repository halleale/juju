export type EvidenceSource = {
  id: string;
  name: string;
  kind: 'sample' | 'provider';
  observedAt: string;
  ingestedAt: string;
  reference: string;
};
export type Factor = {
  id: string;
  title: string;
  observation: string;
  relevance: string;
  direction: 'supports' | 'opposes';
  status: 'confirmed' | 'unresolved';
  modelUse: 'input' | 'context';
  sourceIds: string[];
  invalidatedBy: string;
  critical: boolean;
};
export type ResearchSnapshot = {
  id: string;
  analyzedAt: string;
  quoteUpdatedAt: string;
  quoteIngestedAt: string;
  modelValidated: boolean;
  // Interval for unconditional win probability; push mass remains fixed.
  winRange: [number, number];
  qualification: { minimumEdge: number; validated: boolean; version: string };
  sources: EvidenceSource[];
  factors: Factor[];
};
