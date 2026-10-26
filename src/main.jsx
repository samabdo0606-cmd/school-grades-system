import { useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase";
import "./style.css";

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

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
        throw new Error("تعذر الاتصال بخدمة تسجيل الدخول. تحقق من نشر الدالة وإعداداتها.");
      }

      if (!data || data.error || !data.access_token || !data.refresh_token) {
        throw new Error(
          data?.error || "اسم المستخدم أو كلمة المرور غير صحيحة، أو أن الحساب غير مفعّل."
        );
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionError) {
        throw new Error("تعذر إنشاء جلسة الدخول. حاول مرة أخرى.");
      }

      setUser({
        username: data.username || cleanUsername,
        role: data.role,
      });
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setPassword("");
    setError("");
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
              {user.role === "admin" ? "مدير النظام" : "حساب مدرسة"}
            </p>
          </div>

          <p>
            {user.role === "admin"
              ? "مرحبًا بك في حساب مدير النظام."
              : "مرحبًا بك في حساب المدرسة."}
          </p>

          <p className="notice">
            هذه مرحلة تسجيل الدخول. سنضيف واجهة الإدارة وإدخال الدرجات في
            الخطوات التالية.
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
        <p className="subtitle">منصة إدارة درجات التلاميذ بالمدارس</p>

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

          <button type="submit" disabled={loading}>
            {loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <p className="footer-text">نظام إلكتروني لإدارة درجات التلاميذ</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
