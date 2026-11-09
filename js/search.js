export function initSearch() {
  const input = document.getElementById('global-search');
  input?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && input.value.trim()) {
      const main = document.getElementById('app-main');
      main.innerHTML = `<section class="section"><h1>検索結果</h1><p>「${escapeHtml(input.value.trim())}」の検索機能は次の開発段階で接続します。</p></section>`;
    }
  });
}
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
