import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  Users,
  CalendarDays,
  Wallet,
  FileBadge,
  LogOut,
  Menu,
  Plus,
  Search,
  ArrowUpLeft,
  CheckCircle2,
  ShieldCheck,
  ClipboardList,
  ChevronLeft,
  Settings,
  X,
} from "lucide-react";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import { api, money, date, datetime } from "./api";
import "./styles.css";
const icons = {
  programs: BookOpen,
  students: Users,
  lecturers: GraduationCap,
  lectures: CalendarDays,
  invoices: Wallet,
  certificates: FileBadge,
};
const translations = {
  pending: "قيد المراجعة",
  accepted: "مقبول",
  rejected: "مرفوض",
  active: "نشط",
  completed: "مكتمل",
  withdrawn: "منسحب",
  present: "حاضر",
  absent: "غائب",
  excused: "بعذر",
  admin: "إدارة",
  academic: "شؤون أكاديمية",
  lecturer: "محاضر",
  student: "طالب",
  finance: "مالية",
};
const labelKeys = {
  academic_number: "الرقم الأكاديمي",
  score: "النتيجة %",
  submitted_at: "تاريخ التسليم",
  balance: "المتبقي",
  reference: "مرجع الإيصال",
  paid_at: "تاريخ الدفع",
  issued_at: "تاريخ الإصدار",
  name: "الاسم",
  email: "البريد",
  title: "العنوان",
  code: "رمز التحقق",
};
const Brand = () => (
  <div className="brand">
    <img src="/pioneers-logo.png" alt="Pioneers Academy" className="brand-logo" />
    <div className="brand-copy">
      <b>Pioneers <i>Academy</i></b>
      <small>A ROAD TO SUPPORT</small>
    </div>
  </div>
);
function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState("dashboard"),
    [catalog, setCatalog] = useState({}),
    [open, setOpen] = useState(false),
    [fatal, setFatal] = useState("");
  const verify = location.pathname.startsWith("/verify/")
    ? location.pathname.split("/")[2]
    : null;
  async function load() {
    try {
      const u = await api("/me");
      setUser(u);
      setOpen(false);
      setPage("dashboard");
      if (u.role !== "student") {
        setCatalog(await api("/catalog"));
        setPage(u.role === "lecturer" ? "lectures" : "dashboard");
      }
    } catch (e) {
      if (e.status !== 401) setFatal(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!verify) load();
  }, []);
  if (verify) return <Verify code={verify} />;
  if (loading)
    return (
      <div className="loading">
        <Brand />
        <p>نجهّز مساحة التعلّم الخاصة بك…</p>
      </div>
    );
  if (!user) return <Login onLogin={load} fatal={fatal} />;
  const nav = (key) => {
    setPage(key);
    setOpen(false);
  };
  return (
    <div className="shell">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <Brand />
        <div className="workspace-label">مساحتك الأكاديمية</div>
        <nav>
          {user.role === "student" ? (
            <button
              className={page !== "settings" ? "selected" : ""}
              onClick={() => nav("dashboard")}
            >
              <LayoutDashboard size={19} />
              بوابة الطالب
            </button>
          ) : (
            <>
              {user.role !== "lecturer" && (
                <button
                  className={page === "dashboard" ? "selected" : ""}
                  onClick={() => nav("dashboard")}
                >
                  <LayoutDashboard size={19} />
                  نظرة عامة
                </button>
              )}
              {Object.entries(catalog).map(([key, c]) => {
                const Icon = icons[key] ?? ClipboardList;
                return (
                  <button
                    className={page === key ? "selected" : ""}
                    key={key}
                    onClick={() => nav(key)}
                  >
                    <Icon size={18} />
                    {c.label}
                  </button>
                );
              })}
            </>
          )}
          <button
            className={page === "settings" ? "selected" : ""}
            onClick={() => nav("settings")}
          >
            <Settings size={18} />
            إعدادات الحساب
          </button>
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">{user.name[0]}</span>
          <div>
            <b>{user.name}</b>
            <small>{user.roleLabel}</small>
          </div>
          <button
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
            onClick={async () => {
              await api("/logout", { method: "POST" });
              setUser(null);
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="overlay"
          aria-label="إغلاق القائمة"
          onClick={() => setOpen(false)}
        />
      )}
      <main>
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              aria-label="فتح القائمة"
              onClick={() => setOpen(!open)}
            >
              <Menu />
            </button>
            <span className="crumb">
              الأكاديمية <ChevronLeft size={14} />{" "}
              {page === "settings"
                ? "إعدادات الحساب"
                : (catalog[page]?.label ??
                  (user.role === "student" ? "بوابة الطالب" : "نظرة عامة"))}
            </span>
          </div>
          <span className="date">{date(new Date())}</span>
          <span className="status-dot">بيئة أكاديمية مستقلة</span>
        </header>
        <div className="content">
          {page === "settings" ? (
            <Account />
          ) : user.role === "student" ? (
            <Portal user={user} />
          ) : page === "dashboard" ? (
            <Dashboard user={user} navigate={nav} />
          ) : (
            <Entity key={page} entity={page} config={catalog[page]} />
          )}
        </div>
        <footer>
          © {new Date().getFullYear()} Pioneers Academy{" "}
          <span>خطوتك التالية تبدأ هنا.</span>
        </footer>
      </main>
    </div>
  );
}
function Login({ onLogin, fatal }) {
  const [error, setError] = useState(fatal),
    [busy, setBusy] = useState(false);
  return (
    <div className="login premium-login">
      <section className="login-art premium-login-art">
        <div className="login-art-glow" />
        <img src="/pioneers-logo.png" alt="Pioneers Academy" className="login-main-logo" />
        <div className="login-art-copy">
          <span className="eyebrow">PIONEERS ACADEMY</span>
          <h1>تعلّم اليوم.<br /><em>واصنع مستقبلك.</em></h1>
          <p>منصة أكاديمية متكاملة تجمع رحلتك التعليمية والمهنية<br />في مكان واحد.</p>
        </div>
        <div className="login-programs">
          <div><GraduationCap size={25} /><strong>دورات تدريبية</strong><small>تعلم وتطور</small></div>
          <div><FileBadge size={25} /><strong>دبلومات مهنية</strong><small>لبناء مستقبلك</small></div>
          <div><BookOpen size={25} /><strong>ماجستير مهني</strong><small>تخصص أكثر</small></div>
          <div><ShieldCheck size={25} /><strong>دكتوراه مهنية</strong><small>للتميز المهني</small></div>
        </div>
      </section>
      <section className="login-form premium-login-form">
        <div className="login-box premium-login-box">
          <img src="/pioneers-logo.png" alt="Pioneers Academy" className="login-form-logo" />
          <span className="login-welcome">PIONEERS ACADEMY</span>
          <h2>مرحبًا بك في أكاديمية بايونير</h2>
          <p className="muted">منصة متكاملة للدورات المهنية والدبلومات والماجستير والدكتوراه</p>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await api("/login", { method: "POST", body: { email: f.get("email"), password: f.get("password") } });
              await onLogin();
            } catch (x) {
              setError(x.message);
            } finally {
              setBusy(false);
            }
          }}>
            <label>البريد الإلكتروني
              <input name="email" type="email" dir="ltr" placeholder="you@example.com" autoComplete="username" required />
            </label>
            <label>كلمة المرور
              <input name="password" type="password" placeholder="أدخل كلمة المرور" autoComplete="current-password" required />
            </label>
            <ErrorText error={error} />
            <button className="primary wide login-submit" disabled={busy}>
              {busy ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"} <ArrowUpLeft size={18} />
            </button>
          </form>
          <div className="login-note">
            <ShieldCheck size={21} />
            <span>حساب واحد للوصول إلى خدمات الأكاديمية.<br />للحصول على حساب أو استعادته تواصل مع إدارة الأكاديمية.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
function ErrorText({ error }) {
  return error ? (
    <div className="error" role="alert">
      {error}
    </div>
  ) : null;
}
function Dashboard({ user, navigate }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">مساحة النمو والإنجاز</span>
          <h1>
            أهلًا، {user.name.split(" ")[0]} <span className="hello">✦</span>
          </h1>
          <p>كل ما تحتاجه لإدارة رحلة أكاديمية ناجحة، في مكان واحد.</p>
        </div>
        <span className="pill light">
          العام الأكاديمي {new Date().getFullYear()}
        </span>
      </div>
      <ErrorText error={error} />
      <div className="hero">
        <div>
          <span className="eyebrow">PIONEERS ACADEMY</span>
          <h2>
            نصنع فرصًا.
            <br />
            ونبني مستقبلًا.
          </h2>
          <p>
            من أول تسجيل، إلى لحظة التخرّج.
            <br />
            تابع البرامج والطلاب وكل خطوة بينهما.
          </p>
          <button
            onClick={() =>
              navigate(user.role === "finance" ? "invoices" : "programs")
            }
            className="gold"
          >
            {user.role === "finance" ? "متابعة المستحقات" : "استكشف البرامج"}
            <ArrowUpLeft size={18} />
          </button>
        </div>
        <div className="hero-emblem">
          <GraduationCap />
          <span>
            LEARN
            <br />
            <b>GROW</b>
            <br />
            SUCCEED
          </span>
        </div>
      </div>
      {!data ? (
        <p className="muted">جارٍ تحميل المؤشرات…</p>
      ) : (
        <>
          <div className="stats">
            {[
              ["students", "الطلاب المسجلون", Users],
              ["programs", "البرامج المتاحة", BookOpen],
              ["cohorts", "الدفعات الأكاديمية", CalendarDays],
              ["lecturers", "المحاضرون", GraduationCap],
            ].map(([key, label, Icon]) => (
              <article className="stat" key={key}>
                <span className="stat-icon">
                  <Icon size={22} />
                </span>
                <span>{label}</span>
                <strong>{money(data.stats[key])}</strong>
                <small>من سجلات الأكاديمية</small>
              </article>
            ))}
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="section-head">
                <h3>المحاضرات القادمة</h3>
                {user.role !== "finance" && (
                  <button
                    className="text-button"
                    onClick={() => navigate("lectures")}
                  >
                    عرض الجدول ←
                  </button>
                )}
              </div>
              {data.next.length ? (
                data.next.map((l) => (
                  <div className="schedule-row" key={l.title + l.starts_at}>
                    <div className="calendar-tile">
                      <CalendarDays size={22} />
                    </div>
                    <div>
                      <b>{l.title}</b>
                      <small>
                        {l.cohort} · {datetime(l.starts_at)}
                      </small>
                      <small>{l.location}</small>
                    </div>
                  </div>
                ))
              ) : (
                <Empty text="لا توجد محاضرات قادمة حتى الآن" />
              )}
            </section>
            <section className="panel journey">
              <span className="eyebrow">رحلة متكاملة</span>
              <h3>من الطموح إلى الإنجاز</h3>
              {[
                "التسجيل والقبول",
                "التعلّم والمشاركة",
                "التقييم والتقدّم",
                "الشهادة والتحقّق",
              ].map((x, i) => (
                <div className="journey-step" key={x}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <b>{x}</b>
                  <CheckCircle2 size={17} />
                </div>
              ))}
            </section>
          </div>
          {"collected" in data.stats && (
            <div className="finance-strip">
              {[
                ["collected", "المدفوعات المحصلة"],
                ["outstanding", "المستحقات المتبقية"],
                ["expenses", "المصروفات"],
              ].map(([k, l]) => (
                <div key={k}>
                  <small>{l}</small>
                  <strong>
                    {money(data.stats[k])} <span>وحدة نقدية</span>
                  </strong>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
function Empty({ text = "لا توجد سجلات بعد. أضف أول سجل للبدء." }) {
  return (
    <div className="empty">
      <BookOpen size={28} />
      <p>{text}</p>
    </div>
  );
}
function Entity({ entity, config }) {
  const [rows, setRows] = useState([]),
    [lookups, setLookups] = useState({}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(null),
    [formError, setFormError] = useState("");
  async function reload() {
    setLoading(true);
    try {
      setRows(await api(`/data/${entity}`));
      const sources = [
        ...new Set(config.fields.filter((f) => f.source).map((f) => f.source)),
      ];
      const entries = await Promise.all(
        sources.map(async (s) => {
          try {
            return [s, await api(`/data/${s}`)];
          } catch {
            return [s, []];
          }
        }),
      );
      setLookups(Object.fromEntries(entries));
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, [entity]);
  const displayName = (r) =>
    r.name ?? r.title ?? r.academic_number ?? r.reference ?? r.id;
  const lookupLabel = (source, value) => {
    const r = lookups[source]?.find((r) => r.id === value);
    if (!r) return value?.slice(0, 8) ?? "—";
    if (source === "enrollments")
      return `${r.name} · ${translations[r.status]} · ${r.progress}%`;
    return displayName(r);
  };
  const fields = editing?.id
    ? config.fields.filter((f) => config.edit.includes(f.key))
    : config.fields;
  const columns = [
    ...(entity === "students"
      ? [{ key: "academic_number", label: "الرقم الأكاديمي" }]
      : []),
    ...config.fields.filter(
      (f) => !["password", "options", "description"].includes(f.key),
    ),
  ];
  if (entity === "attempts")
    columns.push(
      ...["name", "title", "score", "submitted_at"].map((key) => ({
        key,
        label: labelKeys[key],
      })),
    );
  if (entity === "invoices") columns.push({ key: "balance", label: "المتبقي" });
  if (entity === "certificates")
    columns.push({ key: "issued_at", label: "تاريخ الإصدار" });
  function value(row, f) {
    const x = row[f.key];
    if (f.type === "checkbox")
      return (
        <span className={x ? "badge" : "badge neutral"}>
          {x ? "نعم" : "لا"}
        </span>
      );
    if (f.options)
      return <span className="badge neutral">{f.options[x] ?? x}</span>;
    if (f.source) return lookupLabel(f.source, x);
    if (["date", "datetime-local"].includes(f.type) || f.key.endsWith("_at"))
      return f.type === "datetime-local" ? datetime(x) : date(x);
    if (f.type === "number") return money(x);
    return translations[x] ?? x ?? "—";
  }
  const filtered = rows.filter((r) =>
    JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">إدارة الأكاديمية</span>
          <h1>{config.label}</h1>
          <p>سجلات واضحة، ومتابعة أسهل في كل خطوة.</p>
        </div>
        {!config.readonly && (
          <button
            className="primary"
            onClick={() => {
              setEditing({});
              setFormError("");
            }}
          >
            <Plus size={18} />
            إضافة سجل
          </button>
        )}
      </div>
      <ErrorText error={error} />
      <section className="panel">
        <div className="section-head">
          <span>{rows.length} سجل</span>
          <label className="search">
            <Search size={17} />
            <input
              aria-label="بحث"
              placeholder="ابحث في السجلات…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {loading ? (
          <p>جارٍ التحميل…</p>
        ) : filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columns.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    {columns.map((f) => (
                      <td key={f.key}>{value(row, f)}</td>
                    ))}
                    <td>
                      <div className="actions">
                        {!config.readonly && config.edit?.length > 0 && (
                          <button
                            className="text-button"
                            onClick={() => {
                              setEditing(row);
                              setFormError("");
                            }}
                          >
                            تعديل
                          </button>
                        )}
                        {!config.readonly && (
                          <button
                            className="text-button delete-button"
                            disabled={deleting === row.id}
                            onClick={async () => {
                              const name = displayName(row);
                              if (!window.confirm(`حذف "${name}" نهائيًا؟ لا يمكن التراجع عن هذه العملية.`))
                                return;
                              setDeleting(row.id);
                              setError("");
                              try {
                                await api(`/data/${entity}/${row.id}`, {
                                  method: "DELETE",
                                });
                                await reload();
                              } catch (x) {
                                setError(x.message);
                              } finally {
                                setDeleting(null);
                              }
                            }}
                          >
                            {deleting === row.id ? "جارٍ الحذف…" : "حذف"}
                          </button>
                        )}
                        {entity === "certificates" && (
                          <button
                            className="text-button"
                            onClick={() =>
                              window.open(
                                `/verify/${row.code}`,
                                "_blank",
                                "noopener",
                              )
                            }
                          >
                            الشهادة ↗
                          </button>
                        )}
                        {entity === "payments" && (
                          <button
                            className="text-button"
                            onClick={() => {
                              setEditing({ ...row, _receipt: true });
                            }}
                          >
                            الإيصال
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </section>
      {editing && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={config.label}
          >
            <div className="section-head">
              <h2>
                {editing._receipt
                  ? "إيصال دفع"
                  : editing.id
                    ? "تعديل السجل"
                    : "إضافة سجل جديد"}
              </h2>
              <button
                className="icon-button"
                aria-label="إغلاق"
                onClick={() => setEditing(null)}
              >
                <X />
              </button>
            </div>
            {editing._receipt ? (
              <Receipt row={editing} />
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setFormError("");
                  const f = new FormData(e.currentTarget),
                    body = {};
                  fields.forEach((field) => {
                    const v = f.get(field.key);
                    body[field.key] =
                      field.type === "checkbox"
                        ? v === "on"
                        : field.type === "number"
                          ? Number(v)
                          : field.type === "options"
                            ? String(v)
                                .split("\n")
                                .map((x) => x.trim())
                            : field.optional && !v
                              ? null
                              : field.type === "datetime-local"
                                ? new Date(v).toISOString()
                                : v;
                  });
                  try {
                    await api(
                      `/data/${entity}${editing.id ? `/${editing.id}` : ""}`,
                      { method: editing.id ? "PATCH" : "POST", body },
                    );
                    setEditing(null);
                    await reload();
                  } catch (x) {
                    setFormError(x.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div className="form-grid">
                  {fields.map((f) => (
                    <label
                      key={f.key}
                      className={
                        ["textarea", "options"].includes(f.type) ? "full" : ""
                      }
                    >
                      {f.label}
                      {f.type === "select" ? (
                        <select
                          aria-label={f.label}
                          name={f.key}
                          required={!f.optional}
                          defaultValue={String(editing[f.key] ?? "")}
                        >
                          <option value="">اختر…</option>
                          {f.source
                            ? (lookups[f.source] ?? []).map((r) => (
                                <option key={r.id} value={r.id}>
                                  {lookupLabel(f.source, r.id)}
                                </option>
                              ))
                            : Object.entries(f.options).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                        </select>
                      ) : ["textarea", "options"].includes(f.type) ? (
                        <textarea
                          name={f.key}
                          required={f.type === "options"}
                          defaultValue={
                            Array.isArray(editing[f.key])
                              ? editing[f.key].join("\n")
                              : (editing[f.key] ?? "")
                          }
                        />
                      ) : f.type === "checkbox" ? (
                        <input
                          type="checkbox"
                          name={f.key}
                          defaultChecked={editing[f.key] ?? f.key === "active"}
                        />
                      ) : (
                        <input
                          name={f.key}
                          type={f.type}
                          required={
                            !["phone", "location", "expertise"].includes(f.key)
                          }
                          min={f.min}
                          max={f.max}
                          step={
                            ["fee", "amount"].includes(f.key)
                              ? "0.01"
                              : undefined
                          }
                          minLength={f.type === "password" ? 12 : undefined}
                          defaultValue={
                            f.type === "datetime-local" && editing[f.key]
                              ? toLocal(editing[f.key])
                              : f.type === "date" && editing[f.key]
                                ? String(editing[f.key]).slice(0, 10)
                                : (editing[f.key] ?? "")
                          }
                          autoComplete={
                            f.type === "password" ? "new-password" : undefined
                          }
                        />
                      )}
                    </label>
                  ))}
                </div>
                {entity === "certificates" && (
                  <p className="muted">
                    يجب إكمال التسجيل بنسبة 100% قبل الإصدار. فتح الشهادة يعرض
                    رابط التحقق العام.
                  </p>
                )}
                {entity === "questions" && (
                  <p className="muted">
                    تُعدّل الأسئلة في المسودة فقط. بعد نشر الاختبار تصبح الأسئلة
                    ثابتة.
                  </p>
                )}
                <ErrorText error={formError} />
                <button className="primary wide" disabled={busy}>
                  {busy ? "جارٍ الحفظ…" : "حفظ البيانات"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
function toLocal(value) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function Receipt({ row }) {
  return (
    <div className="receipt">
      <Brand />
      <h2>إيصال استلام</h2>
      <p>
        مرجع الدفع: <b>{row.reference}</b>
      </p>
      <p>
        المبلغ: <b>{money(row.amount)}</b>
      </p>
      <p>التاريخ: {datetime(row.paid_at)}</p>
      <p>الفاتورة: {row.invoice_id}</p>
      <button className="primary no-print" onClick={() => window.print()}>
        طباعة / حفظ PDF
      </button>
    </div>
  );
}
function Portal({ user }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [exam, setExam] = useState(null),
    [questions, setQuestions] = useState([]),
    [answers, setAnswers] = useState({}),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState(null);
  const load = () =>
    api("/portal")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  if (!data)
    return (
      <>
        <ErrorText error={error} />
        <p>جارٍ تحميل ملفك…</p>
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">رحلتك الأكاديمية</span>
          <h1>أهلًا، {user.name} ✦</h1>
          <p>كل خطوة تقرّبك من هدفك. واصل التقدّم.</p>
        </div>
        <span className="pill light">{data.student.academic_number}</span>
      </div>
      <ErrorText error={error} />
      <div className="stats">
        <article className="stat">
          <span>حالة القبول</span>
          <strong>{translations[data.student.admission]}</strong>
        </article>
        <article className="stat">
          <span>برامجي</span>
          <strong>{data.enrollments.length}</strong>
        </article>
        <article className="stat">
          <span>الرصيد المستحق</span>
          <strong>
            {money(data.invoices.reduce((s, i) => s + Number(i.balance), 0))}
          </strong>
        </article>
        <article className="stat">
          <span>الشهادات الصادرة</span>
          <strong>{data.certificates.filter((c) => !c.revoked).length}</strong>
        </article>
      </div>
      <h2>برامجي التعليمية</h2>
      <div className="program-grid">
        {data.enrollments.map((e) => (
          <article className="program-card" key={e.id}>
            <BookOpen />
            <span className="badge">{translations[e.status]}</span>
            <h3>{e.program}</h3>
            <p>{e.cohort}</p>
            <div className="section-head">
              <small>نسبة الإنجاز</small>
              <b>{e.progress}%</b>
            </div>
            <progress max="100" value={e.progress} />
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h3>جدولي الدراسي</h3>
          {data.lectures.length ? (
            data.lectures.map((l) => (
              <div className="schedule-row" key={l.id}>
                <CalendarDays />
                <div>
                  <b>{l.title}</b>
                  <small>
                    {datetime(l.starts_at)} — {datetime(l.ends_at)}
                  </small>
                  <small>{l.location}</small>
                </div>
              </div>
            ))
          ) : (
            <Empty />
          )}
        </section>
        <section className="panel">
          <h3>اختباراتي ونتائجي</h3>
          {data.exams.length ? (
            data.exams.map((x) => (
              <div className="exam-row" key={x.id}>
                <div>
                  <b>{x.title}</b>
                  <small>حد النجاح {x.pass_percent}% · محاولة واحدة</small>
                </div>
                {x.score === null ? (
                  <button
                    className="primary"
                    disabled={!x.can_take}
                    onClick={async () => {
                      try {
                        setQuestions(await api(`/exams/${x.id}`));
                        setAnswers({});
                        setExam(x);
                        setError("");
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    {x.can_take ? "ابدأ" : "انتهى التسجيل"}
                  </button>
                ) : (
                  <span className="badge">
                    {x.score}% ·{" "}
                    {Number(x.score) >= x.pass_percent ? "ناجح" : "لم يجتز"}
                  </span>
                )}
              </div>
            ))
          ) : (
            <Empty />
          )}
        </section>
      </div>
      <section className="panel spaced">
        <h3>الحضور</h3>
        {data.attendance.length ? (
          data.attendance.map((a, i) => (
            <div className="exam-row" key={i}>
              <span>
                {a.title} · {date(a.starts_at)}
              </span>
              <span className="badge neutral">{translations[a.status]}</span>
            </div>
          ))
        ) : (
          <Empty />
        )}
      </section>
      <section className="panel spaced">
        <h3>الرسوم والأقساط</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>البند</th>
                <th>المبلغ</th>
                <th>المتبقي</th>
                <th>الاستحقاق</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((i) => (
                <tr key={i.id}>
                  <td>{i.title}</td>
                  <td>{money(i.amount)}</td>
                  <td>{money(i.balance)}</td>
                  <td>{date(i.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>إيصالات المدفوعات</h3>
        {data.payments.map((p) => (
          <div className="exam-row" key={p.id}>
            <span>
              {p.reference} · {money(p.amount)}
            </span>
            <button className="text-button" onClick={() => setReceipt(p)}>
              عرض الإيصال
            </button>
          </div>
        ))}
      </section>
      <section className="panel spaced">
        <h3>شهاداتي</h3>
        {data.certificates.length ? (
          data.certificates.map((c) => (
            <div className="exam-row" key={c.id}>
              <div>
                <b>{c.program}</b>
                <small>
                  {date(c.issued_at)} · {c.revoked ? "ملغاة" : "سارية"}
                </small>
              </div>
              <a
                className="text-button"
                href={`/verify/${c.code}`}
                target="_blank"
                rel="noreferrer"
              >
                عرض الشهادة وQR ↗
              </a>
            </div>
          ))
        ) : (
          <Empty text="ستظهر شهاداتك هنا بعد اعتماد إكمال البرنامج" />
        )}
      </section>
      {receipt && (
        <div className="modal-backdrop">
          <div className="modal">
            <button
              className="icon-button no-print"
              onClick={() => setReceipt(null)}
              aria-label="إغلاق"
            >
              <X />
            </button>
            <Receipt row={receipt} />
          </div>
        </div>
      )}
      {exam && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="section-head">
              <h2>{exam.title}</h2>
              <button
                className="icon-button"
                aria-label="إغلاق"
                onClick={() => setExam(null)}
              >
                <X />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api(`/exams/${exam.id}/submit`, {
                    method: "POST",
                    body: { answers },
                  });
                  setExam(null);
                  await load();
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {questions.map((q, i) => (
                <fieldset key={q.id}>
                  <legend>
                    {i + 1}. {q.prompt}
                  </legend>
                  {q.options.map((v, j) => (
                    <label className="radio-option" key={j}>
                      <input
                        type="radio"
                        name={q.id}
                        required
                        checked={answers[q.id] === j}
                        onChange={() => setAnswers({ ...answers, [q.id]: j })}
                      />
                      {v}
                    </label>
                  ))}
                </fieldset>
              ))}
              <ErrorText error={error} />
              <p className="muted">التسليم نهائي. راجع إجاباتك قبل المتابعة.</p>
              <button
                className="primary wide"
                disabled={busy || !questions.length}
              >
                {busy ? "جارٍ التسليم…" : "تسليم الاختبار"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
function Verify({ code }) {
  const [cert, setCert] = useState(null),
    [qr, setQr] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    api(`/verify/${code}`)
      .then(setCert)
      .catch((e) => setError(e.message));
    import("qrcode")
      .then((module) =>
        module.default.toDataURL(location.origin + `/verify/${code}`, {
          width: 220,
          margin: 2,
        }),
      )
      .then(setQr)
      .catch(() => {});
  }, [code]);
  return (
    <div className="verify-page">
      <div className="certificate">
        <Brand />
        <ErrorText error={error} />
        {cert ? (
          <>
            <span className={cert.revoked ? "error" : "pill light"}>
              {cert.revoked
                ? "شهادة ملغاة"
                : "شهادة موثّقة في سجلات الأكاديمية"}
            </span>
            <span className="eyebrow">CERTIFICATE OF COMPLETION</span>
            <h1>شهادة إتمام برنامج مهني</h1>
            <p>تشهد Pioneers Academy بأن</p>
            <h2 className="graduate">{cert.name}</h2>
            <p>قد أتم متطلبات البرنامج المهني</p>
            <h2>{cert.program}</h2>
            <p>{cert.type}</p>
            <p>تاريخ الإصدار: {date(cert.issued_at)}</p>
            {qr && (
              <img
                src={qr}
                width="150"
                height="150"
                alt="رمز QR للتحقق من الشهادة"
              />
            )}
            <code>{cert.code}</code>
            <small>
              إثبات إتمام برنامج لدى الأكاديمية. لا يتضمن ادعاء اعتماد جامعي أو
              حكومي.
            </small>
            <button className="primary no-print" onClick={() => window.print()}>
              طباعة الشهادة / حفظ PDF
            </button>
          </>
        ) : (
          !error && <p>جارٍ التحقق…</p>
        )}
      </div>
      <a className="no-print" href="/">
        العودة إلى الأكاديمية
      </a>
    </div>
  );
}
function Account() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel account">
      <h1>أمان الحساب</h1>
      <p className="muted">بعد تغيير كلمة المرور ستُنهى جميع جلسات حسابك.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            await api("/password", {
              method: "POST",
              body: { current: f.get("current"), password: f.get("password") },
            });
            location.href = "/";
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          كلمة المرور الحالية
          <input
            type="password"
            name="current"
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          كلمة المرور الجديدة
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength="12"
            maxLength="128"
            required
          />
        </label>
        <ErrorText error={error} />
        <button className="primary" disabled={busy}>
          تغيير كلمة المرور
        </button>
      </form>
    </section>
  );
}
createRoot(document.getElementById("root")).render(<App />);
