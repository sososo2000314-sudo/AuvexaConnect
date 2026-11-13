(() => {
  const steps = [
    ["AuvexaConnectへようこそ","これは友達に試してもらうための開発中のお試し版です。完成版では画面や機能が変わる場合があります。"],
    ["動画投稿","「動画」からタイトルと動画ファイルを選んで投稿できます。動画は最大100MBです。"],
    ["メール","相手のアカウント名を指定してメールを送れます。受信メールは「メール」画面で確認できます。"],
    ["プロフィール","プロフィール画像URL、自己紹介、ユーザーIDなどを設定できます。その他の機能は現在開発中です。"],
    ["大切な注意","このテスト版はパスワードなしです。同じ名前を入力すると同じアカウントとして扱われます。個人情報や秘密の内容は入力しないでください。"]
  ];
  let index = 0;
  function finish() {
    document.getElementById("tutorial").hidden = true;
    try { localStorage.setItem("auvexa_beta_tutorial_done", "1"); } catch (_) {}
  }
  function render() {
    document.getElementById("tutorialTitle").textContent = steps[index][0];
    document.getElementById("tutorialText").textContent = steps[index][1];
    document.getElementById("tutorialNext").textContent = index === steps.length - 1 ? "はじめる" : "次へ";
    document.getElementById("tutorialDots").innerHTML = steps.map((_,i)=>`<i class="${i===index?"active":""}"></i>`).join("");
  }
  window.showAuvexaTutorial = function(force=false) {
    let done = false;
    try { done = localStorage.getItem("auvexa_beta_tutorial_done") === "1"; } catch (_) {}
    if (done && !force) return;
    index = 0; render(); document.getElementById("tutorial").hidden = false;
  };
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("tutorialNext").addEventListener("click", () => {
      if (index < steps.length - 1) { index++; render(); } else finish();
    });
    document.getElementById("tutorialSkip").addEventListener("click", finish);
  });
})();