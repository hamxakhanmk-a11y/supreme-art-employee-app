// Which copy of the ERP this is. Everything except the production deployment
// (preview branches like the jawad-dev pilot, local dev) is "test", and is
// branded so nobody mistakes it for the real ERP. APP_ENV=production|test
// overrides it, e.g. if a test copy is ever deployed as its own production.
export type AppEnv = "production" | "test";

export function appEnv(): AppEnv {
  const forced = process.env.APP_ENV;
  if (forced === "production" || forced === "test") return forced;
  return process.env.VERCEL_ENV === "production" ? "production" : "test";
}

export const APP_NAME = "Supreme Art ERP";
export const TEST_APP_NAME = "Supreme Art ERP · TEST";
