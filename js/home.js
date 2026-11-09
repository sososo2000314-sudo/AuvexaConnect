export function initHome() {
  document.getElementById('start-button')?.addEventListener('click', () => {
    const card = document.querySelector('.welcome-card');
    if (card) card.innerHTML = '<p class="eyebrow">WELCOME</p><h1>AuvexaConnectに行きましょう</h1><p>初期設定とチュートリアルは次の開発段階で接続します。</p>';
  });
}
