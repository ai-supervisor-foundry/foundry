import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { JWT_KEY } from './authContext';
import { getApiBase } from './apiBase';

const API_BASE = getApiBase();

let onUnauthorized: (() => void) | null = null;
let onForbidden: ((message?: string) => void) | null = null;
let onApiError: ((message: string) => void) | null = null;
let onNetworkError: ((retry: () => Promise<unknown>) => void) | null = null;

const DEFAULT_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export function setOnUnauthorized(cb: () => void): void {
  onUnauthorized = cb;
}

export function setOnForbidden(cb: (message?: string) => void): void {
  onForbidden = cb;
}

export function setOnApiError(cb: (message: string) => void): void {
  onApiError = cb;
}

export function setOnNetworkError(cb: (retry: () => Promise<unknown>) => void): void {
  onNetworkError = cb;
}

function getToken(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(JWT_KEY) : null;
  } catch {
    return null;
  }
}

const instance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function isNetworkError(err: AxiosError): boolean {
  return !err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error');
}

instance.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const config = err.config as AxiosRequestConfig & { _retryCount?: number };
    if (err.response?.status === 401) {
      onUnauthorized?.();
      return Promise.reject(err);
    }
    if (err.response?.status === 403) {
      onForbidden?.('Access Denied');
      return Promise.reject(new Error('Access Denied'));
    }
    if (err.response) {
      const msg = (err.response?.data as { message?: string })?.message ?? `Request failed (${err.response.status})`;
      onApiError?.(msg);
      return Promise.reject(err);
    }
    if (isNetworkError(err) && (config._retryCount ?? 0) < DEFAULT_RETRIES) {
      config._retryCount = (config._retryCount ?? 0) + 1;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return instance.request(config);
    }
    if (isNetworkError(err)) {
      const retry = () => instance.request(config);
      onNetworkError?.(retry);
    }
    return Promise.reject(err);
  }
);

export const apiClient = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    instance.get<T>(url, config).then((r) => r.data),
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    instance.post<T>(url, data, config).then((r) => r.data),
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    instance.put<T>(url, data, config).then((r) => r.data),
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    instance.patch<T>(url, data, config).then((r) => r.data),
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    instance.delete<T>(url, config).then((r) => r.data),
};
