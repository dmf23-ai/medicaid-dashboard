// Core data types for the Medicaid Dashboard

export interface StateData {
  stateCode: string;
  stateName: string;
  region: string;
  expansionStatus: "expanded" | "not_expanded" | "partial";
  population: number;
  medicaidEnrollment: number;
  chipEnrollment: number;
  totalEnrollment: number;
  enrollmentTrend: MonthlyDataPoint[];
  spending: SpendingData;
  managedCare: ManagedCareData;
  quality: QualityMetrics;
  policyTracker: PolicyData;
  lastUpdated: string;
}

export interface MonthlyDataPoint {
  month: string; // YYYY-MM format
  value: number;
}

export interface SpendingData {
  totalSpending: number;
  federalShare: number;
  stateShare: number;
  perEnrollee: number;
  fmapRate: number;
  spendingTrend: MonthlyDataPoint[];
  spendingByCategory: {
    category: string;
    amount: number;
    percentOfTotal: number;
  }[];
}

export interface ManagedCareData {
  penetrationRate: number;
  numberOfMCOs: number;
  averageStarRating: number;
  plans: {
    planName: string;
    enrollment: number;
    starRating: number;
  }[];
}

export interface QualityMetrics {
  overallScore: number;
  preventiveCare: number;
  behavioralHealth: number;
  maternalHealth: number;
  childHealth: number;
  accessToCare: number;
}

export interface PolicyData {
  activeWaivers: {
    waiverType: string;
    status: string;
    description: string;
    approvalDate?: string;
    expirationDate?: string;
  }[];
  workRequirements: {
    status: "implemented" | "approved" | "pending" | "not_applicable";
    effectiveDate?: string;
    details?: string;
  };
  recentPolicyChanges: {
    date: string;
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
  }[];
}

export interface ComparisonConfig {
  anchorState: string;
  comparisonStates: string[];
  metrics: string[];
  dateRange: {
    start: string;
    end: string;
  };
}

export interface DashboardAlert {
  id: string;
  stateCode: string;
  stateName: string;
  type: "enrollment_change" | "spending_spike" | "policy_change" | "quality_alert";
  severity: "high" | "medium" | "low" | "critical";
  title: string;
  description: string;
  date: string;
  metric?: string;
  change?: number;
  sourceUrl?: string;
  sourceLabel?: string;
}

export interface StateSummary {
  stateCode: string;
  stateName: string;
  enrollment: number;
  enrollmentChange: number;
  perEnrolleeSpending: number;
  perEnrolleeSpendingChange?: number | null;
  managedCarePenetration: number;
  qualityScore: number;
  qualityScoreChange?: number | null;
  expansionStatus: "expanded" | "not_expanded" | "partial";
}

// --- New types for the executive dashboard ---

export interface ExecutiveInsight {
  id: string;
  rank: number;
  title: string;
  summary: string;
  whyItMatters: string;
  confidence: "high" | "medium" | "low";
  category: "operational" | "financial" | "regulatory" | "competitive" | "quality";
  impactLevel: "critical" | "high" | "moderate";
  actionPrompt: string;
  relatedStates: string[];
  source: string;
  sourceUrl?: string;
  timestamp: string;
}

export interface SignalItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl?: string;
  category: "procurement" | "policy" | "regulatory" | "oig" | "cms" | "legislative";
  relevance: "high" | "medium" | "low";
  timestamp: string;
  affectedStates?: string[];
}

export interface RiskOpportunityItem {
  id: string;
  label: string;
  description: string;
  risk: number;       // 0-100
  opportunity: number; // 0-100
  impact: number;      // 0-100 (bubble size)
  trend: "improving" | "stable" | "deteriorating";
  category: "procurement" | "operations" | "policy" | "quality" | "competitive";
  sourceUrl?: string;
  recommendedAction?: string;
}

export interface TexasPulseMetric {
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  icon?: string;
  tooltip?: string;
  sourceUrl?: string;
}
