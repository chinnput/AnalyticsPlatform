# Copilot Instructions — Analytics Platform

กฎการทำงานร่วมกันในโปรเจกต์นี้ ปฏิบัติตามอย่างเคร่งครัด

---

## 1. ภาษา (Language)
- ตอบเป็น **ไทยผสมอังกฤษ** (technical terms เป็นอังกฤษได้: tag, schema, migrate, connector ฯลฯ)
- อธิบายให้เข้าใจง่าย ผู้ใช้ยังใหม่กับ backend/database

---

## 2. ต้องสรุป + ขอ approve ก่อนทำ (STOP and ASK)

ก่อนทำ action เหล่านี้ **ต้องสรุปสิ่งที่จะทำ แล้วหยุดรอ approve เสมอ**:

- ✋ แก้ไข / สร้างไฟล์ code
- ✋ รันคำสั่ง terminal (ที่เปลี่ยนแปลงอะไร)
- ✋ แตะ database — สร้าง / ลบ / migrate / เปลี่ยน schema
- ✋ git commit / push
- ✋ ติดตั้ง package / dependency

**รูปแบบการขอ approve:**
1. สรุปสั้นๆ ว่าจะทำอะไร ทำไม กระทบอะไรบ้าง
2. ถ้าเป็นไฟล์ — บอกชื่อไฟล์ + สาระที่จะเปลี่ยน
3. ถาม "approve ไหม?" แล้ว **หยุดรอ** อย่าเพิ่งลงมือ

> ทำทีละ action ไม่รวบหลายอย่างใน approve เดียวโดยไม่บอก

---

## 3. ทำได้เลย ไม่ต้องขอ approve (auto-allowed)

- ✅ อ่านไฟล์ / ค้นหา code (read_file, grep, list_dir)
- ✅ รันคำสั่ง read-only (git status, git log, list, test connection แบบไม่แก้ข้อมูล)
- ✅ อธิบาย / วางแผน / ตอบคำถาม (ไม่แตะไฟล์)

---

## 4. ห้ามทำเด็ดขาด (NEVER)

- ❌ **ห้ามแตะ database `analytics_platform` (ตัวเดิม) หรือ database อื่นที่ไม่ใช่ของโปรเจกต์เรา** — อาจเป็นของคนอื่น
- ❌ ห้ามลบ / drop database, table, schema โดยไม่ได้ approve ชัดเจน
- ❌ ห้าม `git push --force`, `git reset --hard`, ลบ branch โดยไม่ถาม
- ❌ ห้ามเขียน credential / password / token จริง ลงในไฟล์ code หรือ commit
- ❌ ห้ามขอให้ผู้ใช้พิมพ์ password/secret ในช่องแชท — ให้พิมพ์ในเทอร์มินัลเองเสมอ
- ❌ ห้ามแก้ข้อมูลใน data source ต้นทาง (SQL/PI) — ระบบนี้ **read-only** ต่อ source

---

## 5. Data storage (ไม่มี DB ของเราเอง)

- **ไม่มี database ของเราเอง** — ตัด PostgreSQL/Prisma ออกแล้ว
- ข้อมูล time-series ดึงจาก **SQL Server ต้นทาง** (read-only) ที่ผู้ใช้มีอยู่แล้ว
- metadata (layout/group/workspace) เก็บเป็น **ไฟล์ JSON** ที่ `web/data/` (gitignored)
- ถ้าอนาคตต้องใช้หลายคน/หลายเครื่อง ค่อยเพิ่ม DB ทีหลังได้

---

## 6. Architecture & Scope (V1)

- อ้างอิงแผนใน [summary.md](../summary.md) และ [docs/](../docs/)
- **V1: ไม่เก็บ time-series ซ้ำ** — ดึงจาก source มา plot/วิเคราะห์แล้วจบ
- metadata (tags, groups, workspace layout) เก็บเป็น **ไฟล์ JSON** ในเครื่อง
- Connector Layer อยู่ฝั่ง **Python FastAPI** (SQL Server ก่อน, PI ทีหลัง)
- UX: ยืม pattern จาก TradingView (chart สวย, หยิบง่าย) **ไม่ต้องเลียนแบบเป๊ะ**
- ทุกอย่าง open-source รัน local **ไม่มีค่าใช้จ่าย**

---

## 7. Coding style

- แก้เท่าที่จำเป็น ไม่ over-engineer, ไม่เพิ่ม feature เกินที่ขอ
- ไม่สร้างไฟล์ .md อธิบายการเปลี่ยนแปลง เว้นแต่ผู้ใช้ขอ
- comment เท่าที่จำเป็น สั้น กระชับ

---

## 8. Workflow ทำงานเป็น Phase

- ทำตาม [docs/roadmap-steps.md](../docs/roadmap-steps.md) ทีละ Phase
- update [docs/tasks-checklist.md](../docs/tasks-checklist.md) เมื่อทำเสร็จ
- จบแต่ละ action → สรุปผล + ถามว่าจะไปต่ออะไร
