/** Default pipeline stage keys — UI labels are translated; stored names are English defaults companies can rename. */
export const DEFAULT_PIPELINE_STAGES = [
  { name: "New", sortOrder: 0, isWon: false, isLost: false },
  { name: "Qualified", sortOrder: 1, isWon: false, isLost: false },
  { name: "Proposal", sortOrder: 2, isWon: false, isLost: false },
  { name: "Negotiation", sortOrder: 3, isWon: false, isLost: false },
  { name: "Won", sortOrder: 4, isWon: true, isLost: false },
  { name: "Lost", sortOrder: 5, isWon: false, isLost: true },
] as const;
