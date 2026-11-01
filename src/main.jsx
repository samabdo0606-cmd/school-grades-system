import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase";
import "./style.css";

/*
 * نظام درجات التلاميذ
 * يعتمد على الجداول الموجودة: profiles, forms, submissions.
 * أعداد صفحات وخانات النماذج مأخوذة من أكواد Excel الأصلية.
 */

const FORM_LAYOUTS = {
  3: [
    { title: "بيانات التلميذ", count: 0 },
    { title: "السؤال الأول", count: 3 },
    { title: "السؤال الثاني", count: 3 },
    { title: "السؤال الثالث", count: 4 },
    { title: "السؤال الرابع", count: 3 },
    { title: "السؤال الخامس", count: 3 },
    { title: "السؤال السادس", count: 3 },
    { title: "السؤال السابع", count: 3 },
    { title: "السؤال الثامن", count: 4 },
    { title: "السؤال التاسع", count: 4 },
  ],
  4: [
    { title: "بيانات التلميذ", count: 0 },
    { title: "السؤال الأول", count: 25, columns: 5 },
    { title: "السؤال الثاني", count: 20, columns: 5 },
    { title: "السؤال الثالث", count: 5, columns: 5 },
  ],
  5: [
    { title: "بيانات التلميذ", count: 0 },
    { title: "السؤال الأول", count: 6, columns: 3 },
    { title: "السؤال الثاني", count: 5, columns: 5 },
    { title: "السؤال الثالث", count: 5, columns: 5 },
    { title: "السؤال الرابع", count: 5, columns: 5 },
    { title: "السؤال الخامس", count: 5, columns: 5 },
    { title: "السؤال السادس", count: 6, columns: 3 },
    { title: "السؤال السابع", count: 5, columns: 5 },
    { title: "السؤال الثامن", count: 8, columns: 4 },
  ],
};

function getGrade(form) {
  const n = Number(form?.grade_level);
  if ([3, 4, 5].includes(n)) return n;
  const text = `${form?.slug || ""} ${form?.name || ""}`;
  if (text.includes("الثالث") || text.includes("3")) return 3;
  if (text.includes("الرابع") || text.includes("4")) return 4;
  if (text.includes("الخامس") || text.includes("5")) return 5;
  return null;
}

function getPages(form) {
  const grade = getGrade(form);
  return FORM_LAYOUTS[grade] || null;
}

function makeFieldLabels(form, pageIndex, count) {
  // إذا كانت قاعدة البيانات تحتوي تعريفات حقول مستقبلًا، يمكن استبدال
  // هذه التسميات بها دون تغيير منطق الحفظ.
  if (pageIndex === 8 && getGrade(form) === 3) {
    return ["الضرب الأول", "الضرب الثاني", "القسمة الأولى", "القسمة الثانية"];
  }
  return Array.from({ length: count }, (_, i) => `الدرجة ${i + 1}`);
}

function escapeExcel(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeFileName(value) {
  return String(value || "بيانات-الدرجات").replace(/[\\/:*?"<>|]+/g, "-").trim();
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

  const [studentNumber, setStudentNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [answers, setAnswers] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const [students, setStudents] = useState([]);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(-1);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState("");
  const [studentMessage, setStudentMessage] = useState("");
  const [searchNumber, setSearchNumber] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [schoolUsername, setSchoolUsername] = useState("");
  const [schoolPassword, setSchoolPassword] = useState("");
  const [schoolDisplayName, setSchoolDisplayName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolUserNo, setSchoolUserNo] = useState("");
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [schoolError, setSchoolError] = useState("");
  const [schoolMessage, setSchoolMessage] = useState("");
  const [schools, setSchools] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolsError, setSchoolsError] = useState("");
  const [exportSchoolIds, setExportSchoolIds] = useState([]);
  const [exportFormIds, setExportFormIds] = useState([]);
  const [entrySchoolId, setEntrySchoolId] = useState("");
  const [editingSchool, setEditingSchool] = useState(null);
  const [schoolEditDisplayName, setSchoolEditDisplayName] = useState("");
  const [schoolEditName, setSchoolEditName] = useState("");
  const [schoolEditNo, setSchoolEditNo] = useState("");
  const [schoolEditLoading, setSchoolEditLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportMessage, setExportMessage] = useState("");

  const pages = useMemo(
    () => (selectedForm ? getPages(selectedForm) : null),
    [selectedForm]
  );

  useEffect(() => {
    let mounted = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && mounted) {
        setRecoveryMode(true);
        setError("");
        setMessage("");
      }
    });

    async function initialize() {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      if (hash.includes("type=recovery") || params.get("type") === "recovery") {
        if (mounted) setRecoveryMode(true);
        return;
      }

      const tabSessionKey = "school-grades-tab-authenticated";
      if (sessionStorage.getItem(tabSessionKey) !== "1") {
        // Do not restore a previous browser/tab session; leave the login screen visible.
        return;
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;
      if (sessionError) throw sessionError;
      if (!data.session) {
        sessionStorage.removeItem(tabSessionKey);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!mounted) return;
      if (authError || !authData.user) throw authError || new Error("تعذر التحقق من المستخدم.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_no, school_name, role, username, display_name, is_active")
        .eq("id", authData.user.id)
        .single();

      if (!mounted) return;
      if (profileError || !profile) throw profileError || new Error("بيانات الحساب غير موجودة.");
      if (profile.is_active === false) {
        await supabase.auth.signOut();
        throw new Error("هذا الحساب غير نشط. يرجى مراجعة مدير النظام.");
      }
      const normalizedRole = profile.role === "user" ? "school" : profile.role;
      setUser({
        id: authData.user.id,
        username: profile.username || profile.display_name || authData.user.email,
        role: normalizedRole,
        user_no: profile.user_no,
        school_name: profile.school_name,
      });
    }

    initialize().catch((err) => {
      console.error("Initialization error:", err);
      if (mounted) setError(err?.message || "حدث خطأ أثناء تحميل الحساب.");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    async function loadForms() {
      setFormsLoading(true);
      setFormsError("");
      const { data, error: queryError } = await supabase
        .from("forms")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (!mounted) return;
      if (queryError) setFormsError(`تعذر تحميل نماذج الدرجات: ${queryError.message}`);
      else setForms(data || []);
      setFormsLoading(false);
    }

    loadForms();
    return () => { mounted = false; };
  }, [user]);

  async function loadSchools() {
    setSchoolsLoading(true);
    setSchoolsError("");
    const { data, error: queryError } = await supabase
      .from("profiles")
      .select("id, username, display_name, school_name, user_no, role, is_active, created_at")
      .eq("role", "user")
      .order("user_no", { ascending: true });

    if (queryError) setSchoolsError(`تعذر تحميل المدارس: ${queryError.message}`);
    else setSchools(data || []);
    setSchoolsLoading(false);
  }

  useEffect(() => {
    if (user?.role === "admin" && ["schools", "export", "forms", "students"].includes(activeSection)) loadSchools();
  }, [user, activeSection]);

  async function loadStudents(form = selectedForm) {
    if (!form || !user) return;
    const targetUserId = user.role === "admin" ? entrySchoolId : user.id;
    if (!targetUserId) { setStudents([]); return; }
    setStudentLoading(true);
    setStudentError("");
    const { data, error: queryError } = await supabase
      .from("submissions")
      .select("id, form_id, user_id, user_no, student_number, student_code, student_name, answers, created_at, updated_at")
      .eq("form_id", form.id)
      .eq("user_id", targetUserId)
      .order("student_number", { ascending: true });

    if (queryError) {
      setStudentError(`تعذر تحميل بيانات التلاميذ: ${queryError.message}`);
      setStudents([]);
    } else {
      setStudents(data || []);
    }
    setStudentLoading(false);
  }

  useEffect(() => {
    if (user && selectedForm && (user.role !== "admin" || entrySchoolId)) loadStudents(selectedForm);
    else setStudents([]);
  }, [user, selectedForm, entrySchoolId]);

  useEffect(() => {
    if (currentPage > 0) {
      const timer = setTimeout(() => document.querySelector("[data-grade-field]")?.focus(), 30);
      return () => clearTimeout(timer);
    }
  }, [currentPage]);

  function resetStudent() {
    setStudentNumber("");
    setStudentName("");
    setAnswers({});
    setEditingId(null);
    setCurrentStudentIndex(-1);
    setStudentError("");
    setStudentMessage("");
  }

  function chooseForm(form) {
    setSelectedForm(form);
    setActiveSection("students");
    setCurrentPage(0);
    resetStudent();
    setStudents([]);
  }

  function loadStudentRecord(record, index = -1) {
    setStudentNumber(String(record.student_number ?? ""));
    setStudentName(record.student_name || "");
    setAnswers(record.answers && typeof record.answers === "object" ? record.answers : {});
    setEditingId(record.id);
    setCurrentStudentIndex(index);
    setCurrentPage(0);
    setStudentError("");
    setStudentMessage("");
  }

  function findStudent() {
    const term = searchNumber.trim();
    if (!term) {
      setStudentError("أدخل رقم التلميذ للبحث.");
      return;
    }
    const index = students.findIndex((s) => String(s.student_number) === term);
    if (index < 0) {
      resetStudent();
      setStudentNumber(term);
      setStudentError("لم يتم العثور على هذا التلميذ. يمكنك إدخال اسمه ودرجاته ثم الحفظ.");
      return;
    }
    loadStudentRecord(students[index], index);
  }

  function moveStudent(direction) {
    if (!students.length) return;
    const next = currentStudentIndex < 0
      ? (direction > 0 ? 0 : students.length - 1)
      : currentStudentIndex + direction;
    if (next < 0 || next >= students.length) {
      setStudentMessage("لا توجد سجلات أخرى في هذا الاتجاه.");
      return;
    }
    loadStudentRecord(students[next], next);
  }

  async function saveStudent() {
    setStudentError("");
    setStudentMessage("");

    if (!selectedForm || !user) return;
    const number = studentNumber.trim();
    const name = studentName.trim();
    if (!number || !name) {
      setStudentError("يرجى إدخال رقم التلميذ واسم التلميذ.");
      setCurrentPage(0);
      return;
    }
    if (!/^\d+$/.test(number)) {
      setStudentError("رقم التلميذ يجب أن يتكون من أرقام فقط.");
      setCurrentPage(0);
      return;
    }

    const targetSchool = user.role === "admin" ? schools.find((school) => String(school.id) === String(entrySchoolId)) : null;
    if (user.role === "admin" && !targetSchool) {
      setStudentError("اختر المدرسة أولاً قبل إدخال الدرجات.");
      return;
    }
    setStudentLoading(true);
    const targetUserId = targetSchool?.id || user.id;
    const payload = {
      form_id: selectedForm.id,
      user_id: targetUserId,
      user_no: targetSchool?.user_no || user.user_no,
      student_number: number,
      student_name: name,
      answers,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (editingId) {
      result = await supabase
        .from("submissions")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", targetUserId)
        .select()
        .single();
    } else {
      result = await supabase
        .from("submissions")
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single();
    }

    setStudentLoading(false);
    if (result.error) {
      console.error("Save student error:", result.error);
      if (result.error.code === "23505") {
        setStudentError("رقم التلميذ مسجل مسبقًا وفق قيد قاعدة البيانات الحالي. يلزم تعديل القيد الفريد ليكون خاصًا بالمدرسة والنموذج قبل استخدام النظام مع عدة مدارس.");
      } else {
        setStudentError(`تعذر حفظ البيانات: ${result.error.message}`);
      }
      return;
    }

    setStudentMessage("تم حفظ بيانات التلميذ بنجاح.");
    const { data: refreshed, error: refreshError } = await supabase
      .from("submissions")
      .select("id, form_id, user_id, user_no, student_number, student_code, student_name, answers, created_at, updated_at")
      .eq("form_id", selectedForm.id)
      .eq("user_id", targetUserId)
      .order("student_number", { ascending: true });
    if (!refreshError) {
      const list = refreshed || [];
      setStudents(list);
      const idx = list.findIndex((s) => s.id === result.data.id);
      setEditingId(result.data.id);
      setCurrentStudentIndex(idx);
    }
  }

  async function downloadExcel() {
    setExportError("");
    setExportMessage("");
    const chosenForms = forms.filter((form) => exportFormIds.includes(String(form.id)));
    if (!chosenForms.length) { setExportError("اختر صفًا دراسيًا واحدًا على الأقل."); return; }

    let targetSchools;
    if (isAdmin) {
      targetSchools = schools.filter((school) => exportSchoolIds.includes(String(school.id)));
      if (!targetSchools.length) { setExportError("اختر مدرسة واحدة على الأقل."); return; }
    } else {
      targetSchools = [{ id: user.id, school_name: user.school_name || user.username, user_no: user.user_no }];
    }

    setExportLoading(true);
    try {
      const worksheets = [];
      let totalStudents = 0;
      for (const school of targetSchools) {
        for (const form of chosenForms) {
          const { data, error: queryError } = await supabase
            .from("submissions")
            .select("student_number, student_code, student_name, answers")
            .eq("form_id", form.id)
            .eq("user_id", school.id)
            .order("student_number", { ascending: true });
          if (queryError) throw queryError;
          totalStudents += (data || []).length;
          const layout = getPages(form) || [];
          const columns = [
            { title: "رقم التلميذ", key: "student_number" },
            { title: "كود التلميذ", key: "student_code" },
            { title: "اسم التلميذ", key: "student_name" },
          ];
          layout.forEach((page, pageIndex) => {
            if (pageIndex === 0) return;
            makeFieldLabels(form, pageIndex, page.count).forEach((label, fieldIndex) => {
              columns.push({ title: `${page.title} - ${label}`, key: `p${pageIndex}_f${fieldIndex + 1}` });
            });
          });
          const cell = (value, style = 4) => `<Cell ss:StyleID="s${style}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
          let rows = `<Row>${cell(`بيانات ${form.name} - ${school.school_name || school.username}`, 1)}</Row>`;
          rows += `<Row>${cell(`عدد التلاميذ: ${(data || []).length} | تاريخ التصدير: ${new Date().toLocaleDateString("ar-EG")}`, 3)}</Row>`;
          rows += `<Row>${columns.map((column) => cell(column.title, 2)).join("")}</Row>`;
          (data || []).forEach((record, index) => {
            const answerValues = record.answers && typeof record.answers === "object" ? record.answers : {};
            rows += `<Row>${columns.map((column) => cell(column.key.startsWith("p") ? answerValues[column.key] : record[column.key], index % 2 ? 3 : 4)).join("")}</Row>`;
          });
          if (!(data || []).length) rows += `<Row>${cell("لا توجد بيانات مسجلة لهذا الصف.", 3)}</Row>`;
          const sheetName = safeFileName(`${school.user_no || ""}-${form.name}`).slice(0, 31) || "الدرجات";
          worksheets.push(`<Worksheet ss:Name="${escapeXml(sheetName)}"><Table>${rows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><DisplayRightToLeft/><PageSetup><Layout x:Orientation="Landscape"/></PageSetup></WorksheetOptions></Worksheet>`);
        }
      }
      const workbook = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style><Style ss:ID="s1"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#526D82" ss:Pattern="Solid"/></Style><Style ss:ID="s2"><Alignment ss:Horizontal="Center"/><Font ss:FontName="Arial" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#8AA6A3" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#607D8B"/></Borders></Style><Style ss:ID="s3"><Alignment ss:Horizontal="Center"/><Font ss:FontName="Arial" ss:Color="#263746"/><Interior ss:Color="#EAF0EF" ss:Pattern="Solid"/></Style><Style ss:ID="s4"><Alignment ss:Horizontal="Center"/><Font ss:FontName="Arial" ss:Color="#263746"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style></Styles>${worksheets.join("")}</Workbook>`;
      const blob = new Blob(["\ufeff", workbook], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeFileName(isAdmin ? "بيانات-المدارس" : (user.school_name || user.username))}-الصفوف-المختارة.xls`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setExportMessage(`تم تجهيز ملف Excel بعدد ${worksheets.length} ورقة، ويحتوي على ${totalStudents} سجلًا.`);
    } catch (err) {
      console.error("Excel export error:", err);
      setExportError(`تعذر تنزيل البيانات: ${err.message || "حدث خطأ غير معروف."}`);
    } finally { setExportLoading(false); }
  }

  async function handleCreateSchool(e) {
    e.preventDefault();
    setSchoolError("");
    setSchoolMessage("");

    const cleanUsername = schoolUsername.trim();
    const cleanUserNo = schoolUserNo.trim();
    if (!cleanUsername || !schoolPassword || !schoolDisplayName.trim() || !schoolName.trim() || !cleanUserNo) {
      setSchoolError("يرجى إدخال جميع البيانات.");
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
      setSchoolError("اسم المستخدم يجب أن يتكون من 3 إلى 30 حرفًا إنجليزيًا أو رقمًا أو _.");
      return;
    }
    if (schoolPassword.length < 12) {
      setSchoolError("كلمة المرور يجب ألا تقل عن 12 حرفًا.");
      return;
    }
    if (!/^\d{3}$/.test(cleanUserNo) || cleanUserNo === "000") {
      setSchoolError("رقم المدرسة يجب أن يكون ثلاث خانات من 001 إلى 035.");
      return;
    }
    if (Number(cleanUserNo) > 35) {
      setSchoolError("رقم المدرسة يجب أن يكون بين 001 و035.");
      return;
    }

    setSchoolLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("manage-schools", {
        body: {
          username: cleanUsername,
          password: schoolPassword,
          display_name: schoolDisplayName.trim(),
          school_name: schoolName.trim(),
          user_no: cleanUserNo,
        },
      });
      if (fnError) {
        let detail = "";
        try {
          const response = fnError.context;
          if (response && typeof response.clone === "function") {
            const body = await response.clone().json();
            detail = body?.error || "";
          }
        } catch {}
        throw new Error(detail || fnError.message || "تعذر الاتصال بخدمة إنشاء الحساب.");
      }
      if (data?.error) throw new Error(data.error);
      setSchoolMessage(data?.message || "تم إنشاء حساب المدرسة بنجاح.");
      setSchoolUsername("");
      setSchoolPassword("");
      setSchoolDisplayName("");
      setSchoolName("");
      setSchoolUserNo("");
      await loadSchools();
    } catch (err) {
      console.error("Create school error:", err);
      setSchoolError(err.message || "تعذر إنشاء الحساب.");
    } finally {
      setSchoolLoading(false);
    }
  }

  async function toggleSchoolActive(school) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_active: !school.is_active })
      .eq("id", school.id);
    if (updateError) {
      setSchoolsError(`تعذر تحديث حالة المدرسة: ${updateError.message}`);
      return;
    }
    await loadSchools();
  }

  function startEditSchool(school) {
    setEditingSchool(school);
    setSchoolEditDisplayName(school.display_name || "");
    setSchoolEditName(school.school_name || "");
    setSchoolEditNo(String(school.user_no || ""));
    setSchoolsError("");
    setSchoolMessage("");
  }

  async function saveSchoolEdit(e) {
    e.preventDefault();
    if (!editingSchool) return;
    const cleanNo = schoolEditNo.trim();
    if (!/^0(0[1-9]|[1-2][0-9]|3[0-5])$/.test(cleanNo)) {
      setSchoolsError("رقم المدرسة يجب أن يكون من 001 إلى 035."); return;
    }
    setSchoolEditLoading(true);
    const { error: updateError } = await supabase.from("profiles").update({
      display_name: schoolEditDisplayName.trim(),
      school_name: schoolEditName.trim(),
      user_no: cleanNo,
    }).eq("id", editingSchool.id);
    setSchoolEditLoading(false);
    if (updateError) { setSchoolsError(`تعذر تعديل بيانات المدرسة: ${updateError.message}`); return; }
    // Keep the stored school number on its existing submissions in sync;
    // the generated student_code column is recalculated by PostgreSQL.
    const { error: submissionsError } = await supabase
      .from("submissions")
      .update({ user_no: cleanNo })
      .eq("user_id", editingSchool.id);
    if (submissionsError) {
      setSchoolsError(`تم تحديث بيانات المدرسة، لكن تعذر تحديث أرقامها في سجلات التلاميذ: ${submissionsError.message}`);
      await loadSchools();
      setSchoolEditLoading(false);
      return;
    }
    setEditingSchool(null);
    setSchoolMessage("تم تحديث بيانات المدرسة وسجلات تلاميذها.");
    await loadSchools();
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
      const { data, error: fnError } = await supabase.functions.invoke("username-login", {
        body: { username: cleanUsername, password },
      });
      if (fnError) {
        let detail = "";
        try {
          const response = fnError.context;
          if (response && typeof response.clone === "function") {
            const body = await response.clone().json();
            detail = body?.error || "";
          }
        } catch {}
        throw new Error(detail || fnError.message || "تعذر الاتصال بخدمة تسجيل الدخول.");
      }
      if (!data || data.error) throw new Error(data?.error || "استجابة تسجيل الدخول غير صحيحة.");
      if (!data.access_token || !data.refresh_token) throw new Error("استجابة تسجيل الدخول لا تحتوي على بيانات الجلسة.");

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw sessionError;

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error("تعذر التحقق من حساب المستخدم.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_no, school_name, role, username, is_active")
        .eq("id", authData.user.id)
        .single();
      if (profileError || !profile) throw profileError || new Error("تعذر تحميل بيانات الحساب.");
      if (profile.is_active === false) {
        await supabase.auth.signOut();
        throw new Error("هذا الحساب غير نشط. يرجى مراجعة مدير النظام.");
      }
      if (!["admin", "school", "user"].includes(profile.role)) {
        await supabase.auth.signOut();
        throw new Error("نوع الحساب غير معروف. يرجى مراجعة مدير النظام.");
      }

      sessionStorage.setItem("school-grades-tab-authenticated", "1");
      setUser({
        id: authData.user.id,
        username: profile.username || data.user?.username || cleanUsername,
        role: profile.role === "user" ? "school" : profile.role,
        user_no: profile.user_no,
        school_name: profile.school_name,
      });
      setActiveSection("home");
      setSelectedForm(null);
      setPassword("");
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "حدث خطأ أثناء تسجيل الدخول.");
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
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("رابط الاستعادة غير صالح أو انتهت صلاحيته.");
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      setRecoveryMode(false);
      setNewPassword("");
      setConfirmPassword("");
      setUsername("");
      setPassword("");
      setMessage("تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setError(err.message || "تعذر تغيير كلمة المرور.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    sessionStorage.removeItem("school-grades-tab-authenticated");
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) {
      setError("تعذر تسجيل الخروج. حاول مرة أخرى.");
      return;
    }
    setUser(null);
    setPassword("");
    setError("");
    setMessage("");
    setForms([]);
    setSelectedForm(null);
    setStudents([]);
    resetStudent();
    setActiveSection("home");
  }

  if (recoveryMode) {
    return (
      <main className="login-page" dir="rtl">
        <section className="login-card">
          <h1>نظام درجات التلاميذ</h1>
          <h2>تعيين كلمة مرور جديدة</h2>
          <p className="subtitle">أدخل كلمة المرور الجديدة وأعد كتابتها للتأكيد.</p>
          <form onSubmit={handlePasswordUpdate}>
            <label htmlFor="new-password">كلمة المرور الجديدة</label>
            <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
            <label htmlFor="confirm-password">تأكيد كلمة المرور</label>
            <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
            {error && <p className="error-message">{error}</p>}
            <button type="submit" disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور الجديدة"}</button>
          </form>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="login-page" dir="rtl">
        <section className="login-card">
          <h1>نظام درجات التلاميذ</h1>
          <p className="subtitle">منصة إدارة درجات التلاميذ بالمدارس</p>
          <div className="login-icon" aria-hidden="true">📚</div>
          <h2>تسجيل الدخول</h2>
          <form onSubmit={handleLogin}>
            <label htmlFor="username">اسم المستخدم</label>
            <input id="username" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="أدخل اسم المستخدم" required />
            <label htmlFor="password">كلمة المرور</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="أدخل كلمة المرور" required />
            {error && <p className="error-message">{error}</p>}
            {message && <p role="status">{message}</p>}
            <button type="submit" disabled={loading}>{loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}</button>
          </form>
          <p className="footer-text">نظام إلكتروني لإدارة درجات التلاميذ</p>
        </section>
      </main>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <main className="dashboard" dir="rtl">
      <header className="dashboard-header">
        <div>
          <h1>نظام درجات التلاميذ</h1>
          <p>{isAdmin ? "لوحة تحكم مدير النظام" : `المدرسة: ${user.school_name || user.username}`}</p>
        </div>
        <div className="admin-info">
          <span>{isAdmin ? `مدير النظام: ${user.username}` : `رقم المدرسة: ${String(user.user_no || "").padStart(3, "0")}`}</span>
          <button className="logout-button" onClick={handleLogout}>تسجيل الخروج</button>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="sidebar">
          <h3>القائمة الرئيسية</h3>
          <button className={activeSection === "home" ? "active" : ""} onClick={() => { setActiveSection("home"); setSelectedForm(null); }}>
            <span>🏠</span> الرئيسية
          </button>

          {isAdmin ? (
            <>
              <button className={activeSection === "schools" ? "active" : ""} onClick={() => setActiveSection("schools")}><span>🏫</span> إدارة المدارس</button>
              <button className={activeSection === "forms" ? "active" : ""} onClick={() => setActiveSection("forms")}><span>📋</span> نماذج الدرجات</button>
              <button className={activeSection === "students" ? "active" : ""} onClick={() => setActiveSection("students")}><span>👨‍🎓</span> ملفات إدخال الدرجات</button>
            </>
          ) : (
            <>
              <button className={activeSection === "forms" ? "active" : ""} onClick={() => setActiveSection("forms")}><span>📋</span> نماذج الدرجات</button>
              <button className={activeSection === "students" ? "active" : ""} onClick={() => setActiveSection("students")}><span>👨‍🎓</span> بيانات التلاميذ</button>
            </>
          )}
          <button className={activeSection === "export" ? "active" : ""} onClick={() => { setExportError(""); setExportMessage(""); setActiveSection("export"); }}><span>📥</span> تنزيل بيانات Excel</button>
        </aside>

        <section className="main-content">
          {activeSection === "home" && (
            <>
              <div className="page-heading">
                <h2>{isAdmin ? "مرحبًا بك، مدير النظام" : `مرحبًا بك في ${user.school_name || "حساب المدرسة"}`}</h2>
                <p>{isAdmin ? "من هنا يمكنك إدارة حسابات المدارس ومراجعة نماذج الدرجات." : "اختر نموذج الصف لبدء إدخال بيانات التلاميذ ودرجاتهم."}</p>
              </div>
              <div className="dashboard-cards">
                {isAdmin ? (
                  <>
                    <button className="dashboard-card blue" onClick={() => setActiveSection("schools")}><span className="card-icon">🏫</span><h3>إدارة المدارس</h3><p>إنشاء حسابات المدارس وتفعيلها أو إيقافها.</p></button>
                    <button className="dashboard-card green" onClick={() => setActiveSection("forms")}><span className="card-icon">📋</span><h3>نماذج الدرجات</h3><p>فتح ملفات إدخال الدرجات ومراجعتها للمدارس.</p></button>
                  </>
                ) : (
                  <button className="dashboard-card blue" onClick={() => setActiveSection("forms")}><span className="card-icon">📋</span><h3>نماذج الدرجات</h3><p>اختر الصف المطلوب لإدخال الدرجات.</p></button>
                )}
              </div>
            </>
          )}

          {activeSection === "export" && (
            <>
              <div className="page-heading">
                <h2>تنزيل بيانات Excel</h2>
                <p>{isAdmin ? "اختر المدرسة والصف لتنزيل ملف مستقل ببيانات الفصل." : "اختر الصف لتنزيل بيانات تلاميذ مدرستك فقط."}</p>
              </div>
              <div className="dashboard-card" style={{ maxWidth: 720 }}>
                {isAdmin && (
                  <div className="choice-group">
                    <label>المدارس (يمكن اختيار أكثر من مدرسة)</label>
                    {schools.map((school) => <label className="choice-item" key={school.id}><input type="checkbox" checked={exportSchoolIds.includes(String(school.id))} onChange={(e) => setExportSchoolIds((old) => e.target.checked ? [...old, String(school.id)] : old.filter((id) => id !== String(school.id)))} />{school.school_name || school.display_name || school.username} - {String(school.user_no || "").padStart(3, "0")}</label>)}
                    {schoolsLoading && <p>جارٍ تحميل قائمة المدارس...</p>}
                    {schoolsError && <p className="error-message">{schoolsError}</p>}
                  </div>
                )}
                <div className="choice-group">
                  <label>الفصول الدراسية (يمكن اختيار أكثر من فصل)</label>
                  {forms.map((form) => <label className="choice-item" key={form.id}><input type="checkbox" checked={exportFormIds.includes(String(form.id))} onChange={(e) => setExportFormIds((old) => e.target.checked ? [...old, String(form.id)] : old.filter((id) => id !== String(form.id)))} />{form.name}</label>)}
                </div>
                {exportError && <p className="error-message">{exportError}</p>}
                {exportMessage && <p className="notice">{exportMessage}</p>}
                <button type="button" onClick={downloadExcel} disabled={exportLoading || formsLoading || (isAdmin && schoolsLoading)} style={{ marginTop: 18 }}>
                  {exportLoading ? "جارٍ تجهيز ملف Excel..." : "تنزيل ملف Excel"}
                </button>
                <p className="subtitle" style={{ marginTop: 14 }}>يتضمن الملف أرقام التلاميذ وأكوادهم وأسماءهم وجميع درجات الأسئلة، مع تنسيق عربي وألوان وخطوط وحدود للجدول.</p>
              </div>
            </>
          )}

          {activeSection === "schools" && isAdmin && (
            <>
              <div className="page-heading"><h2>إدارة المدارس</h2><p>إنشاء حسابات المدارس ومتابعة حالة تفعيلها.</p></div>
              <div className="dashboard-card">
                <h3>إضافة مدرسة جديدة</h3>
                <form onSubmit={handleCreateSchool}>
                  <label>اسم المستخدم</label>
                  <input value={schoolUsername} onChange={(e) => setSchoolUsername(e.target.value)} placeholder="مثال: school001" required />
                  <label>كلمة المرور (12 حرفًا على الأقل)</label>
                  <input type="password" value={schoolPassword} onChange={(e) => setSchoolPassword(e.target.value)} minLength={12} required />
                  <label>اسم مسؤول المدرسة</label>
                  <input value={schoolDisplayName} onChange={(e) => setSchoolDisplayName(e.target.value)} required />
                  <label>اسم المدرسة</label>
                  <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required />
                  <label>رقم المدرسة (001 إلى 035)</label>
                  <input value={schoolUserNo} onChange={(e) => setSchoolUserNo(e.target.value)} inputMode="numeric" maxLength={3} placeholder="001" required />
                  {schoolError && <p className="error-message">{schoolError}</p>}
                  {schoolMessage && <p className="notice">{schoolMessage}</p>}
                  <button type="submit" disabled={schoolLoading}>{schoolLoading ? "جارٍ إنشاء الحساب..." : "إنشاء حساب المدرسة"}</button>
                </form>
              </div>

              <div className="page-heading"><h3>المدارس المسجلة</h3></div>
              {schoolsLoading && <p>جارٍ تحميل المدارس...</p>}
              {schoolsError && <p className="error-message">{schoolsError}</p>}
              {!schoolsLoading && schools.length === 0 && <p>لا توجد مدارس مسجلة حتى الآن.</p>}
              {schools.map((school) => (
                <div className="dashboard-card" key={school.id} style={{ marginBottom: 12 }}>
                  <h3>{school.school_name || school.display_name || school.username}</h3>
                  <p>اسم المستخدم: {school.username} — رقم المدرسة: {school.user_no}</p>
                  <p>الحالة: {school.is_active ? "نشط" : "موقوف"}</p>
                  <div className="button-row">
                    <button type="button" onClick={() => startEditSchool(school)}>تعديل بيانات المدرسة</button>
                    <button type="button" className="secondary-button" onClick={() => toggleSchoolActive(school)}>{school.is_active ? "إيقاف الحساب" : "تفعيل الحساب"}</button>
                  </div>
                  {editingSchool?.id === school.id && (
                    <form className="school-edit-form" onSubmit={saveSchoolEdit}>
                      <label>اسم مسؤول المدرسة</label>
                      <input value={schoolEditDisplayName} onChange={(e) => setSchoolEditDisplayName(e.target.value)} required />
                      <label>اسم المدرسة</label>
                      <input value={schoolEditName} onChange={(e) => setSchoolEditName(e.target.value)} required />
                      <label>رقم المدرسة (001 إلى 035)</label>
                      <input value={schoolEditNo} onChange={(e) => setSchoolEditNo(e.target.value)} maxLength={3} inputMode="numeric" required />
                      <p className="subtitle">اسم المستخدم وكلمة المرور لا يتغيران من هذه الشاشة.</p>
                      <div className="button-row"><button type="submit" disabled={schoolEditLoading}>{schoolEditLoading ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button><button type="button" className="secondary-button" onClick={() => setEditingSchool(null)}>إلغاء</button></div>
                    </form>
                  )}
                </div>
              ))}
            </>
          )}

          {activeSection === "forms" && (
            <>
              <div className="page-heading"><h2>نماذج الدرجات</h2><p>{isAdmin ? "اختر نموذج الصف ثم المدرسة لعرض ملف إدخال الدرجات." : "اختر نموذج الصف الذي تريد تسجيل درجاته."}</p></div>
              {formsLoading && <p>جارٍ تحميل النماذج...</p>}
              {formsError && <p className="error-message">{formsError}</p>}
              {!formsLoading && !formsError && forms.length === 0 && <p>لا توجد نماذج نشطة في قاعدة البيانات.</p>}
              <div className="dashboard-cards">
                {forms.map((form) => (
                  <button className="dashboard-card green" key={form.id} onClick={() => chooseForm(form)}>
                    <span className="card-icon">📋</span>
                    <h3>{form.name}</h3>
                    <p>الصف الدراسي: {form.grade_level || "غير محدد"}</p>
                    <span className="form-status">{isAdmin ? "نموذج نشط" : "فتح النموذج"}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeSection === "students" && (
            <>
              <div className="page-heading">
                <h2>بيانات التلاميذ</h2>
                {selectedForm ? <p>النموذج الحالي: {selectedForm.name}</p> : <p>اختر نموذجاً من قسم نماذج الدرجات أولاً.</p>}
              </div>

              {isAdmin && (
                <div className="dashboard-card school-entry-picker">
                  <label htmlFor="entry-school">المدرسة المطلوب إدخال أو مراجعة درجاتها</label>
                  <select id="entry-school" value={entrySchoolId} onChange={(e) => { setEntrySchoolId(e.target.value); resetStudent(); }}>
                    <option value="">اختر المدرسة</option>
                    {schools.map((school) => <option key={school.id} value={school.id}>{school.school_name || school.display_name || school.username} - {String(school.user_no || "").padStart(3, "0")}</option>)}
                  </select>
                  {schoolsLoading && <p>جارٍ تحميل المدارس...</p>}
                  {schoolsError && <p className="error-message">{schoolsError}</p>}
                </div>
              )}
              {selectedForm && (!isAdmin || entrySchoolId) && (
                <>
                  <div className="dashboard-card" style={{ marginBottom: 18 }}>
                    <label>النموذج المحدد</label>
                    <select value={selectedForm.id} onChange={(e) => {
                      const form = forms.find((f) => String(f.id) === e.target.value);
                      if (form) chooseForm(form);
                    }}>
                      {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                      <input value={searchNumber} onChange={(e) => setSearchNumber(e.target.value)} placeholder="رقم التلميذ للبحث" />
                      <button type="button" onClick={findStudent}>بحث</button>
                      <button type="button" onClick={() => { resetStudent(); setSearchNumber(""); }}>تلميذ جديد</button>
                    </div>
                  </div>

                  {studentLoading && <p>جارٍ تنفيذ العملية...</p>}
                  {studentError && <p className="error-message">{studentError}</p>}
                  {studentMessage && <p className="notice">{studentMessage}</p>}

                  <div className="dashboard-card">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <h3>{pages?.[currentPage]?.title || "بيانات التلميذ"}</h3>
                      <span>صفحة {currentPage + 1} من {pages?.length || 1}</span>
                    </div>

                    {currentPage === 0 ? (
                      <>
                        <label htmlFor="student-number">رقم التلميذ</label>
                        <input id="student-number" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} inputMode="numeric" placeholder={`يبدأ من ${selectedForm.starting_student_number || ""}`} />
                        <label htmlFor="student-name">اسم التلميذ</label>
                        <input id="student-name" value={studentName} onChange={(e) => setStudentName(e.target.value)} onKeyDown={(e) => { if (e.key === "Tab" && !e.shiftKey && pages?.length > 1) { e.preventDefault(); setCurrentPage(1); setTimeout(() => document.querySelector("[data-grade-field]")?.focus(), 0); } }} placeholder="اكتب اسم التلميذ" />
                      </>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(${pages?.[currentPage]?.columns || 3}, minmax(0, 1fr))`, gap: 12 }}>
                        {makeFieldLabels(selectedForm, currentPage, pages?.[currentPage]?.count || 0).map((label, index) => {
                          const key = `p${currentPage}_f${index + 1}`;
                          return (
                            <div key={key}>
                              <label htmlFor={key}>{label}</label>
                              <input id={key} data-grade-field value={answers[key] ?? ""} onChange={(e) => setAnswers((prev) => ({ ...prev, [key]: e.target.value }))} onKeyDown={(e) => { const last = index === (pages?.[currentPage]?.count || 0) - 1; if (e.key === "Tab" && !e.shiftKey && last) { if (currentPage < (pages?.length || 1) - 1) { e.preventDefault(); setCurrentPage((p) => p + 1); setTimeout(() => document.querySelector("[data-grade-field]")?.focus(), 0); } else { e.preventDefault(); document.getElementById("save-student-button")?.focus(); } } }} inputMode="decimal" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 22 }}>
                      <button type="button" disabled={currentPage === 0} onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}>السابق</button>
                      {currentPage < (pages?.length || 1) - 1 && <button type="button" onClick={() => setCurrentPage((p) => Math.min((pages?.length || 1) - 1, p + 1))}>التالي</button>}
                      {currentPage === (pages?.length || 1) - 1 && <button id="save-student-button" type="button" onClick={saveStudent} disabled={studentLoading}>{studentLoading ? "جارٍ الحفظ..." : editingId ? "تحديث بيانات التلميذ" : "حفظ بيانات التلميذ"}</button>}
                      <button type="button" onClick={() => moveStudent(-1)} disabled={!students.length}>التلميذ السابق</button>
                      <button type="button" onClick={() => moveStudent(1)} disabled={!students.length}>التلميذ التالي</button>
                    </div>
                  </div>
                  <p className="page-heading">عدد السجلات المحفوظة في هذا النموذج: {students.length}</p>
                </>
              )}
            </>
          )}
        </section>
      </div>

      <footer className="dashboard-footer">نظام إلكتروني لإدارة درجات التلاميذ</footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
