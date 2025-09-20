import axios from 'axios';

let authToken: string | null = localStorage.getItem('token');
const unauthorizedSubscribers = new Set<() => void>();

let baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
if (!baseURL.endsWith('/api')) {
  baseURL = `${baseURL.replace(/\/$/, '')}/api`;
}

export const api = axios.create({
  baseURL,
  withCredentials: false
});

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
