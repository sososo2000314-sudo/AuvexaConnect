(() => {
  const $ = id => document.getElementById(id);
  const state = { user: null, profile: null };
  const api = async (path, options={}) => {
    const headers = new Headers(options.headers || {});
    if (state.user) headers.set("X-User-Id", state.user.id);
    const response = await fetch("/api" + path, {...options, headers});
    const data = await response.json().catch(()=>({error:"サーバーから正しい応答がありません"}));
    if (!response.ok) throw new Error(data.error || `エラー (${response.status})`);
    return data;
  };
  const setMessage = (id, message, bad=false) => { $(id).textContent=message; $(id).style.color=bad?"#ff9292":""; };
  function showView(name) {
    document.querySelectorAll(".view").forEach(el=>el.hidden=true);
    $(name+"View").hidden=false;
    document.querySelectorAll(".tab").forEach(el=>el.classList.toggle("active",el.dataset.view===name));
    if(name==="videos") loadVideos();
    if(name==="mail") loadMail();
    if(name==="profile") loadProfile();
  }
  async function login() {
    const name=$("loginName").value.trim();
    if(!name) return setMessage("loginError","アカウント名を入力してください。",true);
    $("loginButton").disabled=true;
    try {
      const data=await api("/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});
      state.user=data.user;
      sessionStorage.setItem("auvexa_beta_user",JSON.stringify(data.user));
      $("loginView").hidden=true; $("appView").hidden=false;
      $("accountBadge").hidden=false; $("accountBadge").textContent="ログイン中："+data.user.name;
      showView("videos");
      window.showAuvexaTutorial(false);
    } catch(e) { setMessage("loginError",e.message,true); }
    finally {$("loginButton").disabled=false;}
  }
  async function loadVideos() {
    $("videoList").innerHTML='<p class="muted">読み込み中…</p>';
    try {
      const {videos}=await api("/videos");
      $("videoList").innerHTML=videos.length?videos.map(v=>`
        <article class="video-card">
          <video controls preload="metadata" src="${escapeAttr(v.url)}"></video>
          <h3>${escapeHtml(v.title)}</h3>
          <div class="meta">投稿者：${escapeHtml(v.author)} ・ ${escapeHtml(v.created_at)}</div>
        </article>`).join(""):'<p class="muted">まだ動画は投稿されていません。</p>';
    } catch(e) {$("videoList").textContent=e.message;}
  }
  async function uploadVideo(event) {
    event.preventDefault();
    const file=$("videoFile").files[0], title=$("videoTitle").value.trim();
    if(!file) return setMessage("videoMessage","動画ファイルを選択してください。",true);
    if(!file.type.startsWith("video/")) return setMessage("videoMessage","動画ファイルを選択してください。",true);
    if(file.size>100*1024*1024) return setMessage("videoMessage","動画は100MB以下にしてください。",true);
    const button=$("videoForm").querySelector("button"); button.disabled=true;
    setMessage("videoMessage","アップロード中です。しばらくお待ちください…");
    try {
      const data=await api("/videos",{method:"POST",headers:{"Content-Type":file.type,"X-Video-Title":encodeURIComponent(title||file.name),"X-File-Name":encodeURIComponent(file.name)},body:file});
      setMessage("videoMessage","投稿しました。");
      $("videoForm").reset(); await loadVideos();
    } catch(e) {setMessage("videoMessage",e.message,true);}
    finally {button.disabled=false;}
  }
  async function loadMail() {
    $("mailList").innerHTML='<p class="muted">読み込み中…</p>';
    try {
      const {messages}=await api("/mail");
      $("mailList").innerHTML=messages.length?messages.map(m=>`
        <article class="mail-card"><h3>${escapeHtml(m.subject||"(件名なし)")}</h3>
        <div class="meta">差出人：${escapeHtml(m.sender)} ・ ${escapeHtml(m.created_at)}</div>
        <p>${escapeHtml(m.body)}</p></article>`).join(""):'<p class="muted">受信メールはありません。</p>';
    } catch(e) {$("mailList").textContent=e.message;}
  }
  async function sendMail(event) {
    event.preventDefault();
    const to=$("mailTo").value.trim(), subject=$("mailSubject").value.trim(), body=$("mailBody").value.trim();
    if(!to||!body) return setMessage("mailMessage","宛先と本文を入力してください。",true);
    const button=$("mailForm").querySelector("button");button.disabled=true;
    try {
      await api("/mail",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to,subject,body})});
      $("mailForm").reset();setMessage("mailMessage","メールを送信しました。");
    } catch(e) {setMessage("mailMessage",e.message,true);}
    finally {button.disabled=false;}
  }
  async function loadProfile() {
    try {
      const {profile}=await api("/profile"); state.profile=profile;
      $("displayName").value=profile.display_name||state.user.name;
      $("userTag").value=profile.user_tag||"";
      $("bio").value=profile.bio||"";$("avatarUrl").value=profile.avatar_url||"";
      $("headerUrl").value=profile.header_url||"";$("websiteUrl").value=profile.website_url||"";
      $("location").value=profile.location||"";$("birthday").value=profile.birthday||"";
    } catch(e) {setMessage("profileMessage",e.message,true);}
  }
  async function saveProfile(event) {
    event.preventDefault();
    const user_tag=$("userTag").value.trim();
    if(user_tag&&!/^[A-Za-z0-9_]{2,24}$/.test(user_tag)) return setMessage("profileMessage","ユーザーIDは英数字と _ の2〜24文字にしてください。",true);
    const profile={display_name:$("displayName").value.trim(),user_tag,bio:$("bio").value.trim(),avatar_url:$("avatarUrl").value.trim(),header_url:$("headerUrl").value.trim(),website_url:$("websiteUrl").value.trim(),location:$("location").value.trim(),birthday:$("birthday").value};
    try {await api("/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(profile)});setMessage("profileMessage","保存しました。");}
    catch(e) {setMessage("profileMessage",e.message,true);}
  }
  function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function escapeAttr(s){return escapeHtml(s);}
  function logout(){state.user=null;sessionStorage.removeItem("auvexa_beta_user");$("appView").hidden=true;$("loginView").hidden=false;$("accountBadge").hidden=true;$("loginName").value="";}
  document.addEventListener("DOMContentLoaded",()=>{
    $("loginButton").addEventListener("click",login);
    $("loginName").addEventListener("keydown",e=>{if(e.key==="Enter")login();});
    document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
    $("videoForm").addEventListener("submit",uploadVideo);$("mailForm").addEventListener("submit",sendMail);
    $("profileForm").addEventListener("submit",saveProfile);$("refreshMail").addEventListener("click",loadMail);
    $("logoutButton").addEventListener("click",logout);
    try {
      const saved=JSON.parse(sessionStorage.getItem("auvexa_beta_user")||"null");
      if(saved&&saved.id){state.user=saved;$("loginView").hidden=true;$("appView").hidden=false;$("accountBadge").hidden=false;$("accountBadge").textContent="ログイン中："+saved.name;showView("videos");}
    } catch(_) {}
  });
})();