export function getApiBase(): string {
  const fromEnv = (import.meta.env?.VITE_API_URL as string) || '';
  if (typeof window === 'undefined') return fromEnv;
  const origin = window.location.origin;
  const isLocalDev = /^https?:\/\/localhost(:\d+)?$/.test(origin);
  if (!isLocalDev && fromEnv && (fromEnv.includes('localhost') || fromEnv.includes('127.0.0.1'))) {
    const path = window.location.pathname.replace(/\/$/, '') || '';
    return path ? `${origin}${path}` : origin;
  }
  return fromEnv;
}
