import { connect, query } from "../server/db.js";
import { hashPassword } from "../server/security.js";
import { pathToFileURL } from "node:url";
export async function seed(
  db,
  { email, password, demo = false, demoPassword } = {},
) {
  if (!email || !password || password.length < 12)
    throw new Error(
      "Set SEED_ADMIN_EMAIL and a password of at least 12 characters",
    );
  if (demo && (!demoPassword || demoPassword.length < 12))
    throw new Error("Set SEED_DEMO_PASSWORD (12+ characters)");
  return db.transaction(async (tx) => {
    await query(tx, "SELECT pg_advisory_xact_lock(728492)");
    const [existing] = await query(tx, "SELECT id FROM users LIMIT 1");
    if (existing)
      throw new Error(
        "Seed only runs on an empty users table to avoid changing existing data",
      );
    const add = async (table, data) => {
      const keys = Object.keys(data);
      const [r] = await query(
        tx,
        `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
        Object.values(data),
      );
      return r;
    };
    const admin = await add("users", {
      name: "مدير الأكاديمية",
      email: email.toLowerCase(),
      password_hash: await hashPassword(password),
      role: "admin",
    });
    const types = [];
    for (const name of [
      "دورة تدريبية",
      "دبلوم مهني",
      "ماجستير مهني",
      "دكتوراه مهنية",
    ])
      types.push(await add("program_types", { name }));
    if (!demo) return { admin };
    const demoHash = await hashPassword(demoPassword);
    const account = (name, email, role) =>
      add("users", { name, email, password_hash: demoHash, role });
    const stu = await account("سارة أحمد", "student@example.test", "student");
    const other = await account("عمر خالد", "student2@example.test", "student");
    const teacher = await account(
      "د. أحمد محمود",
      "lecturer@example.test",
      "lecturer",
    );
    await account("الشؤون الأكاديمية", "academic@example.test", "academic");
    await account("المحاسبة", "finance@example.test", "finance");
    const student = await add("students", {
      user_id: stu.id,
      phone: "",
      admission: "accepted",
    });
    const student2 = await add("students", {
      user_id: other.id,
      phone: "",
      admission: "pending",
    });
    const lecturer = await add("lecturers", {
      user_id: teacher.id,
      expertise: "الإدارة والقيادة",
    });
    const programs = [];
    for (const [i, name] of [
      "أساسيات إدارة المشروعات",
      "إدارة الأعمال",
      "القيادة الاستراتيجية",
      "البحث التطبيقي في الإدارة",
    ].entries())
      programs.push(
        await add("programs", {
          name,
          type_id: types[i].id,
          description: "برنامج مهني لتطوير المعرفة والتطبيق العملي",
          duration_months: [3, 12, 18, 24][i],
          fee: [1500, 6000, 12000, 18000][i],
        }),
      );
    const program = programs[1];
    const specialty = await add("specialties", {
      name: "إدارة المشروعات",
      program_id: program.id,
    });
    const today = new Date(),
      year = today.getUTCFullYear();
    const cohort = await add("cohorts", {
      name: `دفعة الروّاد ${year}`,
      program_id: program.id,
      start_date: `${year}-01-01`,
      end_date: `${year + 1}-12-31`,
    });
    const enrollment = await add("enrollments", {
      student_id: student.id,
      program_id: program.id,
      cohort_id: cohort.id,
      specialty_id: specialty.id,
      progress: 65,
      status: "active",
    });
    const course = await add("courses", {
      name: "التخطيط الاستراتيجي",
      program_id: program.id,
    });
    const start = new Date(today.getTime() + 86400000);
    start.setUTCHours(16, 0, 0, 0);
    const lecture = await add("lectures", {
      title: "من الفكرة إلى خطة العمل",
      program_id: program.id,
      course_id: course.id,
      cohort_id: cohort.id,
      lecturer_id: lecturer.id,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 7200000).toISOString(),
      location: "القاعة الافتراضية — رابط يحدده المحاضر",
    });
    const previous = await add("lectures", {
      title: "مقدمة في الإدارة الحديثة",
      program_id: program.id,
      course_id: course.id,
      cohort_id: cohort.id,
      lecturer_id: lecturer.id,
      starts_at: new Date(today.getTime() - 172800000).toISOString(),
      ends_at: new Date(today.getTime() - 169200000).toISOString(),
      location: "القاعة 01",
    });
    await add("attendance", {
      lecture_id: previous.id,
      student_id: student.id,
      status: "present",
    });
    const exam = await add("exams", {
      title: "مبادئ التخطيط الاستراتيجي",
      cohort_id: cohort.id,
      pass_percent: 60,
      published: true,
    });
    await add("questions", {
      exam_id: exam.id,
      prompt: "ما الخطوة الأولى في التخطيط الاستراتيجي؟",
      options: JSON.stringify([
        "تحليل الوضع الحالي",
        "توزيع الأرباح",
        "إغلاق المشروع",
        "شراء المعدات",
      ]),
      correct_index: 0,
    });
    await add("questions", {
      exam_id: exam.id,
      prompt: "ماذا يعبّر عنه مؤشر الأداء؟",
      options: JSON.stringify([
        "لون العلامة",
        "مدى التقدم نحو الهدف",
        "عدد المكاتب فقط",
        "اسم المؤسسة",
      ]),
      correct_index: 1,
    });
    const invoice = await add("invoices", {
      student_id: student.id,
      title: "القسط الأول — دبلوم إدارة الأعمال",
      amount: 3000,
      due_date: start.toISOString().slice(0, 10),
    });
    await add("payments", {
      invoice_id: invoice.id,
      amount: 1500,
      reference: "DEMO-RECEIPT-001",
    });
    await add("expenses", {
      title: "إعداد المادة التدريبية",
      amount: 450,
      spent_on: today.toISOString().slice(0, 10),
    });
    const shortCohort = await add("cohorts", {
      name: "دفعة المهارات المهنية",
      program_id: programs[0].id,
      start_date: `${year}-01-01`,
      end_date: `${year}-03-31`,
    });
    const completed = await add("enrollments", {
      student_id: student.id,
      program_id: programs[0].id,
      cohort_id: shortCohort.id,
      progress: 100,
      status: "completed",
    });
    const certificate = await add("certificates", {
      enrollment_id: completed.id,
      revoked: false,
    });
    return {
      admin,
      student,
      student2,
      lecturer,
      program,
      cohort,
      enrollment,
      lecture,
      exam,
      invoice,
      certificate,
    };
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { db, close } = connect(process.env.DATABASE_URL_DIRECT);
  try {
    await seed(db, {
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
      demo: process.env.SEED_DEMO === "true",
      demoPassword: process.env.SEED_DEMO_PASSWORD,
    });
    console.log("Seed completed. No passwords printed.");
  } finally {
    await close();
  }
}
