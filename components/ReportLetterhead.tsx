// The printed letterhead the registers carry — Procurement Master, Purchase
// Requisition, the Store reports: Urdu logo and company name in a box on the
// left, the report's title in red, and the document-control row (code · date ·
// issue status) beneath it. Print only; on screen the page has its own heading.
// Matches the Excel letterhead built from the same reportLetterhead() data.
export default function ReportLetterhead({ title, code, date, issue, company = "SUPREME ART PRIVATE LIMITED" }: {
  title: string; code?: string; date: string; issue?: string; company?: string;
}) {
  return (
    <div className="report-letterhead">
      <div className="rl-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-urdu.png" alt="Supreme Art" width={135} height={66} />
        <div>{company}</div>
      </div>
      <div className="rl-heading">
        <h2>{title}</h2>
        <div className="rl-control">
          <span>{code || ""}</span>
          <span>Date: {date}</span>
          <span>{issue ? `Issue Status: ${issue}` : ""}</span>
        </div>
      </div>
    </div>
  );
}
