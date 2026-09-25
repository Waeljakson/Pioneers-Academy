export function appOrigin(env = process.env) {
  const value = env.APP_ORIGIN || env.RENDER_EXTERNAL_URL;
  if (!value)
    throw new Error("Set APP_ORIGIN or use Render automatic service URL");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid application origin");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  )
    throw new Error("Application origin must contain only scheme and host");
  if (env.NODE_ENV === "production" && parsed.protocol !== "https:")
    throw new Error("Production requires HTTPS");
  return parsed.origin;
}
