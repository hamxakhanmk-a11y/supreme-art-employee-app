// Shown only on test copies of the ERP (see lib/appEnv.ts): a striped strip
// above the top bar on screen, and a "TEST COPY" stamp on printed pages so a
// slip or report printed from here can't pass for a real one.
export default function TestEnvBanner() {
  return (
    <>
      <div className="test-env-banner" role="note">
        TEST APP — pilot only. Data here is not the real ERP and may be reset.
      </div>
      <div className="print-test-stamp" aria-hidden>TEST COPY · NOT VALID</div>
    </>
  );
}
