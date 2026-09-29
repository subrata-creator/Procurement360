export interface KpiItem {
  label: string;
  value: string;
  icon: string;
  caption?: string;
  tone?: "blue" | "violet" | "green" | "amber";
  progress?: number;
  trend?: string;        // e.g. "12%"
  trendUp?: boolean;     // true = green arrow up, false = red arrow down
  spark?: number[];      // small sparkline series
  progressLabel?: string;
  insight?: string;
  insightTrend?: "positive" | "attention";
}

export interface Task {
  id: number;
  taskName: string;
  taskType: string;
  assignedTo: string;
  assignedOn: string;
  description?: string;
  priority?: "Low" | "Normal" | "High";
}

export interface Activity {
  id: number;
  type: "PR" | "Invoice";
  title: string;
  description?: string;
  actor?: string;
  date: string;
}