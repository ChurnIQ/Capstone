export interface User {
  name: string
  email: string
  avatar?: string | null
}

export interface Stats {
  totalCustomers: number
  totalPredictions: number
  highRiskCount: number
  churnedCount: number
  churnRate: number
  churnDelta: number | null
  modelAccuracy: number
  modelName: string
}

export interface Prediction {
  _id: string
  customer_id: string
  customer_name: string
  risk_category: 'High' | 'Medium' | 'Low'
  churn_probability: number
  churn_prediction: 0 | 1
  /** Legacy single-string strategy */
  recommended_strategy?: string
  /** New multi-strategy array */
  recommended_strategies?: string[]
  /** Churn reason explanations */
  churn_reasons?: string[]
  createdAt: string
}

export interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface TrendPoint { name: string; churn: number; retained: number }
export interface Segment    { name: string; value: number; count: number; color: string }
export interface Feature    { feature: string; importance: number }
export interface Model      { model: string; accuracy: number; precision: number; recall: number; f1: number; selected: boolean }
export interface BatchStats { totalProcessed: number; avgChurnRate: number; highRiskCount: number; mostCommonRisk: string }

export type TabId = 'overview' | 'predict' | 'analytics' | 'models' | 'strategies' | 'bigdata'
