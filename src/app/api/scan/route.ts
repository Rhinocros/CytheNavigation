/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
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
  hostPortOf,
  SCAN_GROUP_NAME,
  type ScanService,
} from '@/lib/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET：返回本机检测到的私网网段与默认端口表，供前端展示扫描范围 */
export async function GET() {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const info = detectLocalNets();
  return NextResponse.json(info);
}

/**
 * POST：经用户明确同意（consent: true）后扫描内网，仅返回预览结果，不写库。
 * 每条结果带 key(ip:port) 与 exists（是否已在扫描分组中），
 * 由前端勾选后调用 /api/scan/confirm 才真正添加。
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

  // 只读：查现有扫描分组，标记哪些已存在（前端默认不勾选这些）
  const db = getDb();
  const group = db
    .prepare('SELECT id FROM groups WHERE name=? LIMIT 1')
    .get(SCAN_GROUP_NAME) as { id: number } | undefined;
  const existingKeys = new Set(
    group
      ? (db
          .prepare('SELECT url FROM links WHERE group_id=?')
          .all(group.id) as { url: string }[]).map((l) => hostPortOf(l.url))
      : []
  );

  const items = services.map((s) => {
    const url = serviceUrl(s);
    const key = `${s.ip}:${s.port}`;
    return {
      key,
      name: deriveName(s, 'zh').slice(0, 120),
      url: url.slice(0, 500),
      note: deriveNote(s).slice(0, 500),
      exists: existingKeys.has(hostPortOf(url)),
    };
  });

  return NextResponse.json({ cidr, scanned: services.length, items });
}
