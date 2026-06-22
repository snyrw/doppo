export type DataExport = {
  exportedAt: string;
  profile: { name: string; email: string; emailVerified: boolean; createdAt: Date };
  projects: { id: string; name: string; cards: unknown; canvas: unknown; createdAt: Date; updatedAt: Date }[];
  creditLedger: { type: string; amountMicros: number; jobTier: string | null; jobDurationMs: number | null; createdAt: Date }[];
};

export function buildDataExport(
  profile: DataExport["profile"],
  projects: DataExport["projects"],
  creditLedger: DataExport["creditLedger"],
): DataExport {
  return { exportedAt: new Date().toISOString(), profile, projects, creditLedger };
}
