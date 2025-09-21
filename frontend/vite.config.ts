import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

declare const process: {
  env: Record<string, string | undefined>;
};

const sanitizeHost = (value: string) => value.replace(/^https?:\/\//, '').split('/')[0];

const previewAllowedHosts = new Set<string>(['localhost', '127.0.0.1']);

const railwayHostEnv =
  process.env.RAILWAY_STATIC_URL ??
  process.env.RAILWAY_PUBLIC_DOMAIN ??
  process.env.RAILWAY_PUBLIC_URL ??
  process.env.RAILWAY_DOMAIN;

if (railwayHostEnv) {
  previewAllowedHosts.add(sanitizeHost(railwayHostEnv));
}

const extraHostsEnv =
  process.env.PREVIEW_ALLOWED_HOSTS ?? process.env.VITE_PREVIEW_ALLOWED_HOSTS ?? process.env.ALLOWED_HOSTS;

if (extraHostsEnv) {
  extraHostsEnv
    .split(',')
    .map((host: string) => host.trim())
    .filter(Boolean)
    .forEach((host: string) => previewAllowedHosts.add(sanitizeHost(host)));
}

previewAllowedHosts.add('0.0.0.0');

export default defineConfig({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    allowedHosts: Array.from(previewAllowedHosts)
  }
});
