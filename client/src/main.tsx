import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
 
// Apply saved theme BEFORE render to prevent flash
const savedUIStore = localStorage.getItem('ui-store');
if (savedUIStore) {
  try {
    const { state } = JSON.parse(savedUIStore);
    if (state?.theme) {
      document.documentElement.classList.add(state.theme);
    } else {
      document.documentElement.classList.add('dark');
    }
  } catch {
    document.documentElement.classList.add('dark');
  }
} else {
  document.documentElement.classList.add('dark');
}
 
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
