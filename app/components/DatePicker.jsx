"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, isHoliday, parseYmd, ymd } from "../data";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Calendar where Saturdays, Sundays and past days cannot be chosen.
export default function DatePicker({ value, onChange }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => { const d = value ? parseYmd(value) : new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))];
  const canPrev = view > new Date(today.getFullYear(), today.getMonth(), 1);

  return (
    <div className="datepick" ref={ref}>
      <button type="button" className="date-btn" onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open}>
        {value ? fmtDate(value) : "Choose a date"}
      </button>
      {open && (
        <div className="cal" role="dialog" aria-label="Choose release date">
          <div className="cal-head">
            <button type="button" disabled={!canPrev} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} aria-label="Previous month">‹</button>
            <b>{view.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} aria-label="Next month">›</button>
          </div>
          <div className="cal-grid">
            {DOW.map(d => <span key={d} className={`cal-dow ${d === "Sat" || d === "Sun" ? "off" : ""}`}>{d}</span>)}
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />;
              const holiday = isHoliday(d), past = d < today, key = ymd(d);
              return (
                <button type="button" key={key} disabled={holiday || past}
                  title={holiday ? "Weekend — holiday" : past ? "Past date" : ""}
                  className={`cal-day ${key === value ? "sel" : ""} ${holiday ? "holiday" : ""} ${key === ymd(today) ? "today" : ""}`}
                  onClick={() => { onChange(key); setOpen(false); }}>{d.getDate()}</button>
              );
            })}
          </div>
          <p className="cal-note">Saturday &amp; Sunday are holidays — releases can't be scheduled on them.</p>
        </div>
      )}
    </div>
  );
}
