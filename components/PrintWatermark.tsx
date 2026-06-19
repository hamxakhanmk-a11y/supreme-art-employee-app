// Renders a faded, angled Urdu calligraphy watermark on every printed page.
// Hidden on screen, shown only via @media print (see globals.css).
export default function PrintWatermark() {
  return (
    <div className="print-watermark" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-urdu.png" alt="" />
    </div>
  );
}
