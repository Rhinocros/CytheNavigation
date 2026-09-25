import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, fail } from '@/lib/api';
import {
  DEFAULT_SCAN_PORTS,
  deriveName,
  deriveNote,
  scanLan,
  detectLocalNets,
  serviceUrl,
  type ScanService,
} from '@/lib/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCAN_GROUP_NAME = '内网扫描 · LAN Scan';
const SCAN_GROUP_COLOR = '#38bdf8';

/** GET：返回本机检测到的私网网段与默认端口表，供前端展示扫描范围 */
export async function GET() {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const info = detectLocalNets();
  return NextResponse.json(info);
}

/**
 * POST：经用户明确同意（consent: true）后扫描内网，
 * 将开放端口的地址自动写入单独的「内网扫描」分组，
 * 名称与备注根据检测到的服务/系统信息自动生成，后期可在站点管理中手动修改。
 */
export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => null);
  if (!body) return fail('invalid body');
  // 必须携带用户同意标记，未同意一律拒绝
  if (body.consent !== true) return fail('consent required', 403);

  const info = detectLocalNets();
  const cidr = String(body.cidr ?? '').trim() || info.cidr;
  if (!cidr) return fail('no private network detected');
  const ports = Array.isArray(body.ports)
    ? body.ports.map(Number).filter((p: number) => Number.isInteger(p) && p > 0 && p <= 65535)
    : DEFAULT_SCAN_PORTS;

  let services: ScanService[];
  try {
    services = await scanLan(cidr, ports);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'scan failed', 422);
  }

  const db = getDb();
  // 单独的扫描分组（不存在则创建）
  let group = db
    .prepare('SELECT * FROM groups WHERE name=? LIMIT 1')
    .get(SCAN_GROUP_NAME) as { id: number } | undefined;
  if (!group) {
    const max = (db.prepare('SELECT MAX(sort) m FROM groups').get() as { m: number }).m ?? 0;
    const info2 = db
      .prepare('INSERT INTO groups(name,color,sort,visibility,owner_id) VALUES(?,?,?,?,?)')
      .run(SCAN_GROUP_NAME, SCAN_GROUP_COLOR, max + 1, 'public', null);
    group = { id: Number(info2.lastInsertRowid) };
  }

  // 以 host:port 去重，重复扫描不会产生冗余链接
  const existing = db
    .prepare('SELECT id,url FROM links WHERE group_id=?')
    .all(group.id) as { id: number; url: string }[];
  const hostPortOf = (u: string) => {
    try {
      const x = new URL(u);
      return `${x.hostname}:${x.port || (x.protocol === 'https:' ? '443' : '80')}`;
    } catch {
      return u;
    }
  };
  const seen = new Set(existing.map((l) => hostPortOf(l.url)));

  const locale = 'zh';
  let sort = (db.prepare('SELECT MAX(sort) m FROM links').get() as { m: number }).m ?? 0;
  let created = 0;
  let skipped = 0;
  const items: { name: string; url: string; note: string }[] = [];
  for (const s of services) {
    const url = serviceUrl(s);
    const key = `${s.ip}:${s.port}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const name = deriveName(s, locale).slice(0, 120);
    const note = deriveNote(s).slice(0, 500);
    sort += 1;
    db.prepare(
      `INSERT INTO links(group_id,name,url,note,icon,has_thumb,scope,sort,owner_id)
       VALUES(?,?,?,?,?,?,?,?,?)`
    ).run(group.id, name, url, note, '', 0, 'internal', sort, user.id);
    items.push({ name, url, note });
    created++;
  }

  return NextResponse.json({
    cidr,
    scanned: services.length,
    created,
    skipped,
    groupId: group.id,
    groupName: SCAN_GROUP_NAME,
    items: items.slice(0, 60),
  });
}
