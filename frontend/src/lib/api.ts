import axios from 'axios';

let authToken: string | null = localStorage.getItem('token');
const unauthorizedSubscribers = new Set<() => void>();

const DEFAULT_BASE = 'http://localhost:4000';
const rawBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_BASE;

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

const normalizedBase = trimTrailingSlashes(rawBase) || DEFAULT_BASE;
const apiBase = normalizedBase.endsWith('/api')
  ? normalizedBase
  : `${trimTrailingSlashes(normalizedBase)}/api`;

const assetsBaseURL = trimTrailingSlashes(apiBase.replace(/\/api$/, '')) || apiBase;

export const api = axios.create({
  baseURL: apiBase,
  withCredentials: false
});

export const resolveAssetUrl = (path: string) => {
  if (!path) {
    return path;
  }
  if (/^(https?:)?\/\//.test(path)) {
    return path;
  }
  if (path.startsWith('/')) {
    return `${assetsBaseURL}${path}`;
  }
  return `${assetsBaseURL}/${path}`;
};

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

export const subscribeUnauthorized = (callback: () => void) => {
  unauthorizedSubscribers.add(callback);
  return () => {
    unauthorizedSubscribers.delete(callback);
  };
};

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      unauthorizedSubscribers.forEach((callback) => callback());
    }
    return Promise.reject(error);
  }
);
