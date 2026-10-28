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

  useEffect(() => {
    let mounted = true;

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY" && mounted) {
          setRecoveryMode(true);
          setError("");
          setMessage("");
        }
      }
    );

    async function initialize() {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);

      const isRecovery =
        hash.includes("type=recovery") ||
        params.get("type") === "recovery";

      if (isRecovery) {
        if (mounted) {
          setRecoveryMode(true);
        }
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
            currentUser.email ||
            "",
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
        } catch {
          // قد لا يحتوي خطأ الاتصال على استجابة JSON.
        }

        if (detail) {
          throw new Error(detail);
        }

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
          "استجابة تسجيل الدخول غير مكتملة. تحقق من كود الدالة username-login."
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
          "رابط الاستعادة غير صالح أو انتهت صلاحيته. ستحتاج إلى طلب رابط جديد."
        );
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (updateError) {
        throw updateError;
      }

      await supabase.auth.signOut();

      setRecoveryMode(false);
      setNewPassword("");
      setConfirmPassword("");
      setUsername("");
      setPassword("");
      setMessage(
        "تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة."
      );

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    } catch (err) {
      setError(
        err.message ||
          "تعذر تغيير كلمة المرور. تحقق من رابط الاستعادة."
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
  }

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

            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading}>
              {loading
                ? "جارٍ حفظ كلمة المرور..."
                : "حفظ كلمة المرور الجديدة"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (user) {
    return (
      <main className="login-page" dir="rtl">
        <section className="login-card">
          <h1>نظام درجات التلاميذ</h1>
          <p className="subtitle">تم تسجيل الدخول بنجاح</p>

          <div className="welcome-box">
            <p>اسم المستخدم: {user.username}</p>
            <p>
              نوع الحساب:{" "}
              {user.role === "admin"
                ? "مدير النظام"
                : "حساب مدرسة"}
            </p>
          </div>

          <p>
            {user.role === "admin"
              ? "مرحبًا بك في حساب مدير النظام."
              : "مرحبًا بك في حساب المدرسة."}
          </p>

          <p className="notice">
            هذه مرحلة تسجيل الدخول. سنضيف واجهة الإدارة وإدخال الدرجات
            في الخطوات التالية.
          </p>

          <button type="button" onClick={handleLogout}>
            تسجيل الخروج
          </button>
        </section>
      </main>
    );
  }

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

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p role="status">{message}</p>
          )}

          <button type="submit" disabled={loading}>
            {loading
              ? "جارٍ تسجيل الدخول..."
              : "تسجيل الدخول"}
          </button>
        </form>

        <p className="footer-text">
          نظام إلكتروني لإدارة درجات التلاميذ
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
