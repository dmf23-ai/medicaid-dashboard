// State metadata and configuration constants

export const US_STATES: Record<string, { name: string; region: string; expansionStatus: string }> = {
  AL: { name: "Alabama", region: "South", expansionStatus: "expanded" },
  AK: { name: "Alaska", region: "West", expansionStatus: "expanded" },
  AZ: { name: "Arizona", region: "West", expansionStatus: "expanded" },
  AR: { name: "Arkansas", region: "South", expansionStatus: "expanded" },
  CA: { name: "California", region: "West", expansionStatus: "expanded" },
  CO: { name: "Colorado", region: "West", expansionStatus: "expanded" },
  CT: { name: "Connecticut", region: "Northeast", expansionStatus: "expanded" },
  DE: { name: "Delaware", region: "Northeast", expansionStatus: "expanded" },
  FL: { name: "Florida", region: "South", expansionStatus: "not_expanded" },
  GA: { name: "Georgia", region: "South", expansionStatus: "partial" },
  HI: { name: "Hawaii", region: "West", expansionStatus: "expanded" },
  ID: { name: "Idaho", region: "West", expansionStatus: "expanded" },
  IL: { name: "Illinois", region: "Midwest", expansionStatus: "expanded" },
  IN: { name: "Indiana", region: "Midwest", expansionStatus: "expanded" },
  IA: { name: "Iowa", region: "Midwest", expansionStatus: "expanded" },
  KS: { name: "Kansas", region: "Midwest", expansionStatus: "not_expanded" },
  KY: { name: "Kentucky", region: "South", expansionStatus: "expanded" },
  LA: { name: "Louisiana", region: "South", expansionStatus: "expanded" },
  ME: { name: "Maine", region: "Northeast", expansionStatus: "expanded" },
  MD: { name: "Maryland", region: "Northeast", expansionStatus: "expanded" },
  MA: { name: "Massachusetts", region: "Northeast", expansionStatus: "expanded" },
  MI: { name: "Michigan", region: "Midwest", expansionStatus: "expanded" },
  MN: { name: "Minnesota", region: "Midwest", expansionStatus: "expanded" },
  MS: { name: "Mississippi", region: "South", expansionStatus: "not_expanded" },
  MO: { name: "Missouri", region: "Midwest", expansionStatus: "expanded" },
  MT: { name: "Montana", region: "West", expansionStatus: "expanded" },
  NE: { name: "Nebraska", region: "Midwest", expansionStatus: "expanded" },
  NV: { name: "Nevada", region: "West", expansionStatus: "expanded" },
  NH: { name: "New Hampshire", region: "Northeast", expansionStatus: "expanded" },
  NJ: { name: "New Jersey", region: "Northeast", expansionStatus: "expanded" },
  NM: { name: "New Mexico", region: "West", expansionStatus: "expanded" },
  NY: { name: "New York", region: "Northeast", expansionStatus: "expanded" },
  NC: { name: "North Carolina", region: "South", expansionStatus: "expanded" },
  ND: { name: "North Dakota", region: "Midwest", expansionStatus: "expanded" },
  OH: { name: "Ohio", region: "Midwest", expansionStatus: "expanded" },
  OK: { name: "Oklahoma", region: "South", expansionStatus: "expanded" },
  OR: { name: "Oregon", region: "West", expansionStatus: "expanded" },
  PA: { name: "Pennsylvania", region: "Northeast", expansionStatus: "expanded" },
  RI: { name: "Rhode Island", region: "Northeast", expansionStatus: "expanded" },
  SC: { name: "South Carolina", region: "South", expansionStatus: "not_expanded" },
  SD: { name: "South Dakota", region: "Midwest", expansionStatus: "expanded" },
  TN: { name: "Tennessee", region: "South", expansionStatus: "not_expanded" },
  TX: { name: "Texas", region: "South", expansionStatus: "not_expanded" },
  UT: { name: "Utah", region: "West", expansionStatus: "expanded" },
  VT: { name: "Vermont", region: "Northeast", expansionStatus: "expanded" },
  VA: { name: "Virginia", region: "South", expansionStatus: "expanded" },
  WA: { name: "Washington", region: "West", expansionStatus: "expanded" },
  WV: { name: "West Virginia", region: "South", expansionStatus: "expanded" },
  WI: { name: "Wisconsin", region: "Midwest", expansionStatus: "partial" },
  WY: { name: "Wyoming", region: "West", expansionStatus: "not_expanded" },
};

export const NON_EXPANSION_STATES = Object.entries(US_STATES)
  .filter(([, data]) => data.expansionStatus === "not_expanded")
  .map(([code]) => code);

// Peer-group framework aligned with the Chief's mental model
export const TEXAS_PEER_STATES = {
  scaleStates: ["CA", "FL", "NY", "PA", "IL"],             // Comparable program size
  nonExpansionPeers: ["FL", "GA", "MS", "TN", "SC", "KS", "WY"], // Same expansion posture
  sunBeltPeers: ["FL", "GA", "AZ", "NC", "LA"],            // Demographics + geography
  managedCarePeers: ["FL", "TN", "OH", "PA", "LA"],        // High managed-care penetration
  pursuitStates: ["OH", "NC", "IN", "VA", "MI"],            // States where Accenture may pursue new work
};

export const PEER_GROUP_LABELS: Record<string, { label: string; description: string }> = {
  scaleStates: { label: "Scale Peers", description: "Large Medicaid programs by enrollment" },
  nonExpansionPeers: { label: "Non-Expansion", description: "States that haven't expanded Medicaid" },
  sunBeltPeers: { label: "Sun Belt", description: "Similar demographics and geography" },
  managedCarePeers: { label: "Managed Care", description: "High managed-care penetration states" },
  pursuitStates: { label: "Pursuit States", description: "Strategic growth targets" },
};

// Color palette for state comparison charts — updated for dark theme
export const STATE_COLORS: Record<string, string> = {
  TX: "#F97316", // Texas orange
  CA: "#60A5FA", // Blue
  FL: "#34D399", // Emerald
  NY: "#C084FC", // Purple
  PA: "#22D3EE", // Cyan
  IL: "#FB923C", // Amber
  OH: "#818CF8", // Indigo
  GA: "#F472B6", // Pink
  NC: "#A3E635", // Lime
  MI: "#38BDF8", // Sky
  TN: "#FBBF24", // Yellow
  MS: "#F87171", // Red
  LA: "#2DD4BF", // Teal
  SC: "#E879F9", // Fuchsia
  DEFAULT: "#94A3B8", // Slate
};

export const METRICS = {
  enrollment: {
    label: "Total Enrollment",
    format: "number",
    description: "Total Medicaid & CHIP enrollees",
  },
  perEnrolleeSpending: {
    label: "Per-Enrollee Spending",
    format: "currency",
    description: "Annual Medicaid spending per enrollee",
  },
  managedCarePenetration: {
    label: "Managed Care Rate",
    format: "percent",
    description: "% of enrollees in managed care",
  },
  qualityScore: {
    label: "Quality Score",
    format: "score",
    description: "Composite quality measure (0-100)",
  },
  enrollmentChange: {
    label: "Enrollment Change (YoY)",
    format: "percent_change",
    description: "Year-over-year enrollment change",
  },
  fmapRate: {
    label: "FMAP Rate",
    format: "percent",
    description: "Federal Medical Assistance Percentage",
  },
};

export const DATA_SOURCES = {
  medicaidGov: {
    name: "data.medicaid.gov",
    url: "https://data.medicaid.gov",
    description: "Official CMS Medicaid enrollment and expenditure data",
  },
  kff: {
    name: "Kaiser Family Foundation",
    url: "https://www.kff.org/statedata/",
    description: "State health facts and policy tracking",
  },
  macpac: {
    name: "MACPAC",
    url: "https://www.macpac.gov/macstats/",
    description: "Medicaid and CHIP Payment and Access Commission data",
  },
  cmsScorecard: {
    name: "CMS Scorecard",
    url: "https://www.medicaid.gov/state-overviews/scorecard/",
    description: "State performance metrics and program characteristics",
  },
};
