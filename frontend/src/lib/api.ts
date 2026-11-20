// In the containerised stack the browser talks to the SAME origin as the page:
// nginx (web container) proxies /api/* to the api service. So the default is
// an empty base URL (relative requests). Set VITE_API_URL only for
// `npm run dev` against a separately running API (e.g. http://localhost:4000).
const API_BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  details?: Record<string, string[]>;
  constructor(message: string, status: number, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include", // send/receive the httpOnly session cookie
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = body?.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body?.details);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export { API_BASE };
