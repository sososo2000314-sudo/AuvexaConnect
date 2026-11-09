import { initHome } from './js/home.js';
import { initSearch } from './js/search.js';
import { initSettings } from './js/settings.js';
import { renderPage } from './js/router.js';

document.addEventListener('DOMContentLoaded', () => {
  initHome();
  initSearch();
  initSettings();
  document.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => renderPage(button.dataset.page));
  });
  document.getElementById('profile-shortcut')?.addEventListener('click', () => renderPage('profile'));
});
