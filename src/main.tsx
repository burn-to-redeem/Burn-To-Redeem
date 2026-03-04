import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AdminPanel from './AdminPanel.tsx';
import './index.css';

const isAdminRoute = (() => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  const query = new URLSearchParams(window.location.search);
  return path === '/admin' || path.startsWith('/admin/') || query.get('admin') === '1';
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? <AdminPanel /> : <App />}
  </StrictMode>,
);
