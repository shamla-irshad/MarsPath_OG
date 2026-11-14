import type {Page} from './types';

export const PATHS: Record<Page, string> = {
  home: '/',
  discover: '/explore',
  map: '/mission-control',
  compare: '/routes',
  navigate: '/navigation',
  summary: '/summary',
};

export const PAGE_NAMES: Record<Page, string> = {
  home: 'Home',
  discover: 'Choose a mission',
  map: 'Mars Explorer',
  compare: 'Compare routes',
  navigate: 'Marswalk navigation',
  summary: 'Mission summary',
};

export const PAGE_ORDER: Page[] = ['home', 'discover', 'map', 'compare', 'navigate', 'summary'];

export const pageFromPath = (): Page =>
  (Object.entries(PATHS).find(([, url]) => window.location.pathname === url)?.[0] as Page) || 'home';
