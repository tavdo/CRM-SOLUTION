export async function inboxApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/inbox/${path}`, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Inbox request failed");
  return data as T;
}
