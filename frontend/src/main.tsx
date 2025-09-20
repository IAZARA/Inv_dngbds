import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';

const brandingIconUrl = new URL('./assets/logo_ministerio.png', import.meta.url).href;

const ensureFavicon = () => {
  const links = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
  if (links.length === 0) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = brandingIconUrl;
    document.head.appendChild(link);
    return;
  }

  links.forEach((link) => {
    link.type = 'image/png';
    link.href = brandingIconUrl;
  });
};

ensureFavicon();
document.title = 'MINSEG-DFI';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
