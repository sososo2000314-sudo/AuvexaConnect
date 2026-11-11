import { json, error, readJson, safeText } from "../http.js";
import { randomId } from "../security.js";
import { first, all, run } from "../db.js";
import { currentUser } from "./auth.js";

export async function postRoutes(request, env, url) {
  if (url.pathname === "/api/posts" && request.method === "GET") {
    const viewer = await currentUser(request, env);
    const rows = await all(env.DB, `SELECT p.id,p.user_id,p.post_type,p.body,p.visibility,p.created_at,u.handle,u.display_name,u.avatar_url FROM posts p JOIN users u ON u.id=p.user_id WHERE p.status='published' AND p.deleted_at IS NULL AND (p.visibility='public' OR p.user_id=?) ORDER BY p.created_at DESC LIMIT 50`, [viewer?.id || ""]);
    for (const post of rows) {
      post.media = await all(env.DB, `SELECT m.id,m.media_type,m.mime_type,m.file_name,m.size_bytes FROM post_media pm JOIN media_assets m ON m.id=pm.media_id WHERE pm.post_id=? AND m.status='ready' ORDER BY pm.sort_order`, [post.id]);
      post.like_count = Number((await first(env.DB, `SELECT COUNT(*) AS n FROM post_likes WHERE post_id=?`, [post.id]))?.n || 0);
      post.comment_count = Number((await first(env.DB, `SELECT COUNT(*) AS n FROM comments WHERE post_id=? AND status='visible' AND deleted_at IS NULL`, [post.id]))?.n || 0);
    }
    return json({ ok: true, posts: rows });
  }
  if (url.pathname === "/api/posts" && request.method === "POST") {
    const user = await currentUser(request, env);
    if (!user) return error("ログインしてください。", 401);
    const data = await readJson(request);
    const body = safeText(data.body, 5000);
    const mediaIds = Array.isArray(data.mediaIds) ? data.mediaIds.slice(0,10).map(x=>String(x)) : [];
    if (!body && !mediaIds.length) return error("文章またはファイルを追加してください。");
    for (const mediaId of mediaIds) {
      const owned = await first(env.DB, `SELECT id FROM media_assets WHERE id=? AND owner_id=? AND status='ready'`, [mediaId,user.id]);
      if (!owned) return error("自分がアップロードしたファイルだけ添付できます。", 403);
    }
    const id = randomId(16);
    const type = mediaIds.length ? "image" : "text";
    const visibility = ["public","friends","followers","private"].includes(data.visibility) ? data.visibility : "public";
    await run(env.DB, `INSERT INTO posts(id,user_id,post_type,body,visibility,status,published_at) VALUES(?,?,?,?,?,'published',?)`, [id,user.id,type,body,visibility,new Date().toISOString()]);
    for (let i=0;i<mediaIds.length;i++) await run(env.DB, `INSERT INTO post_media(post_id,media_id,sort_order) VALUES(?,?,?)`, [id,mediaIds[i],i]);
    return json({ ok: true, postId: id }, 201);
  }
  const likeMatch = url.pathname.match(/^\/api\/posts\/([a-f0-9]+)\/like$/);
  if (likeMatch && request.method === "POST") {
    const user = await currentUser(request, env);
    if (!user) return error("ログインしてください。", 401);
    const post = await first(env.DB, `SELECT id FROM posts WHERE id=? AND status='published'`, [likeMatch[1]]);
    if (!post) return error("投稿が見つかりません。", 404);
    const existing = await first(env.DB, `SELECT post_id FROM post_likes WHERE post_id=? AND user_id=?`, [post.id,user.id]);
    if (existing) await run(env.DB, `DELETE FROM post_likes WHERE post_id=? AND user_id=?`, [post.id,user.id]);
    else await run(env.DB, `INSERT INTO post_likes(post_id,user_id) VALUES(?,?)`, [post.id,user.id]);
    return json({ ok: true, liked: !existing });
  }
  const commentMatch = url.pathname.match(/^\/api\/posts\/([a-f0-9]+)\/comments$/);
  if (commentMatch && request.method === "POST") {
    const user = await currentUser(request, env);
    if (!user) return error("ログインしてください。", 401);
    const data = await readJson(request);
    const body = safeText(data.body, 2000);
    if (!body) return error("コメントを入力してください。");
    const post = await first(env.DB, `SELECT id FROM posts WHERE id=? AND status='published'`, [commentMatch[1]]);
    if (!post) return error("投稿が見つかりません。", 404);
    await run(env.DB, `INSERT INTO comments(id,post_id,user_id,body) VALUES(?,?,?,?)`, [randomId(16),post.id,user.id,body]);
    return json({ ok: true });
  }
  return null;
}
