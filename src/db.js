export async function first(db, sql, values = []) {
  return db.prepare(sql).bind(...values).first();
}
export async function all(db, sql, values = []) {
  const result = await db.prepare(sql).bind(...values).all();
  return result.results || [];
}
export async function run(db, sql, values = []) {
  return db.prepare(sql).bind(...values).run();
}
export async function batch(db, statements) { return db.batch(statements); }

export async function tableCount(db) {
  const row = await first(db, `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
  return Number(row?.n || 0);
}

export async function storageUsed(db) {
  const row = await first(db, `SELECT COALESCE(SUM(size_bytes),0) AS used FROM media_assets WHERE status NOT IN ('deleted','removed')`);
  return Number(row?.used || 0);
}
