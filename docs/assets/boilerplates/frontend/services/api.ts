import { getApiBase } from './apiBase';
const API_BASE = getApiBase();

export interface LoginResponse {
  accessToken: string;
  user: { id: number; name: string; email: string; role: string };
}

export async function signupApi(name: string, email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { message?: string }).message || 'Signup failed';
    throw new Error(msg);
  }
  return res.json();
}

export async function loginApi(email: string, password: string, rememberMe?: boolean): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, rememberMe: rememberMe ?? false }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || 'Invalid credentials');
  }
  return res.json();
}
