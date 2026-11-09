let csrfToken = '';
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: { path: string; message: string }[],
  ) {
    super(message);
  }
}
export async function refreshCsrf() {
  const response = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' });
  if (!response.ok) throw new Error('No se pudo conectar con NEXORA.');
  const body = await response.json();
  csrfToken = body.csrfToken;
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const mutates = options.method && options.method !== 'GET';
  if (mutates && !csrfToken) await refreshCsrf();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (mutates) headers.set('X-CSRF-Token', csrfToken);
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  });
  const body = await response
    .json()
    .catch(() => ({ message: 'No se pudo conectar con el servidor.' }));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('nexora:unauthorized'));
    throw new ApiError(response.status, body.code, body.message, body.fields);
  }
  return body as T;
}
export const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
export const money = (value: string | number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 2,
  }).format(Number(value));
export const number = (value: number) => new Intl.NumberFormat('es-CO').format(value);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value));
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function daysAgo(days: number) {
  const date = new Date(`${today()}T12:00:00-05:00`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
export async function download(path: string, filename: string) {
  const response = await fetch(`/api/v1${path}`, { credentials: 'same-origin' });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.message ?? 'No se pudo descargar el reporte.');
  }
  const blob = await response.blob(),
    url = URL.createObjectURL(blob),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
