import { json, error, readJson, safeText } from "../http.js";
import { currentUser } from "./auth.js";
import { randomId } from "../security.js";
import { first, all, run } from "../db.js";
const id=()=>randomId(16), now=()=>new Date().toISOString();
async function admin(db,userId){return !!(await first(db,"SELECT user_id FROM admin_roles WHERE user_id=?",[userId]));}
export async function serviceRoutes(request,env,url){
 const user=await currentUser(request,env);
 if(url.pathname.startsWith('/api/') && !user && !['/api/services/mail-availability'].includes(url.pathname)) return error('ログインしてください。',401);
 if(url.pathname==='/api/services/me'&&request.method==='GET'){
  const mail=await first(env.DB,'SELECT address,status FROM app_mail_addresses WHERE user_id=?',[user.id]);
  const phone=await first(env.DB,'SELECT app_number,real_number,status,provision_status FROM app_phone_assignments WHERE user_id=?',[user.id]);
  return json({ok:true,mail,phone});
 }
 if(url.pathname==='/api/services/mail-availability'&&request.method==='GET'){
  const local=safeText(url.searchParams.get('local'),64).toLowerCase();
  if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(local)) return json({ok:true,available:false,message:'3〜32文字の半角英数字・._-を使用してください。'});
  const exists=await first(env.DB,'SELECT id FROM app_mail_addresses WHERE local_part=?',[local]);
  return json({ok:true,available:!exists,address:local+'@auvexa.com',message:exists?'他のメールアドレスが存在します。このメールアドレスは利用できません。':'このメールアドレスは利用できます。'});
 }
 if(url.pathname==='/api/services/mail-address'&&request.method==='POST'){
  const d=await readJson(request), local=safeText(d.local,64).toLowerCase();
  if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(local)) return error('メールアドレス名は3〜32文字の半角英数字・._-で入力してください。');
  try{await run(env.DB,'INSERT INTO app_mail_addresses(id,user_id,local_part,address) VALUES(?,?,?,?)',[id(),user.id,local,local+'@auvexa.com']);}
  catch{return error('他のメールアドレスが存在します。このメールアドレスは利用できません。',409);}
  return json({ok:true,address:local+'@auvexa.com'},201);
 }
 if(url.pathname==='/api/services/mail'&&request.method==='GET'){
  const folder=url.searchParams.get('folder')==='sent'?'sent':'inbox';
  const rows=folder==='sent'?await all(env.DB,`SELECT m.id,m.subject,m.body,m.created_at,u.email AS peer_email,u.handle AS peer_handle FROM app_mail_messages m JOIN users u ON u.id=m.recipient_user_id WHERE m.sender_user_id=? AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 100`,[user.id]):await all(env.DB,`SELECT m.id,m.subject,m.body,m.created_at,m.read_at,u.email AS peer_email,u.handle AS peer_handle FROM app_mail_messages m JOIN users u ON u.id=m.sender_user_id WHERE m.recipient_user_id=? AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 100`,[user.id]);
  return json({ok:true,messages:rows});
 }
 if(url.pathname==='/api/services/mail'&&request.method==='POST'){
  const d=await readJson(request), to=safeText(d.to,254).toLowerCase(), subject=safeText(d.subject,180), body=safeText(d.body,10000);
  if(!to||!body) return error('宛先と本文を入力してください。');
  const recipient=await first(env.DB,'SELECT u.id FROM app_mail_addresses a JOIN users u ON u.id=a.user_id WHERE a.address=? AND a.status=\'active\'',[to]);
  if(!recipient) return error('宛先のAuvexaConnectメールアドレスが見つかりません。',404);
  await run(env.DB,'INSERT INTO app_mail_messages(id,sender_user_id,recipient_user_id,subject,body) VALUES(?,?,?,?,?)',[id(),user.id,recipient.id,subject,body]);
  return json({ok:true},201);
 }
 if(url.pathname.startsWith('/api/services/mail/')&&request.method==='PATCH'){
  const mid=url.pathname.split('/').pop(); await run(env.DB,'UPDATE app_mail_messages SET read_at=? WHERE id=? AND recipient_user_id=?',[now(),mid,user.id]); return json({ok:true});
 }
 if(url.pathname==='/api/services/boards'&&request.method==='GET'){
  const rows=await all(env.DB,`SELECT b.id,b.name,b.description,b.created_at,b.created_by,COALESCE(c.category,'other') category,u.handle creator_handle FROM boards b LEFT JOIN board_categories c ON c.board_id=b.id LEFT JOIN users u ON u.id=b.created_by WHERE b.status='approved' ORDER BY b.created_at DESC LIMIT 200`);
  return json({ok:true,boards:rows});
 }
 if(url.pathname==='/api/services/boards'&&request.method==='POST'){
  const d=await readJson(request), name=safeText(d.name,100), description=safeText(d.description,1000), category=safeText(d.category,32);
  if(!name) return error('掲示板名を入力してください。');
  const bid=id(); await run(env.DB,"INSERT INTO boards(id,name,description,created_by,status) VALUES(?,?,?,?, 'approved')",[bid,name,description,user.id]);
  await run(env.DB,'INSERT INTO board_categories(board_id,category) VALUES(?,?)',[bid,category||'other']);
  await run(env.DB,'INSERT INTO board_admin_notices(id,board_id,creator_id,action) VALUES(?,?,?,?)',[id(),bid,user.id,'created']);
  return json({ok:true,id:bid,published:true,admin_notified:true},201);
 }
 if(url.pathname.startsWith('/api/services/boards/')&&request.method==='DELETE'){
  if(!(await admin(env.DB,user.id))) return error('管理者権限が必要です。',403);
  const bid=url.pathname.split('/').pop(), d=await readJson(request), reason=safeText(d.reason,500)||'管理者による削除';
  const b=await first(env.DB,'SELECT id,created_by FROM boards WHERE id=?',[bid]); if(!b)return error('掲示板が見つかりません。',404);
  await run(env.DB,'INSERT INTO board_admin_notices(id,board_id,creator_id,action,reason) VALUES(?,?,?,?,?)',[id(),bid,user.id,'deleted',reason]);
  await run(env.DB,"UPDATE boards SET status='deleted' WHERE id=?",[bid]);
  // A production email provider adapter can send this notification once MAIL_PROVIDER credentials are configured.
  if(b.created_by) await run(env.DB,'INSERT INTO notifications(id,user_id,notification_type,title,body,created_at) VALUES(?,?,?,?,?,?)',[id(),b.created_by,'board_deleted','掲示板削除通知',`掲示板が削除されました。理由：${reason}`,now()]);
  return json({ok:true,notification_created:true});
 }
 if(url.pathname==='/api/services/admin/users'&&request.method==='GET'){
  if(!(await admin(env.DB,user.id)))return error('管理者権限が必要です。',403);
  const rows=await all(env.DB,'SELECT id,email,handle,display_name,account_status,created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 500');return json({ok:true,users:rows});
 }
 if(url.pathname==='/api/services/admin/board-notices'&&request.method==='GET'){
  if(!(await admin(env.DB,user.id)))return error('管理者権限が必要です。',403);
  const rows=await all(env.DB,`SELECT n.*,b.name board_name,u.handle creator_handle FROM board_admin_notices n LEFT JOIN boards b ON b.id=n.board_id LEFT JOIN users u ON u.id=n.creator_id ORDER BY n.created_at DESC LIMIT 100`);return json({ok:true,notices:rows});
 }
 return null;
}
