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
  fmapRate: number; // Federal Medical Assistance Percentage
  spendingTrend: MonthlyDataPoint[];
  spendingByCategory: {
    category: string;
    amount: number;
    percentOfTotal: number;
  }[];
}

export interface ManagedCareData {
  penetrationRate: number; // % of enrollees in managed care
  numberOfMCOs: number;
  averageStarRating: number;
  plans: {
    planName: string;
    enrollment: number;
    starRating: number;
  }[];
}

export interface QualityMetrics {
  overallScore: number; // 0-100 composite
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
  anchorState: string; // Default: TX
  comparisonStates: string[];
  metrics: string[];
  dateRange: {
    start: string;
    end: string;
  };
}

export interface DashboardAlert {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info" | "high" | "medium" | "low";
  description: string;
  states?: string[];
  timestamp: string;
  category?: string;
  // Legacy fields (for backward compat with sample data)
  stateCode?: string;
  stateName?: string;
  type?: "enrollment_change" | "spending_spike" | "policy_change" | "quality_alert";
  date?: string;
  metric?: string;
  change?: number;
}

export interface StateSummary {
  stateCode: string;
  stateName: string;
  enrollment: number;
  enrollmentChange: number; // YoY percentage
  perEnrolleeSpending: number;
  managedCarePenetration: number;
  qualityScore: number;
  expansionStatus: "expanded" | "not_expanded" | "partial";
}
