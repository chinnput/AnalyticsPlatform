// ---- Project: ภาชนะหลัก (tag, group, class definition, ค่าที่ตั้งไว้) ----

export interface SavedTag {
  tag: string;
  description?: string;
  group?: string;
}

// "file" = ช่วงเวลาทั้งไฟล์ (ใช้กับ tag จากไฟล์)
export type RangePreset = "1D" | "1W" | "1M" | "custom" | "file";

// ไฟล์ CSV/Excel ที่อัปโหลดเข้า project — tag = "file:<id>/<column>"
export interface ProjectFile {
  id: string;
  name: string; // ชื่อไฟล์เดิม
  ext: ".csv" | ".xlsx";
  timeColumn: string;
  columns: string[]; // column ตัวเลข (= tag)
  allColumns: string[]; // ทุก column (ให้เลือก column เวลา)
  rows: number;
  start: string; // "YYYY-MM-DD HH:MM:SS"
  end: string;
  stepSeconds: number | null;
  sheet: string | null;
  sheets: string[];
  uploadedAt: string;
}

export const FILE_TAG_PREFIX = "file:";
export const fileTag = (fileId: string, column: string) =>
  `${FILE_TAG_PREFIX}${fileId}/${column}`;
export const fileIdOfTag = (tag: string) =>
  tag.startsWith(FILE_TAG_PREFIX)
    ? tag.slice(FILE_TAG_PREFIX.length).split("/")[0]
    : null;

// ---- Class definition (แบ่งอย่างไร) — ดู analysis-service/app/pipeline/classify.py ----

interface ClassDefBase {
  id: string;
  name: string;
  noneLabel?: string; // ไม่เข้า class ไหน (ถูกตัดทิ้งตอนวิเคราะห์)
  tolerance?: number;
}

export type ClassDef =
  | (ClassDefBase & {
      type: "one-hot"; // หลาย tag แต่ละ tag บอกว่า class ตัวเอง active ไหม
      classes: { label: string; tag: string; activeValue: number }[];
    })
  | (ClassDefBase & {
      type: "value-map"; // tag เดียว ค่าแต่ละค่าคือ class
      tag: string;
      map: { value: number; label: string }[];
    })
  | (ClassDefBase & {
      type: "range"; // tag ต่อเนื่อง แบ่งตามช่วง min <= ค่า < max
      tag: string;
      bins: { label: string; min?: number | null; max?: number | null }[];
    });

export function classLabels(def: ClassDef): string[] {
  const items =
    def.type === "one-hot" ? def.classes : def.type === "value-map" ? def.map : def.bins;
  return Array.from(new Set(items.map((i) => String(i.label))));
}

// tag ที่ definition ใช้แบ่ง class
export function classTagsOf(def: ClassDef): string[] {
  return def.type === "one-hot" ? def.classes.map((c) => c.tag) : [def.tag];
}

// ---- Class usage (เอาไปทำอะไร) ----
export interface ClassUsage {
  defId: string;
  mode: "filter" | "split"; // filter = ใช้เฉพาะ class ที่เลือก · split = แยกผลตาม class
  include: string[];
}

// ค่าที่ตั้งใน AnalyticsPanel แต่ละช่อง
export interface PanelSettings {
  type?: string;
  tags?: string[];
  xTags?: string[];
  yTags?: string[];
  classUse?: ClassUsage | null;
}

export interface ProjectSettings {
  preset?: RangePreset;
  customStart?: string;
  customEnd?: string;
  interval?: string;
  activeTags?: string[];
  mode?: "chart" | "analytics";
  scaleMode?: "single" | "multiple" | "range";
  panelCount?: number;
  panels?: PanelSettings[];
  chartClass?: ChartClassUsage | null;
}

// class บน chart: shade = แถบสีพื้นหลัง · filter = ซ่อนจุดนอก class ที่เลือก
export interface ChartClassUsage {
  defId: string;
  mode: "shade" | "filter";
  include: string[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  tags: SavedTag[];
  groups: string[];
  classDefs: ClassDef[];
  files?: ProjectFile[];
  settings: ProjectSettings;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  tagCount: number;
}

export interface TrashedProject {
  id: string;
  name: string;
  deletedAt: string;
  purgeAt: string;
  file: string;
}
