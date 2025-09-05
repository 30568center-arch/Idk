import React, { useEffect, useMemo, useRef, useState } from "react";

// ================= Constants =================
const LS_KEY = "dutyScheduler:data:v3";
const THEME = {
  primary: "bg-green-600",
  primaryHover: "hover:bg-green-700",
  secondary: "bg-yellow-400",
  light: "bg-green-50",
  danger: "bg-red-500 hover:bg-red-600",
};

const DEFAULT_CLASSES = [
  {
    id: "6A",
    name: "ม.6/1",
    students: [
      { id: "601", name: "ก้อง" },
      { id: "602", name: "มายด์" },
      { id: "603", name: "ฟ้าใส" },
      { id: "604", name: "เบลล์" },
    ],
    posts: ["กวาดพื้น", "ถูพื้น", "เช็ดโต๊ะ"],
  },
  {
    id: "6B",
    name: "ม.6/2",
    students: [
      { id: "605", name: "ปัน" },
      { id: "606", name: "ตาล" },
      { id: "607", name: "ภูมิ" },
    ],
    posts: ["กวาดพื้น", "ถูพื้น", "เช็ดโต๊ะ"],
  },
];

const DEFAULT_TEACHERS = [
  { id: "T001", name: "ครูสมชาย" },
  { id: "T002", name: "ครูมุสลิมา" },
];

// ================= Utils =================
const uid = () => Math.random().toString(36).slice(2, 9);

const formatISODate = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const thaiDate = (d) =>
  new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);

const getISODay = (d) => {
  const day = d.getDay();
  return day === 0 ? 7 : day;
};

const startOfWeek = (date) => {
  const d = new Date(date);
  d.setDate(d.getDate() - (getISODay(d) - 1));
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

// Deterministic rotation index
const rotationIndex = (date, seed = 0) => {
  const base = Math.floor(new Date(date).getTime() / (1000 * 60 * 60 * 24));
  const x = ((base + seed) * 2654435761) % 2 ** 32;
  return x >>> 0;
};

// Map posts -> students
const buildAssignment = (students, posts, date, mode = "daily") => {
  const list = students.filter(Boolean);
  if (!list.length || !posts.length) return {};
  const seed = mode === "weekly" ? Math.floor(new Date(date).getTime() / (1000 * 60 * 60 * 24 * 7)) : 0;
  const r = rotationIndex(date, seed);
  const assignments = {};
  posts.forEach((post, i) => {
    const idx = (r + i) % list.length;
    assignments[post] = list[idx];
  });
  return assignments;
};

// ================= Reusable UI =================
function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`px-3 py-2 rounded-2xl text-white ${THEME.primary} ${THEME.primaryHover} disabled:opacity-50 disabled:cursor-not-allowed shadow ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function IconButton({ label, onClick, className = "" }) {
  return (
    <button
      aria-label={label}
      className={`px-2 py-1 rounded-xl border text-sm hover:bg-gray-50 active:scale-[0.98] transition ${className}`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {label}
    </button>
  );
}

function Modal({ open, title, children, onClose, actions }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="px-2 py-1 rounded-lg hover:bg-gray-100" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
        <div className="flex items-center gap-2 justify-end px-4 pb-4">{actions}</div>
      </div>
    </div>
  );
}

function Section({ title, right, children, className = "" }) {
  return (
    <section className={`rounded-2xl bg-white shadow p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function SelectStudent({ students, value, onChange, disabled }) {
  return (
    <select
      className="border rounded-xl px-3 py-2 w-full"
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {students.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

function ListWithInlineAdd({ items, getKey, render, onAdd, onDelete, disabled }) {
  const [name, setName] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="border rounded-xl px-3 py-2 flex-1"
          placeholder="พิมพ์ชื่อแล้วกดเพิ่ม"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim() && !disabled) {
              onAdd(name.trim());
              setName("");
            }
          }}
          disabled={disabled}
        />
        <Button
          onClick={() => {
            if (!name.trim() || disabled) return;
            onAdd(name.trim());
            setName("");
          }}
          disabled={disabled}
        >
          เพิ่ม
        </Button>
      </div>
      <ul className="space-y-2 max-h-64 overflow-auto">
        {items.map((it) => (
          <li key={getKey(it)} className="flex items-center justify-between gap-3 border rounded-xl px-3 py-2">
            {render(it)}
            <button className="text-sm text-red-600" onClick={() => !disabled && onDelete(getKey(it))} disabled={disabled}>
              ลบ
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ================= Main App =================
export default function SchoolDutyApp() {
  // Core state
  const [classes, setClasses] = useState(DEFAULT_CLASSES);
  const [teachers, setTeachers] = useState(DEFAULT_TEACHERS);
  const [role, setRole] = useState("admin");
  const [focusedClassId, setFocusedClassId] = useState(DEFAULT_CLASSES[0].id);

  // Date/View
  const [viewMode, setViewMode] = useState("day");
  const [dateStr, setDateStr] = useState(formatISODate(new Date()));
  const date = useMemo(() => new Date(dateStr + "T00:00:00"), [dateStr]);

  // Modal
  const [modal, setModal] = useState({ open: false, title: "", content: null, actions: null });

  // Toast
  const [toasts, setToasts] = useState([]);
  const toast = (msg) => {
    const id = uid();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  };

  // Custom swap assignments
  const [customSwaps, setCustomSwaps] = useState({});

  // File import
  const fileRef = useRef(null);

  // Derived
  const currentClass = useMemo(() => classes.find((c) => c.id === focusedClassId) || classes[0], [classes, focusedClassId]);
  const assignmentsForDate = useMemo(() => {
    if (!currentClass) return {};
    return buildAssignment(currentClass.students, currentClass.posts, date, viewMode === "week" ? "weekly" : "daily");
  }, [currentClass, date, viewMode]);
  const weekDays = useMemo(() => [0, 1, 2, 3, 4].map((i) => addDays(startOfWeek(date), i)), [date]);
  const shareURL = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("class", currentClass?.id || "");
    return url.toString();
  }, [currentClass]);

  // ===== Effects =====
  // Load from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data.classes) setClasses(data.classes);
        if (data.teachers) setTeachers(data.teachers);
        if (data.focusedClassId) setFocusedClassId(data.focusedClassId);
      } catch (e) {
        console.warn("Failed to parse local data",
