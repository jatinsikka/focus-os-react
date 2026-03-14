import { DEF } from '../data/constants';

const KEY = 'fos5';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEF, ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return { ...DEF };
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

export function loadDark() {
  return localStorage.getItem('fos5-dark') === '1';
}

export function saveDark(dark) {
  localStorage.setItem('fos5-dark', dark ? '1' : '0');
}

export function loadColWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem('fos5-col-widths'));
    if (saved && saved.length >= 3) return saved;
  } catch (e) { /* ignore */ }
  return null;
}

export function saveColWidths(widths) {
  localStorage.setItem('fos5-col-widths', JSON.stringify(widths));
}

export function loadNotionCreds() {
  return {
    token: localStorage.getItem('fos5-ntoken') || '',
    dbId:  localStorage.getItem('fos5-ndb')    || '',
  };
}

export function saveNotionCreds(token, dbId) {
  localStorage.setItem('fos5-ntoken', token);
  localStorage.setItem('fos5-ndb',    dbId);
}
