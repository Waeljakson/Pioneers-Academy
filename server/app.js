import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { z } from "zod";
import QRCode from "qrcode";
import { query } from "./db.js";
import { token, digest, hashPassword, checkPassword } from "./security.js";
import { catalog, roles, allowed, parseFields } from "./catalog.js";

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const uuid = (value) => z.uuid().parse(value);
export function createApp(
  db,
  { origin = "http://localhost:5173", production = false, staticDir } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "upgrade-insecure-requests": production ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "64kb" }), cookieParser());
  app.use("/api", (_, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") !== origin
    )
      return res.status(403).json({ error: "مصدر الطلب غير مسموح" });
    next();
  });
  const cookie = {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  };
  const audit = (tx, user, action, entity, id) =>
    query(
      tx,
      "INSERT INTO audit_logs(user_id,action,entity,record_id) VALUES($1,$2,$3,$4)",
      [user.id, action, entity, id],
    );
  app.post("/api/login", async (req, res) => {
    const { email, password } = z
      .object({
        email: z
          .email()
          .max(254)
          .transform((x) => x.toLowerCase()),
        password: z.string().min(1).max(128),
      })
      .parse(req.body);
    const key = digest(email);
    const [rate] = await query(
      db,
      `INSERT INTO login_limits(key,attempts,reset_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_limits.reset_at<now() THEN 1 ELSE login_limits.attempts+1 END,reset_at=CASE WHEN login_limits.reset_at<now() THEN now()+interval '15 minutes' ELSE login_limits.reset_at END RETURNING attempts`,
      [key],
    );
    if (rate.attempts > 10) fail(429, "محاولات كثيرة. حاول بعد 15 دقيقة");
    const [user] = await query(
      db,
      "SELECT * FROM users WHERE email=$1 AND active=true",
      [email],
    );
    // Use scrypt even for a nonexistent account to reduce timing differences.
    const valid = await checkPassword(
      password,
      user?.password_hash ?? `${"0".repeat(32)}:${"0".repeat(128)}`,
    );
    if (!user || !valid) fail(401, "البريد أو كلمة المرور غير صحيحة");
    const raw = token();
    await db.transaction(async (tx) => {
      await query(
        tx,
        "DELETE FROM sessions WHERE expires_at<now() OR token_hash=$1",
        [digest(req.cookies.pa_session ?? "")],
      );
      await query(
        tx,
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
        [digest(raw), user.id],
      );
      await query(tx, "DELETE FROM login_limits WHERE key=$1", [key]);
    });
    res.cookie("pa_session", raw, cookie).json({ ok: true });
  });
  app.get("/api/verify/:code", async (req, res) => {
    const [cert] = await query(
      db,
      `SELECT c.code,c.issued_at,c.revoked,u.name,p.name AS program,t.name AS type FROM certificates c JOIN enrollments e ON e.id=c.enrollment_id JOIN students s ON s.id=e.student_id JOIN users u ON u.id=s.user_id JOIN programs p ON p.id=e.program_id JOIN program_types t ON t.id=p.type_id WHERE c.code=$1`,
      [uuid(req.params.code)],
    );
    if (!cert) fail(404, "الشهادة غير موجودة");
    res.json(cert);
  });
  app.use("/api", async (req, res, next) => {
    const [user] = await query(
      db,
      `SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true`,
      [digest(req.cookies.pa_session ?? "")],
    );
    if (!user) fail(401, "يرجى تسجيل الدخول");
    req.user = user;
    next();
  });
  app.get("/api/me", (req, res) =>
    res.json({ ...req.user, roleLabel: roles[req.user.role] }),
  );
  app.post("/api/logout", async (req, res) => {
    await query(db, "DELETE FROM sessions WHERE token_hash=$1", [
      digest(req.cookies.pa_session ?? ""),
    ]);
    res
      .clearCookie("pa_session", { ...cookie, maxAge: undefined })
      .json({ ok: true });
  });
  app.post("/api/password", async (req, res) => {
    const data = z
      .object({
        current: z.string().min(1).max(128),
        password: z.string().min(12).max(128),
      })
      .parse(req.body);
    const [u] = await query(db, "SELECT password_hash FROM users WHERE id=$1", [
      req.user.id,
    ]);
    if (!(await checkPassword(data.current, u.password_hash)))
      fail(400, "كلمة المرور الحالية غير صحيحة");
    const hash = await hashPassword(data.password);
    await db.transaction(async (tx) => {
      await query(tx, "UPDATE users SET password_hash=$1 WHERE id=$2", [
        hash,
        req.user.id,
      ]);
      await query(tx, "DELETE FROM sessions WHERE user_id=$1", [req.user.id]);
    });
    res.clearCookie("pa_session").json({ ok: true });
  });
  app.get("/api/catalog", (req, res) =>
    res.json(
      Object.fromEntries(
        Object.entries(catalog)
          .filter(([key]) => allowed(req.user.role, key))
          .map(([key, c]) => [
            key,
            {
              ...c,
              readonly: c.readonly || !allowed(req.user.role, key, true),
            },
          ]),
      ),
    ),
  );
  async function rowsFor(key, user) {
    if (key === "users")
      return query(
        db,
        "SELECT id,name,email,role,active FROM users ORDER BY created_at DESC",
      );
    if (key === "students" || key === "lecturers") {
      const scope =
        user.role === "lecturer" && key === "students"
          ? ` WHERE EXISTS(SELECT 1 FROM enrollments e JOIN lectures l ON l.cohort_id=e.cohort_id JOIN lecturers t ON t.id=l.lecturer_id WHERE e.student_id=r.id AND t.user_id=$1)`
          : "";
      return query(
        db,
        `SELECT r.*,u.name,u.email FROM ${key} r JOIN users u ON u.id=r.user_id${scope} ORDER BY u.name`,
        scope ? [user.id] : [],
      );
    }
    if (user.role === "lecturer") {
      if (key === "lectures")
        return query(
          db,
          "SELECT l.* FROM lectures l JOIN lecturers t ON t.id=l.lecturer_id WHERE t.user_id=$1 ORDER BY l.starts_at",
          [user.id],
        );
      if (key === "attendance")
        return query(
          db,
          "SELECT a.* FROM attendance a JOIN lectures l ON l.id=a.lecture_id JOIN lecturers t ON t.id=l.lecturer_id WHERE t.user_id=$1",
          [user.id],
        );
    }
    if (key === "enrollments")
      return query(
        db,
        "SELECT e.*,u.name||' — '||p.name||' — '||c.name AS name FROM enrollments e JOIN students s ON s.id=e.student_id JOIN users u ON u.id=s.user_id JOIN programs p ON p.id=e.program_id JOIN cohorts c ON c.id=e.cohort_id ORDER BY u.name",
      );
    if (key === "attempts")
      return query(
        db,
        "SELECT a.id,a.exam_id,a.student_id,a.score,a.submitted_at,e.title,u.name FROM attempts a JOIN exams e ON e.id=a.exam_id JOIN students s ON s.id=a.student_id JOIN users u ON u.id=s.user_id ORDER BY submitted_at DESC",
      );
    if (key === "invoices")
      return query(
        db,
        "SELECT i.*,i.amount-COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) AS balance FROM invoices i ORDER BY due_date",
      );
    return query(db, `SELECT * FROM ${key} ORDER BY id DESC`);
  }
  app.get("/api/data/:entity", async (req, res) => {
    const key = req.params.entity;
    if (!allowed(req.user.role, key)) fail(403, "ليست لديك صلاحية");
    res.json(await rowsFor(key, req.user));
  });
  app.get("/api/dashboard", async (req, res) => {
    if (!["admin", "academic", "finance"].includes(req.user.role))
      fail(403, "ليست لديك صلاحية");
    const [stats] = await query(
      db,
      `SELECT (SELECT count(*) FROM students) AS students,(SELECT count(*) FROM programs WHERE active) AS programs,(SELECT count(*) FROM cohorts) AS cohorts,(SELECT count(*) FROM lecturers) AS lecturers`,
    );
    if (["admin", "finance"].includes(req.user.role)) {
      const [finance] = await query(
        db,
        "SELECT (SELECT COALESCE(sum(amount),0) FROM payments) AS collected,(SELECT COALESCE(sum(amount),0) FROM invoices)-(SELECT COALESCE(sum(amount),0) FROM payments) AS outstanding,(SELECT COALESCE(sum(amount),0) FROM expenses) AS expenses",
      );
      Object.assign(stats, finance);
    }
    const next = await query(
      db,
      "SELECT l.title,l.starts_at,l.location,c.name AS cohort FROM lectures l JOIN cohorts c ON c.id=l.cohort_id WHERE l.ends_at>=now() ORDER BY starts_at LIMIT 5",
    );
    res.json({ stats, next });
  });
  async function validateRecord(tx, key, data, user, id) {
    if (key === "users" && id === user.id && data.active === false)
      fail(400, "لا يمكن تعطيل حسابك الحالي");
    if (key === "cohorts" && data.end_date < data.start_date)
      fail(400, "تاريخ النهاية يسبق البداية");
    if (key === "lectures" && data.ends_at <= data.starts_at)
      fail(400, "وقت النهاية يجب أن يلي البداية");
    if (key === "enrollments" && !id) {
      const [s] = await query(
        tx,
        "SELECT id FROM students WHERE id=$1 AND admission='accepted'",
        [data.student_id],
      );
      if (!s) fail(400, "يجب قبول الطالب أولاً");
    }
    if (key === "attendance") {
      const [r] = await query(
        tx,
        `SELECT l.id,t.user_id FROM lectures l JOIN lecturers t ON t.id=l.lecturer_id JOIN enrollments e ON e.cohort_id=l.cohort_id WHERE l.id=$1 AND e.student_id=$2 AND e.status IN ('active','completed')`,
        [data.lecture_id, data.student_id],
      );
      if (!r || (user.role === "lecturer" && r.user_id !== user.id))
        fail(403, "الطالب غير مسجل في المحاضرة أو المحاضرة ليست لك");
    }
    if (key === "exams") {
      if (!id && data.published)
        fail(400, "احفظ الاختبار كمسودة وأضف أسئلته قبل النشر");
      if (id) {
        const [a] = await query(
          tx,
          "SELECT id FROM attempts WHERE exam_id=$1 LIMIT 1",
          [id],
        );
        if (a) fail(400, "لا يمكن تعديل اختبار له محاولات");
        if (data.published) {
          const [q] = await query(
            tx,
            "SELECT id FROM questions WHERE exam_id=$1 LIMIT 1",
            [id],
          );
          if (!q) fail(400, "أضف سؤالاً واحداً على الأقل قبل النشر");
        }
      }
    }
    if (key === "questions") {
      const [e] = await query(
        tx,
        "SELECT published FROM exams WHERE id=$1 FOR UPDATE",
        [data.exam_id],
      );
      if (!e || e.published)
        fail(400, "يمكن تعديل أسئلة الاختبارات غير المنشورة فقط");
    }
    if (key === "payments") {
      const [inv] = await query(
        tx,
        "SELECT amount FROM invoices WHERE id=$1 FOR UPDATE",
        [data.invoice_id],
      );
      if (!inv) fail(400, "الفاتورة غير موجودة");
      const [paid] = await query(
        tx,
        "SELECT COALESCE(sum(amount),0) AS total FROM payments WHERE invoice_id=$1",
        [data.invoice_id],
      );
      if (
        Math.round(Number(paid.total) * 100) + Math.round(data.amount * 100) >
        Math.round(Number(inv.amount) * 100)
      )
        fail(400, "المبلغ يتجاوز الرصيد المتبقي");
    }
    if (key === "certificates" && !id) {
      const [e] = await query(
        tx,
        "SELECT id FROM enrollments WHERE id=$1 AND status='completed' AND progress=100 FOR UPDATE",
        [data.enrollment_id],
      );
      if (!e) fail(400, "إصدار الشهادة يتطلب تسجيلاً مكتملاً بنسبة 100%");
    }
  }
  app.post("/api/data/:entity", async (req, res) => {
    const key = req.params.entity,
      c = catalog[key];
    if (!allowed(req.user.role, key, true) || c.readonly)
      fail(403, "ليست لديك صلاحية");
    const data = parseFields(key, req.body);
    let result;
    await db.transaction(async (tx) => {
      await validateRecord(tx, key, data, req.user);
      if (c.accountRole || key === "users") {
        const [user] = await query(
          tx,
          "INSERT INTO users(name,email,password_hash,role,active) VALUES($1,$2,$3,$4,$5) RETURNING id",
          [
            data.name,
            data.email,
            await hashPassword(data.password),
            c.accountRole ?? data.role,
            data.active ?? true,
          ],
        );
        if (c.accountRole) {
          delete data.name;
          delete data.email;
          delete data.password;
          data.user_id = user.id;
        } else result = user;
      }
      if (!result) {
        const keys = Object.keys(data);
        const values = keys.map((k) =>
          k === "options" ? JSON.stringify(data[k]) : data[k],
        );
        [result] = await query(
          tx,
          `INSERT INTO ${key}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`,
          values,
        );
      }
      await audit(tx, req.user, "create", key, result.id);
    });
    res.status(201).json(result);
  });
  app.patch("/api/data/:entity/:id", async (req, res) => {
    const key = req.params.entity,
      c = catalog[key],
      id = uuid(req.params.id);
    if (!allowed(req.user.role, key, true) || !c.edit?.length)
      fail(403, "التعديل غير متاح");
    const data = parseFields(key, req.body, true);
    await db.transaction(async (tx) => {
      const [old] = await query(
        tx,
        `SELECT * FROM ${key} WHERE id=$1 FOR UPDATE`,
        [id],
      );
      if (!old) fail(404, "السجل غير موجود");
      await validateRecord(tx, key, { ...old, ...data }, req.user, id);
      const keys = Object.keys(data);
      await query(
        tx,
        `UPDATE ${key} SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(",")} WHERE id=$${keys.length + 1}`,
        [
          ...keys.map((k) =>
            k === "options" ? JSON.stringify(data[k]) : data[k],
          ),
          id,
        ],
      );
      if (key === "users" && data.active === false)
        await query(tx, "DELETE FROM sessions WHERE user_id=$1", [id]);
      await audit(tx, req.user, "update", key, id);
    });
    res.json({ ok: true });
  });
  async function studentFor(user) {
    if (user.role !== "student") fail(403, "هذه بوابة الطالب");
    const [s] = await query(db, "SELECT * FROM students WHERE user_id=$1", [
      user.id,
    ]);
    if (!s) fail(404, "ملف الطالب غير موجود");
    return s;
  }
  app.get("/api/portal", async (req, res) => {
    const student = await studentFor(req.user),
      sid = student.id;
    const enrollments = await query(
      db,
      "SELECT e.*,p.name AS program,c.name AS cohort FROM enrollments e JOIN programs p ON p.id=e.program_id JOIN cohorts c ON c.id=e.cohort_id WHERE e.student_id=$1",
      [sid],
    );
    const lectures = await query(
      db,
      "SELECT l.*,c.name AS course FROM lectures l JOIN courses c ON c.id=l.course_id WHERE EXISTS(SELECT 1 FROM enrollments e WHERE e.cohort_id=l.cohort_id AND e.student_id=$1 AND e.status IN ('active','completed')) ORDER BY starts_at",
      [sid],
    );
    const attendance = await query(
      db,
      "SELECT a.status,l.title,l.starts_at FROM attendance a JOIN lectures l ON l.id=a.lecture_id WHERE a.student_id=$1 ORDER BY l.starts_at DESC",
      [sid],
    );
    const exams = await query(
      db,
      "SELECT x.id,x.title,x.pass_percent,a.score,EXISTS(SELECT 1 FROM enrollments e WHERE e.cohort_id=x.cohort_id AND e.student_id=$1 AND e.status='active') AS can_take FROM exams x LEFT JOIN attempts a ON a.exam_id=x.id AND a.student_id=$1 WHERE (x.published OR a.id IS NOT NULL) AND (a.id IS NOT NULL OR EXISTS(SELECT 1 FROM enrollments e WHERE e.cohort_id=x.cohort_id AND e.student_id=$1 AND e.status IN ('active','completed')))",
      [sid],
    );
    const invoices = await query(
      db,
      "SELECT i.*,i.amount-COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) AS balance FROM invoices i WHERE student_id=$1 ORDER BY due_date",
      [sid],
    );
    const payments = await query(
      db,
      "SELECT p.* FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.student_id=$1 ORDER BY paid_at DESC",
      [sid],
    );
    const certificates = await query(
      db,
      "SELECT c.*,p.name AS program FROM certificates c JOIN enrollments e ON e.id=c.enrollment_id JOIN programs p ON p.id=e.program_id WHERE e.student_id=$1",
      [sid],
    );
    res.json({
      student,
      enrollments,
      lectures,
      attendance,
      exams,
      invoices,
      payments,
      certificates,
    });
  });
  async function eligible(tx, sid, id) {
    const [exam] = await query(
      tx,
      "SELECT x.* FROM exams x WHERE x.id=$1 AND x.published AND EXISTS(SELECT 1 FROM enrollments e WHERE e.cohort_id=x.cohort_id AND e.student_id=$2 AND e.status='active') FOR UPDATE",
      [id, sid],
    );
    if (!exam) fail(403, "الاختبار غير متاح لك");
    return exam;
  }
  app.get("/api/exams/:id", async (req, res) => {
    const s = await studentFor(req.user),
      id = uuid(req.params.id);
    await eligible(db, s.id, id);
    res.json(
      await query(
        db,
        "SELECT id,prompt,options FROM questions WHERE exam_id=$1 ORDER BY id",
        [id],
      ),
    );
  });
  app.post("/api/exams/:id/submit", async (req, res) => {
    const s = await studentFor(req.user),
      id = uuid(req.params.id),
      answers = z
        .record(z.uuid(), z.number().int().min(0).max(3))
        .parse(req.body.answers);
    let score;
    await db.transaction(async (tx) => {
      await eligible(tx, s.id, id);
      const questions = await query(
        tx,
        "SELECT * FROM questions WHERE exam_id=$1 ORDER BY id",
        [id],
      );
      if (
        !questions.length ||
        questions.length !== Object.keys(answers).length ||
        questions.some((q) => !(q.id in answers))
      )
        fail(400, "أجب عن جميع الأسئلة");
      score =
        Math.round(
          (10000 *
            questions.filter((q) => q.correct_index === answers[q.id]).length) /
            questions.length,
        ) / 100;
      await query(
        tx,
        "INSERT INTO attempts(exam_id,student_id,answers,score) VALUES($1,$2,$3,$4)",
        [id, s.id, JSON.stringify(answers), score],
      );
      await audit(tx, req.user, "submit", "exams", id);
    });
    res.json({ score });
  });
  app.get("/api/certificates/:code/qr", async (req, res) => {
    const code = uuid(req.params.code);
    const [cert] = await query(
      db,
      "SELECT s.user_id FROM certificates c JOIN enrollments e ON e.id=c.enrollment_id JOIN students s ON s.id=e.student_id WHERE c.code=$1",
      [code],
    );
    if (
      !cert ||
      (!["admin", "academic"].includes(req.user.role) &&
        cert.user_id !== req.user.id)
    )
      fail(403, "ليست لديك صلاحية");
    const data = await QRCode.toDataURL(`${origin}/verify/${code}`, {
      width: 240,
      margin: 2,
      color: { dark: "#06162d", light: "#ffffff" },
    });
    res.json({ data });
  });
  app.use("/api", (_, res) =>
    res.status(404).json({ error: "المسار غير موجود" }),
  );
  app.get("/pioneers-logo.png", (_, res) =>
    res.sendFile(fileURLToPath(new URL("../pioneers-logo.png", import.meta.url))),
  );
  if (staticDir) {
    app.use(express.static(staticDir));
    app.get("/{*path}", (_, res) =>
      res.sendFile("index.html", { root: staticDir }),
    );
  }
  app.use((err, req, res, next) => {
    const code = err.code ?? err.cause?.code;
    if (err instanceof z.ZodError || err.message === "VALIDATION")
      return res
        .status(400)
        .json({ error: "تحقق من البيانات المطلوبة والقيم المدخلة" });
    if (code === "23505")
      return res
        .status(409)
        .json({ error: "السجل موجود بالفعل، أو تم تسليم الاختبار سابقًا" });
    if (["23503", "23514", "22P02"].includes(code))
      return res
        .status(400)
        .json({ error: "القيم أو الروابط بين السجلات غير صحيحة" });
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Request failed", {
      path: req.path,
      code: code ?? "INTERNAL",
    });
    res.status(500).json({ error: "تعذر تنفيذ الطلب. راجع إعداد الخادم" });
  });
  return app;
}
