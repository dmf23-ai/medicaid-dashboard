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

// States that have NOT expanded Medicaid (as of 2026)
export const NON_EXPANSION_STATES = Object.entries(US_STATES)
  .filter(([, data]) => data.expansionStatus === "not_expanded")
  .map(([code]) => code);

// Suggested peer states for Texas comparison
export const TEXAS_PEER_STATES = {
  byPopulation: ["CA", "FL", "NY", "PA", "IL"], // Large states
  byRegion: ["FL", "LA", "OK", "AR", "MS"],     // Southern/neighboring
  byExpansion: ["FL", "GA", "MS", "TN", "WY", "SC", "KS"], // Non-expansion peers
};

// Color palette for state comparison charts
export const STATE_COLORS: Record<string, string> = {
  TX: "#bf360c", // Texas gets a distinct warm color
  CA: "#1565c0",
  FL: "#2e7d32",
  NY: "#6a1b9a",
  PA: "#00838f",
  IL: "#e65100",
  OH: "#283593",
  GA: "#4e342e",
  NC: "#1b5e20",
  MI: "#0d47a1",
  DEFAULT: "#546e7a",
};

// Metric display configuration
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
