export async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error ?? "تعذر الاتصال");
    error.status = res.status;
    throw error;
  }
  return data;
}
export const money = (value) =>
  new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(
    Number(value ?? 0),
  );
export const date = (value) =>
  value ? new Date(value).toLocaleDateString("ar-EG") : "";
export const datetime = (value) =>
  value
    ? new Date(value).toLocaleString("ar-EG", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
