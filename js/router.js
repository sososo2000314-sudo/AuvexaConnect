const titles = {home:'ホーム',videos:'動画',messages:'メール',friends:'フレンド',boards:'板',profile:'マイページ',settings:'設定'};
export function renderPage(page) {
  document.querySelectorAll('[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const main = document.getElementById('app-main');
  if (!main) return;
  main.innerHTML = `<section class="section"><p class="eyebrow">AUVEXACONNECT</p><h1>${titles[page] || 'ページ'}</h1><div class="empty-state">この機能の実装準備ができています。次の開発段階で機能を接続します。</div></section>`;
}
