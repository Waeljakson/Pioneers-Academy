import { z } from "zod";
const f = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
const ref = (key, label, source, optional = false) =>
  f(key, label, "select", { source, optional });
const opt = (key, label, options) => f(key, label, "select", { options });
export const roles = {
  admin: "الإدارة",
  academic: "الشؤون الأكاديمية",
  lecturer: "المحاضر",
  student: "الطالب",
  finance: "المالية",
};
export const catalog = {
  program_types: {
    label: "أنواع البرامج",
    fields: [f("name", "اسم النوع")],
    edit: ["name"],
  },
  programs: {
    label: "البرامج",
    fields: [
      f("name", "اسم البرنامج"),
      ref("type_id", "نوع البرنامج", "program_types"),
      f("description", "الوصف", "textarea"),
      f("duration_months", "المدة بالشهور", "number", { min: 1, max: 120 }),
      f("fee", "الرسوم", "number", { min: 0 }),
      f("active", "متاح", "checkbox"),
    ],
    edit: ["name", "description", "fee", "active", "duration_months"],
  },
  specialties: {
    label: "التخصصات",
    fields: [f("name", "التخصص"), ref("program_id", "البرنامج", "programs")],
    edit: ["name"],
  },
  cohorts: {
    label: "الدفعات",
    fields: [
      f("name", "اسم الدفعة"),
      ref("program_id", "البرنامج", "programs"),
      f("start_date", "البداية", "date"),
      f("end_date", "النهاية", "date"),
    ],
    edit: ["name", "start_date", "end_date"],
  },
  students: {
    label: "الطلاب",
    accountRole: "student",
    fields: [
      f("name", "اسم الطالب"),
      f("email", "البريد", "email"),
      f("password", "كلمة المرور الأولية", "password"),
      f("phone", "الهاتف"),
      opt("admission", "حالة القبول", {
        pending: "قيد المراجعة",
        accepted: "مقبول",
        rejected: "مرفوض",
      }),
    ],
    edit: ["phone", "admission"],
  },
  lecturers: {
    label: "المحاضرون",
    accountRole: "lecturer",
    fields: [
      f("name", "اسم المحاضر"),
      f("email", "البريد", "email"),
      f("password", "كلمة المرور الأولية", "password"),
      f("expertise", "التخصص العلمي"),
    ],
    edit: ["expertise"],
  },
  enrollments: {
    label: "التسجيلات",
    fields: [
      ref("student_id", "الطالب", "students"),
      ref("program_id", "البرنامج", "programs"),
      ref("cohort_id", "الدفعة", "cohorts"),
      ref("specialty_id", "التخصص", "specialties", true),
      f("progress", "الإنجاز %", "number", { min: 0, max: 100 }),
      opt("status", "الحالة", {
        active: "نشط",
        completed: "مكتمل",
        withdrawn: "منسحب",
      }),
    ],
    edit: ["progress", "status"],
  },
  courses: {
    label: "المقررات",
    fields: [
      f("name", "اسم المقرر"),
      ref("program_id", "البرنامج", "programs"),
    ],
    edit: ["name"],
  },
  lectures: {
    label: "الجداول",
    fields: [
      f("title", "عنوان المحاضرة"),
      ref("program_id", "البرنامج", "programs"),
      ref("course_id", "المقرر", "courses"),
      ref("cohort_id", "الدفعة", "cohorts"),
      ref("lecturer_id", "المحاضر", "lecturers"),
      f("starts_at", "البدء", "datetime-local"),
      f("ends_at", "الانتهاء", "datetime-local"),
      f("location", "المكان / رابط الاجتماع"),
    ],
    edit: ["title", "starts_at", "ends_at", "location"],
  },
  attendance: {
    label: "الحضور",
    fields: [
      ref("lecture_id", "المحاضرة", "lectures"),
      ref("student_id", "الطالب", "students"),
      opt("status", "الحالة", {
        present: "حاضر",
        absent: "غائب",
        excused: "بعذر",
      }),
    ],
    edit: ["status"],
  },
  exams: {
    label: "الاختبارات",
    fields: [
      f("title", "الاختبار"),
      ref("cohort_id", "الدفعة", "cohorts"),
      f("pass_percent", "نسبة النجاح", "number", { min: 0, max: 100 }),
      f("published", "منشور للطلاب", "checkbox"),
    ],
    edit: ["title", "pass_percent", "published"],
  },
  questions: {
    label: "بنك الأسئلة",
    fields: [
      ref("exam_id", "الاختبار", "exams"),
      f("prompt", "السؤال", "textarea"),
      f("options", "أربعة اختيارات، كل اختيار في سطر", "options"),
      opt("correct_index", "الإجابة الصحيحة", {
        0: "الأولى",
        1: "الثانية",
        2: "الثالثة",
        3: "الرابعة",
      }),
    ],
    edit: ["prompt", "options", "correct_index"],
  },
  attempts: { label: "النتائج", readonly: true, fields: [] },
  invoices: {
    label: "الرسوم والأقساط",
    finance: true,
    fields: [
      ref("student_id", "الطالب", "students"),
      f("title", "البند / القسط"),
      f("amount", "المبلغ", "number", { min: 0.01 }),
      f("due_date", "تاريخ الاستحقاق", "date"),
    ],
    edit: [],
  },
  payments: {
    label: "المدفوعات",
    finance: true,
    fields: [
      ref("invoice_id", "الفاتورة", "invoices"),
      f("amount", "المبلغ", "number", { min: 0.01 }),
      f("reference", "مرجع الدفع الفريد"),
    ],
    edit: [],
  },
  expenses: {
    label: "المصروفات",
    finance: true,
    fields: [
      f("title", "المصروف"),
      f("amount", "المبلغ", "number", { min: 0.01 }),
      f("spent_on", "التاريخ", "date"),
    ],
    edit: [],
  },
  certificates: {
    label: "الشهادات",
    fields: [
      ref("enrollment_id", "التسجيل المكتمل", "enrollments"),
      f("revoked", "ملغاة", "checkbox"),
    ],
    edit: ["revoked"],
  },
  users: {
    label: "المستخدمون والصلاحيات",
    admin: true,
    fields: [
      f("name", "الاسم"),
      f("email", "البريد", "email"),
      f("password", "كلمة المرور الأولية", "password"),
      opt("role", "الصلاحية", {
        admin: roles.admin,
        academic: roles.academic,
        finance: roles.finance,
      }),
      f("active", "نشط", "checkbox"),
    ],
    edit: ["active"],
  },
};
export function allowed(role, key, write = false) {
  const c = catalog[key];
  if (!c) return false;
  if (role === "admin") return true;
  if (c.admin) return false;
  if (role === "academic") return !c.finance;
  if (role === "finance") return !!c.finance || (!write && key === "students");
  if (role === "lecturer")
    return write
      ? key === "attendance"
      : ["lectures", "attendance", "students"].includes(key);
  return false;
}
export function parseFields(key, body, updating = false) {
  const c = catalog[key],
    shape = {};
  for (const field of c.fields) {
    if (updating && !c.edit.includes(field.key)) continue;
    let v;
    if (field.type === "checkbox") v = z.boolean();
    else if (field.type === "number")
      v = z.coerce
        .number()
        .finite()
        .min(field.min ?? 0)
        .max(field.max ?? 9999999999.99)
        .refine(
          (x) =>
            Number.isInteger(x * 100 + 0.000001) ||
            Math.abs(x * 100 - Math.round(x * 100)) < 0.00001,
          "حد أقصى منزلتان عشريتان",
        );
    else if (field.source) v = z.uuid();
    else if (field.options) v = z.enum(Object.keys(field.options));
    else if (field.type === "email")
      v = z
        .email()
        .max(254)
        .transform((x) => x.toLowerCase().trim());
    else if (field.type === "password") v = z.string().min(12).max(128);
    else if (field.type === "options")
      v = z.array(z.string().trim().min(1).max(500)).length(4);
    else if (field.type === "date")
      v = z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .refine(
          (x) =>
            !isNaN(Date.parse(x)) &&
            new Date(x).toISOString().slice(0, 10) === x,
        );
    else if (field.type === "datetime-local")
      v = z
        .string()
        .refine((x) => !isNaN(Date.parse(x)))
        .transform((x) => new Date(x).toISOString());
    else
      v = z
        .string()
        .trim()
        .min(
          ["phone", "description", "location", "expertise"].includes(field.key)
            ? 0
            : 1,
        )
        .max(field.type === "textarea" ? 4000 : 160);
    if (field.optional) v = v.nullable();
    shape[field.key] = v;
  }
  const value = z.object(shape).strict().parse(body);
  if ("correct_index" in value)
    value.correct_index = Number(value.correct_index);
  for (const k of ["progress", "duration_months", "pass_percent"])
    if (k in value && !Number.isInteger(value[k]))
      throw new Error("VALIDATION");
  return value;
}
