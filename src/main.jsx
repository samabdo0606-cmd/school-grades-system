import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase";
import "./style.css";

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const [activeSection, setActiveSection] = useState("home");
  const [forms, setForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState("");
  const [selectedForm, setSelectedForm] = useState(null);
// بيانات إنشاء حساب مدرسة
  const [schoolUsername, setSchoolUsername] = useState("");
  const [schoolPassword, setSchoolPassword] = useState("");
  const [schoolDisplayName, setSchoolDisplayName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolUserNo, setSchoolUserNo] = useState("");

  const [schoolLoading, setSchoolLoading] = useState(false);
  const [schoolError, setSchoolError] = useState("");
  const [schoolMessage, setSchoolMessage] = useState("");
  const [schools, setSchools] = useState([]);
  useEffect(() => {
    let mounted = true;

    const { data: authListener } =
      supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" && mounted) {
          setRecoveryMode(true);
          setError("");
          setMessage("");
        }
      });

    async function initialize() {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);

      const isRecovery =
        hash.includes("type=recovery") ||
        params.get("type") === "recovery";

      if (isRecovery) {
        if (mounted) setRecoveryMode(true);
        return;
      }

      const { data, error: sessionError } =
        await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError) {
        setError("تعذر التحقق من جلسة الدخول.");
        return;
      }

      if (data.session) {
        const currentUser = data.session.user;

        setUser({
          username:
            currentUser.user_metadata?.username ||
            currentUser.email || "",
          role: currentUser.user_metadata?.role || "school",
        });
      }
    }

    initialize();

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // تحميل نماذج الدرجات من قاعدة البيانات
  useEffect(() => {
 if (!user) return;

    let mounted = true;

    async function loadForms() {
      setFormsLoading(true);
      setFormsError("");

      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (!mounted) return;

      if (error) {
        setFormsError("تعذر تحميل نماذج الدرجات: " + error.message);
      } else {
        setForms(data || []);
      }

      setFormsLoading(false);
    }

    loadForms();

    return () => {
      mounted = false;
    };
  }, [user]);
async function handleCreateSchool(e) {
  e.preventDefault();

  setSchoolError("");
  setSchoolMessage("");

  if (
    !schoolUsername.trim() ||
    !schoolPassword ||
    !schoolDisplayName.trim() ||
    !schoolName.trim() ||
    !schoolUserNo.trim()
  ) {
    setSchoolError("يرجى填写 جميع البيانات.");
    return;
  }

  if (!/^[a-zA-Z0-9_]{3,30}$/.test(schoolUsername.trim())) {
    setSchoolError("اسم المستخدم يجب أن يكون من 3 إلى 30 حرفًا إنجليزيًا أو رقمًا أو _.");
    return;
  }

  if (schoolPassword.length < 12) {
    setSchoolError("كلمة المرور يجب ألا تقل عن 12 حرفًا.");
    return;
  }

  if (!/^\d{3}$/.test(schoolUserNo.trim()) || schoolUserNo.trim() === "000") {
    setSchoolError("رقم المدرسة يجب أن يكون ثلاث خانات، ولا يكون 000.");
    return;
  }

  setSchoolLoading(true);

  try {
    const { data, error } = await supabase.functions.invoke(
      "manage-schools",
      {
        body: {
          username: schoolUsername.trim(),
          password: schoolPassword,
          display_name: schoolDisplayName.trim(),
          school_name: schoolName.trim(),
          user_no: schoolUserNo.trim(),
        },
      }
    );

    if (error) {
      throw error;
    }

    setSchoolMessage(data?.message || "تم إنشاء حساب المدرسة بنجاح.");
    setSchoolUsername("");
    setSchoolPassword("");
    setSchoolDisplayName("");
    setSchoolName("");
    setSchoolUserNo("");
  } catch (error) {
    console.error("Create school error:", error);
    setSchoolError(
      error.message || "تعذر إنشاء الحساب. تحقق من البيانات وحاول مرة أخرى."
    );
  } finally {
    setSchoolLoading(false);
  }
}
  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      setError("يرجى إدخال اسم المستخدم وكلمة المرور.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.functions.invoke("username-login", {
          body: {
            username: cleanUsername,
            password,
          },
        });

      if (loginError) {
        let detail = "";

        try {
          const response = loginError.context;

          if (response && typeof response.clone === "function") {
            const body = await response.clone().json();
            detail = body?.error || "";
          }
        } catch {}

        if (detail) throw new Error(detail);

        if (loginError.name === "FunctionsFetchError") {
          throw new Error(
            "تعذر الوصول إلى خدمة تسجيل الدخول. تحقق من الاتصال وإعدادات الدالة."
          );
        }

        throw new Error(
          "فشل طلب تسجيل الدخول. تحقق من إعدادات الدالة وسجلاتها."
        );
      }

      if (!data || data.error) {
        throw new Error(
          data?.error || "لم تصل استجابة صحيحة من خدمة تسجيل الدخول."
        );
      }

      if (!data.access_token || !data.refresh_token || !data.user) {
        throw new Error(
          "استجابة تسجيل الدخول غير مكتملة."
        );
      }

      const { error: sessionError } =
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

      if (sessionError) {
        throw new Error(
          "تم التحقق من بيانات الدخول، لكن تعذر إنشاء جلسة الدخول."
        );
      }

      setUser({
        username: data.user.username || cleanUsername,
        role: data.user.role || "school",
      });

      setActiveSection("home");
      setPassword("");
    } catch (err) {
      setError(
        err.message || "حدث خطأ غير متوقع أثناء تسجيل الدخول."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error(
          "رابط الاستعادة غير صالح أو انتهت صلاحيته."
        );
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (updateError) throw updateError;

      await supabase.auth.signOut();

      setRecoveryMode(false);
      setNewPassword("");
      setConfirmPassword("");
      setUsername("");
      setPassword("");

      setMessage(
        "تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول."
      );

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    } catch (err) {
      setError(
        err.message || "تعذر تغيير كلمة المرور."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setPassword("");
    setError("");
    setMessage("");
    setForms([]);
    setActiveSection("home");
  }

  // صفحة استعادة كلمة المرور
  if (recoveryMode) {
    return (
      <main className="login-page" dir="rtl">
        <section className="login-card">
          <h1>نظام درجات التلاميذ</h1>
          <h2>تعيين كلمة مرور جديدة</h2>
          <p className="subtitle">
            أدخل كلمة المرور الجديدة وأعد كتابتها للتأكيد.
          </p>

          <form onSubmit={handlePasswordUpdate}>
            <label htmlFor="new-password">
              كلمة المرور الجديدة
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />

            <label htmlFor="confirm-password">
              تأكيد كلمة المرور
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />

            {error && <p className="error-message">{error}</p>}

            <button type="submit" disabled={loading}>
              {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور الجديدة"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  // صفحة تسجيل الدخول
  if (!user) {
    return (
      <main className="login-page" dir="rtl">
        <section className="login-card">
          <h1>نظام درجات التلاميذ</h1>
          <p className="subtitle">
            منصة إدارة درجات التلاميذ بالمدارس
          </p>

          <div className="login-icon" aria-hidden="true">
            📚
          </div>

          <h2>تسجيل الدخول</h2>

          <form onSubmit={handleLogin}>
            <label htmlFor="username">اسم المستخدم</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="أدخل اسم المستخدم"
              required
            />

            <label htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور"
              required
            />

            {error && <p className="error-message">{error}</p>}
            {message && <p role="status">{message}</p>}

            <button type="submit" disabled={loading}>
              {loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
            </button>
          </form>

          <p className="footer-text">
            نظام إلكتروني لإدارة درجات التلاميذ
          </p>
        </section>
      </main>
    );
  }

  // واجهة حساب المدرسة
 if (user.role !== "admin") {
    return (
      <main className="dashboard" dir="rtl">
        <header className="dashboard-header">
          <div>
            <h1>نظام درجات التلاميذ</h1>
            <p>حساب المدرسة: {user.username}</p>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            تسجيل الخروج
          </button>
        </header>

        <div className="dashboard-layout">
          <aside className="sidebar">
            <h3>القائمة الرئيسية</h3>

            <button
              className={!selectedForm ? "active" : ""}
              onClick={() => setSelectedForm(null)}
            >
              <span>🏠</span> الرئيسية
            </button>

            <div className="sidebar-section-title">
              <span>📋</span> نماذج الدرجات
            </div>

            {formsLoading && <p>جارٍ تحميل النماذج...</p>}

            {formsError && (
              <p className="error-message">{formsError}</p>
            )}

            {!formsLoading && !formsError && forms.length === 0 && (
              <p>لا توجد نماذج متاحة.</p>
            )}

            {forms.map((form) => (
              <button
                key={form.id}
                className={selectedForm?.id === form.id ? "active" : ""}
                onClick={() => setSelectedForm(form)}
              >
                <span>📄</span> {form.name}
              </button>
            )}

            <button
              onClick={handleLogout}
              className="logout-button"
            >
              <span>🚪</span> تسجيل الخروج
            </button>
          </aside>

          <section className="main-content">
            {!selectedForm ? (
              <div className="page-heading">
                <h2>مرحبًا بك في حساب المدرسة</h2>
                <p>اختر نموذج الدرجات من القائمة لبدء العمل.</p>
              </div>
            ) : (
              <div className="page-heading">
                <h2>{selectedForm.name}</h2>
                <p>
                  تم اختيار نموذج الصف بنجاح.
                </p>
                <p className="notice">
                  سنضيف هنا نموذج إدخال بيانات التلاميذ والدرجات.
                </p>
              </div>
            )}
          </section>
        </div>

        <footer className="dashboard-footer">
          نظام إلكتروني لإدارة درجات التلاميذ
        </footer>
      </main>
    );
  }

  // لوحة تحكم مدير النظام
  return (
    <main className="dashboard" dir="rtl">
      <header className="dashboard-header">
        <div>
          <h1>نظام درجات التلاميذ</h1>
          <p>لوحة تحكم مدير النظام</p>
        </div>

        <div className="admin-info">
          <span>مدير النظام: {user.username}</span>
          <button className="logout-button" onClick={handleLogout}>
            تسجيل الخروج
          </button>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="sidebar">
          <h3>القائمة الرئيسية</h3>

          <button
            className={activeSection === "home" ? "active" : ""}
            onClick={() => setActiveSection("home")}
          >
            <span>🏠</span> الرئيسية
          </button>

          <button
            className={activeSection === "schools" ? "active" : ""}
            onClick={() => setActiveSection("schools")}
          >
            <span>🏫</span> إدارة المدارس
          </button>

          <button
            className={activeSection === "forms" ? "active" : ""}
            onClick={() => setActiveSection("forms")}
          >
            <span>📋</span> نماذج الدرجات
          </button>

          <button
            className={activeSection === "students" ? "active" : ""}
            onClick={() => setActiveSection("students")}
          >
            <span>👨‍🎓</span> بيانات التلاميذ
          </button>

          <button
            className={activeSection === "reports" ? "active" : ""}
            onClick={() => setActiveSection("reports")}
          >
            <span>📊</span> التقارير
          </button>
        </aside>

        <section className="main-content">

          {activeSection === "home" && (
            <>
              <div className="page-heading">
                <h2>مرحبًا بك، مدير النظام</h2>
                <p>اختر القسم الذي تريد العمل عليه.</p>
              </div>

              <div className="dashboard-cards">
                <button
                  className="dashboard-card blue"
                  onClick={() => setActiveSection("schools")}
                >
                  <span className="card-icon">🏫</span>
                  <h3>إدارة المدارس</h3>
                  <p>إضافة المدارس وإدارة حساباتها.</p>
                </button>

                <button
                  className="dashboard-card green"
                  onClick={() => setActiveSection("forms")}
                >
                  <span className="card-icon">📋</span>
                  <h3>نماذج الدرجات</h3>
                  <p>عرض وإدارة نماذج الصفوف.</p>
                </button>

                <button
                  className="dashboard-card orange"
                  onClick={() => setActiveSection("students")}
                >
                  <span className="card-icon">👨‍🎓</span>
                  <h3>بيانات التلاميذ</h3>
                  <p>مراجعة سجلات التلاميذ.</p>
                </button>

                <button
                  className="dashboard-card purple"
                  onClick={() => setActiveSection("reports")}
                >
                  <span className="card-icon">📊</span>
                  <h3>التقارير</h3>
                  <p>عرض ومراجعة تقارير الدرجات.</p>
                </button>
              </div>
            </>
          )}

          {activeSection === "forms" && (
            <>
              <div className="page-heading">
                <h2>نماذج الدرجات</h2>
                <p>اختر الصف المطلوب.</p>
              </div>

              {formsLoading && (
                <p className="notice">جارٍ تحميل نماذج الدرجات...</p>
              )}

              {formsError && (
                <p className="error-message">{formsError}</p>
              )}

              {!formsLoading && !formsError && forms.length === 0 && (
                <p className="notice">
                  لا توجد نماذج درجات نشطة حاليًا.
                </p>
              )}

              <div className="dashboard-cards">
                {forms.map((form) => (
                  <div className="dashboard-card green" key={form.id}>
                    <span className="card-icon">📚</span>
                    <h3>{form.name}</h3>
                    <p>الصف الدراسي: {form.grade_level}</p>
                    <p>رمز النموذج: {form.slug}</p>
                    <span className="form-status">نشط</span>
                  </div>
                ))}
              </div>
            </>
          )}

         {activeSection === "schools" && (
  <div className="page-heading">
    <h2>إدارة المدارس</h2>
    <p>إنشاء حساب جديد لمدرسة.</p>

    <form onSubmit={handleCreateSchool} className="school-form">

      <div className="form-group">
        <label>اسم المستخدم</label>
        <input
          type="text"
          value={schoolUsername}
          onChange={(e) => setSchoolUsername(e.target.value)}
          placeholder="مثال: school001"
          required
        />
      </div>

      <div className="form-group">
        <label>كلمة المرور</label>
        <input
          type="password"
          value={schoolPassword}
          onChange={(e) => setSchoolPassword(e.target.value)}
          placeholder="12 حرفًا على الأقل"
          required
        />
      </div>

      <div className="form-group">
        <label>اسم المسؤول</label>
        <input
          type="text"
          value={schoolDisplayName}
          onChange={(e) => setSchoolDisplayName(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label>اسم المدرسة</label>
        <input
          type="text"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label>رقم المدرسة (ثلاث خانات)</label>
        <input
          type="text"
          maxLength="3"
          value={schoolUserNo}
          onChange={(e) => setSchoolUserNo(e.target.value.replace(/\D/g, ""))}
          placeholder="مثال: 001"
          required
        />
      </div>

      {schoolError && (
        <p className="error-message">{schoolError}</p>
      )}

      {schoolMessage && (
        <p className="success-message">{schoolMessage}</p>
      )}

      <button type="submit" disabled={schoolLoading}>
        {schoolLoading ? "جارٍ إنشاء الحساب..." : "إنشاء حساب المدرسة"}
      </button>

    </form>
  </div>
)}

          {activeSection === "students" && (
            <div className="page-heading">
              <h2>بيانات التلاميذ</h2>
              <p>
                سيظهر هنا سجل التلاميذ وبياناتهم ودرجاتهم.
              </p>
              <p className="notice">
                هذا القسم قيد التجهيز.
              </p>
            </div>
          )}

          {activeSection === "reports" && (
            <div className="page-heading">
              <h2>التقارير</h2>
              <p>
                سيظهر هنا عرض تقارير الدرجات ونتائج التلاميذ.
              </p>
              <p className="notice">
                هذا القسم قيد التجهيز.
              </p>
            </div>
          )}

        </section>
      </div>

      <footer className="dashboard-footer">
        نظام إلكتروني لإدارة درجات التلاميذ
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
