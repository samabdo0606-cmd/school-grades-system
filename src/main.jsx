import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function App() {
  return (
    <main className="app">
      <header className="header">
        <h1>نظام درجات التلاميذ</h1>
        <p>منصة إدارة درجات التلاميذ بالمدارس</p>
      </header>

      <section className="welcome">
        <h2>مرحبًا بك</h2>
        <p>سيتم تجهيز النظام لتسجيل التلاميذ وإدخال درجاتهم وحفظها.</p>
        <p>نعمل الآن على إعداد الموقع وربطه بقاعدة البيانات.</p>
      </section>

      <footer>نظام درجات التلاميذ © 2026</footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
