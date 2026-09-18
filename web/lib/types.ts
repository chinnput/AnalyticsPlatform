export type ChartType = "line" | "area" | "bar" | "scatter";

export type LayoutMode = "single" | "grid-2x2" | "tabs";

export interface TagRef {
  source: string;
  database: string;
  table: string;
  timeColumn: string;
  valueColumn: string;
  label?: string;
}

export interface Panel {
  id: string;
  title: string;
  chartType: ChartType;
  tags: TagRef[];
}

export interface Group {
  id: string;
  name: string;
  tags: TagRef[];
}

export interface Workspace {
  name: string;
  layout: LayoutMode;
  panels: Panel[];
  groups: Group[];
  updatedAt: string;
}

export const emptyWorkspace = (name = "default"): Workspace => ({
  name,
  layout: "single",
  panels: [],
  groups: [],
  updatedAt: new Date().toISOString(),
});
