export interface KpiItem {
  label: string;
  value: string;
  icon: string;
  caption?: string;
  tone?: "blue" | "violet" | "green" | "amber";
  progress?: number;
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