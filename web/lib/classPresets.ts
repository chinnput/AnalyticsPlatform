import type { ClassDef } from "./types";

// preset ที่เลือกได้ในทุก project — เลือกแล้วจะถูก copy เข้า project.classDefs
export const CLASS_PRESETS: ClassDef[] = [
  {
    // Digester Rule v1 — docs/digester-rule.md
    id: "press1-digester",
    name: "Press 1 Digester (B1–B4)",
    type: "one-hot",
    noneLabel: "D0",
    classes: [1, 2, 3, 4].map((k) => ({
      label: `D${k}`,
      tag: `PPPC_DP_Cooking.B${k}_Discharge_FinalTime_Press1_Status`,
      activeValue: k,
    })),
  },
];
