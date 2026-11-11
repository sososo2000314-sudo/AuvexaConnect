const $ = (id) => document.getElementById(id);
const sections = ["welcome","terms","tutorial","authPanel","home","uploadPanel","profilePanel","mailPanel","menuPanel"];
let authMode = "login";
let user = null;
let selectedFiles = [];
let acceptedTutorial = localStorage.getItem("auvexa_tutorial_done") === "1";

function showSection(id) {
  sections.forEach(key => $(key)?.classList.toggle("hidden", key !== id));
  document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.toggle("active", b.dataset.page === id));
}
function showPage(id) {
  if (!acceptedTutorial && !user) return showSection("welcome");
  showSection(id === "profile" ? "profilePanel" : id === "mail" ? "mailPanel" : id === "menu" ? "menuPanel" : "home");
  if (id === "profile") renderProfile();
}
function bytes(n) { return n < 1024 ? `${n} B` : n < 1024**2 ? `${(n/1024).toFixed(1)} KB` : `${(n/1024**2).toFixed(1)} MB`; }
function updateClock(){ $("clock").textContent = new Intl.DateTimeFormat("ja-JP",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}).format(new Date()); }
updateClock(); setInterval(updateClock,30000);

async function api(path, options={}) {
  const response = await fetch(path,{credentials:"same-origin",...options});
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error || "通信に失敗しました。");
    return data;
  }
  if (!response.ok) throw new Error("通信に失敗しました。");
  return response;
}

function setAuthMode(mode) {
  authMode = mode;
  $("authTitle").textContent = mode === "login" ? "ログイン" : "新規登録";
  $("displayNameWrap").classList.toggle("hidden",mode !== "register");
  $("handleWrap").classList.toggle("hidden",mode !== "register");
  $("authForm").elements.password.autocomplete = mode === "login" ? "current-password" : "new-password";
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.auth===mode));
  $("authMessage").textContent="";
}
function openAuth(mode="login"){setAuthMode(mode);showSection("authPanel");}
async function refreshUser(){try{const d=await api("/api/auth/me");user=d.user;$("accountButton").textContent=user?"ログアウト":"ログイン";$("guestNotice").classList.toggle("hidden",!!user);renderProfile();}catch{user=null;}}
function renderProfile(){ $("profileInfo").textContent=user?`${user.display_name||user.username}　@${user.handle}　${user.email}`:"ログインするとプロフィールを表示できます。"; }
async function loadFeed(){
  try{const d=await api("/api/posts");const feed=$("feed");feed.replaceChildren();if(!d.posts.length){const empty=document.createElement("article");empty.className="empty-state";empty.innerHTML="<h3>まだ投稿はありません</h3><p>ログインして最初の投稿を作成しましょう。</p>";feed.append(empty);return;}
    for(const post of d.posts){const card=document.createElement("article");card.className="panel";const title=document.createElement("strong");title.textContent=`${post.display_name||post.handle}　@${post.handle}`;const body=document.createElement("p");body.textContent=post.body||"";const meta=document.createElement("small");meta.className="muted";meta.textContent=new Date(post.created_at).toLocaleString("ja-JP");card.append(title,body,meta);for(const media of post.media||[]){const link=document.createElement("a");link.href=`/api/media/${media.id}`;link.textContent=`添付ファイル：${media.file_name}`;link.target="_blank";card.append(document.createElement("br"),link);}const counts=document.createElement("p");counts.className="muted";counts.textContent=`高評価 ${post.like_count} ・ コメント ${post.comment_count}`;card.append(counts);feed.append(card);}
  }catch(e){console.warn("feed load",e);}
}

$("continueButton").addEventListener("click",()=>showSection("terms"));
$("guestButton").addEventListener("click",()=>{acceptedTutorial=true;showSection("home");});
$("agreeTerms").addEventListener("change",e=>$("termsNext").disabled=!e.target.checked);
$("termsNext").addEventListener("click",()=>showSection("tutorial"));
$("finishTutorial").addEventListener("click",()=>{localStorage.setItem("auvexa_tutorial_done","1");acceptedTutorial=true;showSection("home");});
$("accountButton").addEventListener("click",async()=>{if(user){await api("/api/auth/logout",{method:"POST"});user=null;$("accountButton").textContent="ログイン";showSection("home");}else openAuth("login");});
$("closeAuth").addEventListener("click",()=>showPage("home"));
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.auth)));
$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();const f=new FormData(e.currentTarget);const payload=Object.fromEntries(f.entries());
  try{if(authMode==="register"){await api("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});$("authMessage").textContent="登録しました。ログインしてください。";setAuthMode("login");}else{await api("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});await refreshUser();showSection("home");}}catch(err){$("authMessage").textContent=err.message;}
});
document.querySelectorAll(".bottom-nav button").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
$("newPostButton").addEventListener("click",()=>{if(!user)return openAuth("login");showSection("uploadPanel");});
$("profileLogin").addEventListener("click",()=>openAuth("login"));
$("closeUpload").addEventListener("click",()=>showSection("home"));

function renderFiles(){
  $("fileList").replaceChildren();
  selectedFiles.forEach((file,index)=>{const row=document.createElement("div");row.className="file-item";const name=document.createElement("span");name.textContent=`${file.name} · ${bytes(file.size)}`;const remove=document.createElement("button");remove.textContent="削除";remove.addEventListener("click",()=>{selectedFiles.splice(index,1);renderFiles();});row.append(name,remove);$("fileList").append(row);});
}
function addFiles(files){for(const file of files){if(selectedFiles.length>=10)break;if(file.size>100*1024*1024){$("uploadMessage").textContent=`${file.name}: 100MBを超えるため追加できません。`;continue;}if(!selectedFiles.some(x=>x.name===file.name&&x.size===file.size))selectedFiles.push(file);}renderFiles();}
const dz=$("dropZone");dz.addEventListener("click",()=>$("fileInput").click());dz.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" ")$("fileInput").click();});dz.addEventListener("dragover",e=>{e.preventDefault();dz.classList.add("dragover");});dz.addEventListener("dragleave",()=>dz.classList.remove("dragover"));dz.addEventListener("drop",e=>{e.preventDefault();dz.classList.remove("dragover");addFiles(e.dataTransfer.files);});$("fileInput").addEventListener("change",e=>addFiles(e.target.files));

$("publishButton").addEventListener("click",async()=>{
  if(!user)return openAuth("login");
  const message=$("postBody").value.trim();if(!message&&!selectedFiles.length){$("uploadMessage").textContent="文章またはファイルを追加してください。";return;}
  $("uploadMessage").textContent="アップロードを確認しています…";
  try{
    const uploaded=[];
    for(const file of selectedFiles){const form=new FormData();form.append("file",file);const result=await api("/api/media/upload",{method:"POST",body:form});uploaded.push(result.media.id);}
    await api("/api/posts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:$("postBody").value,mediaIds:uploaded,visibility:$("visibility").value})});
    $("uploadMessage").textContent="投稿しました。";$("postBody").value="";selectedFiles=[];renderFiles();showSection("home");loadFeed();
  }catch(err){$("uploadMessage").textContent=err.message;}
});
document.querySelectorAll("[data-feature]").forEach(b=>b.addEventListener("click",()=>{$("featureMessage").textContent=`${b.dataset.feature}の画面は機能別API実装段階で接続します。`;}));

(async()=>{await refreshUser();if(acceptedTutorial)showSection("home");else showSection("welcome");})();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
