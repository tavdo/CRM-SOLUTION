/** Defaults for new contractor workspaces; existing stages are preserved. */
export const DEFAULT_PIPELINE_STAGES = [
  { name: "Incoming request", sortOrder: 0, isWon: false, isLost: false },
  { name: "Site visit", sortOrder: 1, isWon: false, isLost: false },
  { name: "Estimate & offer", sortOrder: 2, isWon: false, isLost: false },
  { name: "Contract discussion", sortOrder: 3, isWon: false, isLost: false },
  { name: "Agreed / contract", sortOrder: 4, isWon: true, isLost: false },
  { name: "Declined", sortOrder: 5, isWon: false, isLost: true },
] as const;
