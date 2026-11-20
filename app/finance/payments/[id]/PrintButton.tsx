"use client";

export default function PrintButton() {
  return <button className="btn btn-print" onClick={() => window.print()}>🖨 Print</button>;
}
