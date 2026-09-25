export interface KpiItem {
  label: string;
  value: string;
  icon: string;
}

export interface Task {
  id: number;
  taskName: string;
  taskType: string;
  assignedTo: string;
  assignedOn: string;
}

export interface Activity {
  id: number;
  type: "PR" | "Invoice";
  title: string;
  description?: string;
  actor?: string;
  date: string;
}