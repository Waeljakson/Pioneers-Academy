import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import request from "supertest";
import { migrate } from "../scripts/migrate.js";
import { seed } from "../scripts/seed.js";
import { createApp } from "../server/app.js";
import { query } from "../server/db.js";
const origin = "http://localhost:5173",
  password = "Test-only-password-298!";
let client,
  db,
  app,
  fixtures,
  admin,
  student,
  student2,
  lecturer,
  finance,
  academic;
const post = (agent, path, body) =>
  agent.post(path).set("Origin", origin).send(body);
before(async () => {
  client = new PGlite();
  db = drizzle(client);
  await migrate(db);
  await migrate(db);
  fixtures = await seed(db, {
    email: "admin@example.test",
    password,
    demo: true,
    demoPassword: password,
  });
  app = createApp(db, { origin });
  const login = async (email) => {
    const agent = request.agent(app);
    const r = await post(agent, "/api/login", { email, password });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return agent;
  };
  admin = await login("admin@example.test");
  student = await login("student@example.test");
  student2 = await login("student2@example.test");
  lecturer = await login("lecturer@example.test");
  finance = await login("finance@example.test");
  academic = await login("academic@example.test");
});
after(async () => {
  await client?.close();
});
test("migrations are repeatable; seed cannot overwrite existing data", async () => {
  await assert.rejects(() =>
    seed(db, { email: "admin@example.test", password }),
  );
  assert.equal((await query(db, "SELECT * FROM schema_migrations")).length, 1);
});
test("unauthenticated access and forged origins are blocked", async () => {
  assert.equal((await request(app).get("/api/data/students")).status, 401);
  assert.equal(
    (
      await admin
        .post("/api/data/program_types")
        .set("Origin", "https://evil.test")
        .send({ name: "forged" })
    ).status,
    403,
  );
});
test("permissions: students cannot read staff data or write records; academic cannot access finance", async () => {
  assert.equal((await student.get("/api/data/students")).status, 403);
  assert.equal(
    (await post(student, "/api/data/program_types", { name: "bad" })).status,
    403,
  );
  assert.equal((await academic.get("/api/data/payments")).status, 403);
  assert.equal((await finance.get("/api/data/questions")).status, 403);
});
test("student portal is scoped; question answers and secrets are not exposed", async () => {
  const a = await student.get("/api/portal"),
    b = await student2.get("/api/portal");
  assert.equal(a.body.enrollments.length, 2);
  assert.equal(b.body.enrollments.length, 0);
  assert.equal(b.body.invoices.length, 0);
  const q = await student.get(`/api/exams/${fixtures.exam.id}`);
  assert.equal(q.status, 200);
  assert.ok(q.body.every((x) => !("correct_index" in x)));
  assert.ok(!JSON.stringify(a.body).includes("password_hash"));
  assert.equal(
    (await student2.get(`/api/exams/${fixtures.exam.id}`)).status,
    403,
  );
  const users = await admin.get("/api/data/users");
  assert.ok(users.body.every((x) => !("password_hash" in x)));
});
test("staff can create programs and validate relationships", async () => {
  const types = await admin.get("/api/data/program_types");
  const r = await post(admin, "/api/data/programs", {
    name: "برنامج اختباري",
    type_id: types.body[0].id,
    description: "",
    duration_months: 3,
    fee: 400,
    active: true,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const cohort = await post(admin, "/api/data/cohorts", {
    name: "دفعة اختبار الربط",
    program_id: fixtures.program.id,
    start_date: "2026-01-01",
    end_date: "2027-01-01",
  });
  const bad = await post(admin, "/api/data/enrollments", {
    student_id: fixtures.student.id,
    program_id: r.body.id,
    cohort_id: cohort.body.id,
    specialty_id: null,
    progress: 0,
    status: "active",
  });
  assert.equal(bad.status, 400);
});
test("attendance checks enrollment and lecturer ownership", async () => {
  let r = await post(lecturer, "/api/data/attendance", {
    lecture_id: fixtures.lecture.id,
    student_id: fixtures.student2.id,
    status: "present",
  });
  assert.equal(r.status, 403);
  r = await post(lecturer, "/api/data/attendance", {
    lecture_id: fixtures.lecture.id,
    student_id: fixtures.student.id,
    status: "present",
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const other = await post(admin, "/api/data/lecturers", {
    name: "محاضر ثان",
    email: "other-lecturer@example.test",
    password,
    expertise: "اختبار",
  });
  assert.equal(other.status, 201);
  const agent = request.agent(app);
  await post(agent, "/api/login", {
    email: "other-lecturer@example.test",
    password,
  });
  assert.equal((await agent.get("/api/data/students")).body.length, 0);
  assert.equal(
    (
      await agent
        .patch(`/api/data/attendance/${r.body.id}`)
        .set("Origin", origin)
        .send({ status: "absent" })
    ).status,
    403,
  );
});
test("payments reject overpayment and duplicate references", async () => {
  assert.equal(
    (
      await post(finance, "/api/data/payments", {
        invoice_id: fixtures.invoice.id,
        amount: 1500.01,
        reference: "TEST-OVER",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(finance, "/api/data/payments", {
        invoice_id: fixtures.invoice.id,
        amount: 100,
        reference: "TEST-PAY-1",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await post(finance, "/api/data/payments", {
        invoice_id: fixtures.invoice.id,
        amount: 100,
        reference: "TEST-PAY-1",
      })
    ).status,
    409,
  );
  const rows = await finance.get("/api/data/invoices");
  assert.equal(
    Number(rows.body.find((x) => x.id === fixtures.invoice.id).balance),
    1400,
  );
});
test("server grades exams, rejects incomplete and repeated submissions, freezes published questions", async () => {
  const qs = await query(db, "SELECT * FROM questions WHERE exam_id=$1", [
    fixtures.exam.id,
  ]);
  assert.equal(
    (
      await post(student, "/api/exams/" + fixtures.exam.id + "/submit", {
        answers: {},
      })
    ).status,
    400,
  );
  const answers = Object.fromEntries(qs.map((q) => [q.id, q.correct_index]));
  const r = await post(student, "/api/exams/" + fixtures.exam.id + "/submit", {
    answers,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.score, 100);
  assert.equal(
    (
      await post(student, "/api/exams/" + fixtures.exam.id + "/submit", {
        answers,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await admin
        .patch("/api/data/questions/" + qs[0].id)
        .set("Origin", origin)
        .send({
          prompt: "changed",
          options: ["a", "b", "c", "d"],
          correct_index: "0",
        })
    ).status,
    400,
  );
  assert.equal(
    (
      await admin
        .patch("/api/data/exams/" + fixtures.exam.id)
        .set("Origin", origin)
        .send({ title: "changed", pass_percent: 70, published: true })
    ).status,
    400,
  );
});
test("completed and withdrawn enrollments retain historical results", async () => {
  for (const status of ["completed", "withdrawn"]) {
    await query(db, "UPDATE enrollments SET status=$1 WHERE id=$2", [
      status,
      fixtures.enrollment.id,
    ]);
    const response = await student.get("/api/portal");
    const exam = response.body.exams.find((x) => x.id === fixtures.exam.id);
    assert.equal(Number(exam.score), 100);
    assert.equal(exam.can_take, false);
    assert.equal(
      (await student.get("/api/exams/" + fixtures.exam.id)).status,
      403,
    );
  }
  await query(db, "UPDATE enrollments SET status='active' WHERE id=$1", [
    fixtures.enrollment.id,
  ]);
});
test("certificates require completion; verification is public, minimal and respects revocation", async () => {
  assert.equal(
    (
      await post(admin, "/api/data/certificates", {
        enrollment_id: fixtures.enrollment.id,
        revoked: false,
      })
    ).status,
    400,
  );
  const verified = await request(app).get(
    "/api/verify/" + fixtures.certificate.code,
  );
  assert.equal(verified.status, 200);
  assert.equal(verified.body.revoked, false);
  assert.ok(!("email" in verified.body));
  const qr = await student.get(
    "/api/certificates/" + fixtures.certificate.code + "/qr",
  );
  assert.equal(qr.status, 200);
  assert.ok(qr.body.data.startsWith("data:image/png"));
  assert.equal(
    (
      await student2.get(
        "/api/certificates/" + fixtures.certificate.code + "/qr",
      )
    ).status,
    403,
  );
  await admin
    .patch("/api/data/certificates/" + fixtures.certificate.id)
    .set("Origin", origin)
    .send({ revoked: true });
  assert.equal(
    (await request(app).get("/api/verify/" + fixtures.certificate.code)).body
      .revoked,
    true,
  );
});
test("audit log records writes; administrator cannot deactivate self", async () => {
  assert.ok((await query(db, "SELECT * FROM audit_logs")).length >= 4);
  assert.equal(
    (
      await admin
        .patch("/api/data/users/" + fixtures.admin.id)
        .set("Origin", origin)
        .send({ active: false })
    ).status,
    400,
  );
});
test("login attempts are persisted and throttled", async () => {
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await post(request(app), "/api/login", {
          email: "missing@example.test",
          password: "invalid",
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await post(request(app), "/api/login", {
        email: "missing@example.test",
        password: "invalid",
      })
    ).status,
    429,
  );
});
test("password changes revoke every session", async () => {
  assert.equal(
    (
      await post(student2, "/api/password", {
        current: password,
        password: "Replacement-secret-123!",
      })
    ).status,
    200,
  );
  assert.equal((await student2.get("/api/me")).status, 401);
});
