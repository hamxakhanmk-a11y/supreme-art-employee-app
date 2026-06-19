// Renders a faded centered logo as a watermark on every printed page.
// Hidden on screen, shown only via @media print (see globals.css).
export default function PrintWatermark() {
  return (
    <div className="print-watermark" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" />
    </div>
  );
}
