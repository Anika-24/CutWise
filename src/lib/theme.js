import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'scrapsmart-theme';
const listeners = new Set();

export function getTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY) || 'system';
  return ['light', 'dark', 'system'].includes(savedTheme) ? savedTheme : 'system';
}

function getThemeSnapshot() {
  return `${getTheme()}:${document.documentElement.classList.contains('dark') ? 'dark' : 'light'}`;
}

function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function setTheme(theme) {
  const nextTheme = ['light', 'dark', 'system'].includes(theme) ? theme : 'system';
  localStorage.setItem(STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
  listeners.forEach((listener) => listener());
}

export function useTheme() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const onSystemChange = () => {
        if (getTheme() === 'system') {
          applyTheme('system');
          listeners.forEach((notify) => notify());
        }
      };
      media.addEventListener('change', onSystemChange);
      return () => { listeners.delete(listener); media.removeEventListener('change', onSystemChange); };
    },
    getThemeSnapshot,
    () => 'light',
  );
}
