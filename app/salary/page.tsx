"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { MONTHS, computeSlip } from "@/lib/salary";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

type Employee = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  department: string | null;
  status: string | null;
  basicSalary: number | null;
  conveyance: number | null;
  houseRentPercent: number | null;
  medicalPercent: number | null;
  incomeTaxPercent: number | null;
  eobiEmployeePercent: number | null;
  eobiEmployerPercent: number | null;
};

type RowState = {
  emp: Employee;
  overtime: string;
  otherDeduction: string;
  daysPresent: number;
  daysAbsent: number;
  daysLeave: number;
  weekOffs: number;
  attLoaded: boolean;
  slipId?: number;
};

const fmt = (n: number) => n.toLocaleString("en-PK");

export default function SalaryGeneratorPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [month, setMonth] = useState<string>(MONTHS[new Date().getMonth()]);
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [search, setSearch] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [rows, setRows] = useState<RowState[]>([]);
  const [printSelected, setPrintSelected] = useState<Set<number>>(new Set());
  const [loadingAtt, setLoadingAtt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/employees").then(r => r.json()).then(d => Array.isArray(d) ? setEmployees(d) : null).catch(() => {});
  }, []);

  const activeEmployees = useMemo(() => employees.filter(e => (e.status || "active") === "active"), [employees]);

  const filtered = useMemo(() => {
    if (!search.trim()) return activeEmployees;
    const q = search.toLowerCase();
    return activeEmployees.filter(e =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      e.employeeId.toLowerCase().includes(q) ||
      (e.department || "").toLowerCase().includes(q)
    );
  }, [activeEmployees, search]);

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };
  const selectAll = () => setSelectedIds(new Set(filtered.map(e => e.id)));
  const clearAll = () => setSelectedIds(new Set());

  const loadAttendance = async (empDbId: number, mIdx: number, y: number): Promise<{present:number;absent:number;leave:number;weekOffs:number}> => {
    const from = `${y}-${String(mIdx + 1).padStart(2, "0")}-01`;
    const last = new Date(y, mIdx + 1, 0).getDate();
    const to = `${y}-${String(mIdx + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    try {
      const res = await fetch(`/api/attendance?from=${from}&to=${to}&employeeId=${empDbId}`);
      const data = await res.json();
      if (!Array.isArray(data)) return { present: 0, absent: 0, leave: 0, weekOffs: 0 };
      let present = 0, absent = 0, leave = 0, weekOffs = 0;
      for (const r of data) {
        if (r.status === "present" || r.status === "half-day") present++;
        else if (r.status === "absent") absent++;
        else if (r.status === "leave") leave++;
        else if (r.status === "week-off") weekOffs++;
      }
      return { present, absent, leave, weekOffs };
    } catch { return { present: 0, absent: 0, leave: 0, weekOffs: 0 }; }
  };

  const buildRows = async () => {
    setError(null); setSuccess(null);
    if (selectedIds.size === 0) { setError("Select at least one employee."); return; }
    setLoadingAtt(true);
    const mIdx = MONTHS.indexOf(month);
    const selectedEmps = activeEmployees.filter(e => selectedIds.has(e.id));
    const newRows: RowState[] = [];
    for (const emp of selectedEmps) {
      const att = await loadAttendance(emp.id, mIdx, year);
      newRows.push({
        emp,
        overtime: "0",
        otherDeduction: "0",
        daysPresent: att.present,
        daysAbsent: att.absent,
        daysLeave: att.leave,
        weekOffs: att.weekOffs,
        attLoaded: true,
      });
    }
    setRows(newRows);
    setLoadingAtt(false);
  };

  const updateRow = (i: number, key: keyof RowState, value: any) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: value } : r));
  };

  const computeRow = (r: RowState) => computeSlip({
    basicSalary: Number(r.emp.basicSalary || 0),
    conveyance: Number(r.emp.conveyance || 0),
    incomeTaxPercent: Number(r.emp.incomeTaxPercent || 0),
    eobiEmployeePercent: Number(r.emp.eobiEmployeePercent || 0),
    accommodation: Number((r.emp as any).accommodation || 0),
    food: Number((r.emp as any).food || 0),
    overtime: parseInt(r.overtime) || 0,
    otherDeduction: parseInt(r.otherDeduction) || 0,
    daysPresent: r.daysPresent,
    daysAbsent: r.daysAbsent,
    daysLeave: r.daysLeave,
  });

  const generate = async () => {
    setError(null); setSuccess(null); setSaving(true);
    try {
      const slips = rows.map(r => ({
        employeeId: r.emp.id,
        month, year,
        overtime: parseInt(r.overtime) || 0,
        otherDeduction: parseInt(r.otherDeduction) || 0,
        daysPresent: r.daysPresent,
        daysAbsent: r.daysAbsent,
        daysLeave: r.daysLeave,
        weekOffs: r.weekOffs,
      }));
      const res = await fetch("/api/salary-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slips }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Failed to save"); }
      const data = await res.json();
      // API returns either a single object (1 slip) or { slips: [...] } (bulk)
      const saved: any[] = Array.isArray(data?.slips) ? data.slips : [data];
      const byEmp = new Map<number, number>();
      for (const s of saved) if (s?.employeeId && s?.id) byEmp.set(s.employeeId, s.id);
      const updated = rows.map(r => ({ ...r, slipId: byEmp.get(r.emp.id) ?? r.slipId }));
      setRows(updated);
      // Auto-tick all newly-saved slips for printing
      setPrintSelected(new Set(updated.map(r => r.slipId).filter((x): x is number => !!x)));
      setSuccess(`Generated ${rows.length} slip${rows.length === 1 ? "" : "s"} for ${month} ${year}. Tick the ones you want and click Print Selected.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const totalNet = rows.reduce((s, r) => s + computeRow(r).netPay, 0);
  const totalGross = rows.reduce((s, r) => s + computeRow(r).grossEarnings, 0);

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Generate Salary Slips</h1>
        <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4 }}>
          Pick a month, select employees, and generate. Slips use each employee's salary structure from their profile.
        </p>
      </div>

      {/* Period + employee selector */}
      <div className="card" style={{ padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "180px 140px 1fr", gap: 12, alignItems: "end", marginBottom: 12 }}>
          <div>
            <label className="form-label">Month</label>
            <select value={month} onChange={e => setMonth(e.target.value)}>
              {MONTHS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Year</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {YEARS.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Search employee</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, employee ID, department…" />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text2)" }}>
            {selectedIds.size} of {filtered.length} selected
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-sm" onClick={selectAll}>Select all</button>
            <button className="btn btn-sm" onClick={clearAll}>Clear</button>
          </div>
        </div>

        <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
          {filtered.length === 0 ? (
            <div className="empty" style={{ padding: "1rem" }}>No matching active employees.</div>
          ) : filtered.map(e => (
            <label key={e.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer",
              background: selectedIds.has(e.id) ? "#fbf3f3" : "transparent",
            }}>
              <input type="checkbox" checked={selectedIds.has(e.id)} onChange={() => toggleSelect(e.id)} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.firstName} {e.lastName}</div>
                <div style={{ fontSize: 11, color: "var(--text2)" }}>{e.employeeId} • {e.designation || "—"} • {e.department || "—"}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>
                {e.basicSalary ? `PKR ${Number(e.basicSalary).toLocaleString()}` : <span style={{ color: "#b97a00" }}>No basic set</span>}
              </div>
            </label>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn btn-primary" onClick={buildRows} disabled={loadingAtt || selectedIds.size === 0}>
            {loadingAtt ? "Loading attendance…" : `Load Selected (${selectedIds.size})`}
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 12 }}>{error}</div>}
      {success && <div className="card" style={{ borderColor: "#15803D", color: "#15803D", background: "#eaf6ee", marginBottom: 12 }}>{success}</div>}

      {/* Editable preview table */}
      {rows.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>Preview · {month} {year} · {rows.length} employee{rows.length === 1 ? "" : "s"}</div>
            <div style={{ fontSize: 12, color: "var(--text2)" }}>
              Total gross: <strong>PKR {fmt(totalGross)}</strong> · Total net: <strong>PKR {fmt(totalNet)}</strong>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={{ width: 30, textAlign: "center" }} title="Tick to include in bulk print">
                    <input type="checkbox"
                      checked={rows.length > 0 && rows.every(r => r.slipId && printSelected.has(r.slipId))}
                      onChange={e => {
                        if (e.target.checked) setPrintSelected(new Set(rows.map(r => r.slipId).filter((x): x is number => !!x)));
                        else setPrintSelected(new Set());
                      }} />
                  </th>
                  <th>Employee</th>
                  <th style={{ textAlign: "right" }}>Basic</th>
                  <th style={{ textAlign: "center" }}>Present</th>
                  <th style={{ textAlign: "center" }}>Absent</th>
                  <th style={{ textAlign: "center" }}>Leave</th>
                  <th style={{ textAlign: "right" }}>Overtime</th>
                  <th style={{ textAlign: "right" }}>Other Ded.</th>
                  <th style={{ textAlign: "right" }}>Gross</th>
                  <th style={{ textAlign: "right" }}>Deductions</th>
                  <th style={{ textAlign: "right", color: "var(--brand)" }}>Net Pay</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const c = computeRow(r);
                  return (
                    <tr key={r.emp.id}>
                      <td style={{ textAlign: "center" }}>
                        {r.slipId ? (
                          <input type="checkbox" checked={printSelected.has(r.slipId)} onChange={() => {
                            const next = new Set(printSelected);
                            next.has(r.slipId!) ? next.delete(r.slipId!) : next.add(r.slipId!);
                            setPrintSelected(next);
                          }} />
                        ) : (
                          <span style={{ color: "var(--text3)", fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.emp.firstName} {r.emp.lastName}</div>
                        <div style={{ fontSize: 11, color: "var(--text2)" }}>{r.emp.employeeId}</div>
                      </td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(Number(r.emp.basicSalary || 0))}</td>
                      <td style={{ textAlign: "center" }}><input type="number" value={r.daysPresent} onChange={e => updateRow(i, "daysPresent", parseInt(e.target.value) || 0)} style={cellInput} /></td>
                      <td style={{ textAlign: "center" }}><input type="number" value={r.daysAbsent} onChange={e => updateRow(i, "daysAbsent", parseInt(e.target.value) || 0)} style={cellInput} /></td>
                      <td style={{ textAlign: "center" }}><input type="number" value={r.daysLeave} onChange={e => updateRow(i, "daysLeave", parseInt(e.target.value) || 0)} style={cellInput} /></td>
                      <td style={{ textAlign: "right" }}><input type="number" value={r.overtime} onChange={e => updateRow(i, "overtime", e.target.value)} style={{ ...cellInput, textAlign: "right" }} /></td>
                      <td style={{ textAlign: "right" }}><input type="number" value={r.otherDeduction} onChange={e => updateRow(i, "otherDeduction", e.target.value)} style={{ ...cellInput, textAlign: "right" }} /></td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(c.grossEarnings)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(c.totalDeductions)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--brand)", fontVariantNumeric: "tabular-nums" }}>{fmt(c.netPay)}</td>
                      <td>
                        {r.slipId ? (
                          <Link href={`/salary/${r.slipId}`} className="btn btn-sm btn-primary">View</Link>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text2)" }}>Not generated</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, color: "var(--text2)" }}>
              {printSelected.size > 0 ? <>{printSelected.size} ticked for print</> : <>Tip: tick the slips you want to print, then click Print Selected</>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={generate} disabled={saving}>
                {saving ? "Generating…" : `💾 Generate ${rows.length} Slip${rows.length === 1 ? "" : "s"}`}
              </button>
              <button
                className="btn btn-print"
                disabled={printSelected.size === 0}
                onClick={() => {
                  const ids = Array.from(printSelected).join(",");
                  window.location.href = `/salary/print?ids=${ids}`;
                }}
              >
                🖨 Print Selected ({printSelected.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 && !loadingAtt && (
        <div className="card empty">Pick a month, select employees, then click <strong>Load Selected</strong> to begin.</div>
      )}
    </div>
  );
}

const cellInput: React.CSSProperties = {
  width: 70, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12,
};
