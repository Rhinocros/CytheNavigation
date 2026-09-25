// 注入 mock 数据：10 个分组 + 100 条站点
// 用法：node scripts/seed.mjs [--force]
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const dbFile = path.join(DATA_DIR, 'cythe.db');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');

const force = process.argv.includes('--force');
const gCount = db.prepare('SELECT COUNT(*) c FROM groups').get().c;
const lCount = db.prepare('SELECT COUNT(*) c FROM links').get().c;
if ((gCount > 0 || lCount > 0) && !force) {
  console.log(`已存在 ${gCount} 个分组 / ${lCount} 个站点，跳过。使用 --force 追加重置 sort。`);
  process.exit(0);
}

const GROUPS = [
  ['开发工具', '#5b7cfa'],
  ['运维监控', '#38bdf8'],
  ['数据库', '#f5b451'],
  ['AI 服务', '#a78bfa'],
  ['媒体娱乐', '#f472b6'],
  ['办公协作', '#34d399'],
  ['学习资源', '#22d3ee'],
  ['社交论坛', '#fb7185'],
  ['下载资源', '#facc15'],
  ['生活服务', '#94a3b8'],
];

const insertGroup = db.prepare('INSERT INTO groups(name,color,sort,visibility) VALUES(?,?,?,?)');
const insertLink = db.prepare(
  'INSERT INTO links(group_id,name,url,note,icon,has_thumb,scope,sort,owner_id) VALUES(?,?,?,?,?,?,?,?,?)'
);

const groupIds = [];
db.transaction(() => {
  GROUPS.forEach(([name, color], i) => {
    const info = insertGroup.run(name, color, i + 1, 'public');
    groupIds.push(Number(info.lastInsertRowid));
  });

  const NOTES = [
    '日常使用频率高', '团队协作入口', '需要内网访问', '备用实例',
    '带 Web 控制台', '仅管理员可访问', '自动备份已开启', '新上线，欢迎体验', '',
  ];
  let sort = 0;
  for (let n = 1; n <= 100; n++) {
    const gi = (n - 1) % 10;
    const gid = groupIds[gi];
    const gname = GROUPS[gi][0];
    const scope = n % 7 === 0 ? 'external' : 'internal';
    const host = scope === 'external'
      ? `svc-${String(n).padStart(3, '0')}.example.com`
      : `svc-${String(n).padStart(3, '0')}.internal`;
    insertLink.run(
      gid,
      `${gname} · 站点 ${String(n).padStart(3, '0')}`,
      `https://${host}`,
      NOTES[n % NOTES.length],
      '',
      0,
      scope,
      ++sort,
      null
    );
  }
})();

const g2 = db.prepare('SELECT COUNT(*) c FROM groups').get().c;
const l2 = db.prepare('SELECT COUNT(*) c FROM links').get().c;
console.log(`完成：分组 ${g2} 个，站点 ${l2} 条。`);
