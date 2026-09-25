import net from 'node:net';
import os from 'node:os';
import tls from 'node:tls';

/* ---------- 类型 ---------- */

export type ScanService = {
  ip: string;
  port: number;
  /** 服务中文名（如「网页服务 (HTTP)」「SSH 远程终端」） */
  serviceZh: string;
  /** 服务英文名 */
  serviceEn: string;
  /** 分类：web = Web 管理界面；raw = 可尝试 HTTP(S) 指纹；tcp = 纯 TCP；udp = 仅标记 */
  kind: 'web' | 'raw' | 'tcp' | 'udp';
  /** Web 服务页面标题（指纹得到） */
  title: string;
  /** Web 服务 Server 响应头（可反映运行系统/软件） */
  server: string;
  /** TLS 证书主体（可反映运行系统，如 Synology DSM、ESXi） */
  certSubject: string;
  /** 是否 HTTPS 握手成功 */
  tls: boolean;
};

export type NetInfo = {
  /** 本机私网 IPv4 所在网段（默认扫描目标），如 192.168.1.0/24 */
  cidr: string;
  /** 本机私网地址列表 */
  ips: string[];
  /** 建议的常用端口 */
  ports: number[];
};

/* ---------- 常用内网服务端口表 ---------- */

type PortDef = { zh: string; en: string; kind: ScanService['kind'] };

export const COMMON_PORTS: Record<number, PortDef> = {
  21: { zh: 'FTP 文件传输', en: 'FTP', kind: 'tcp' },
  22: { zh: 'SSH 远程终端', en: 'SSH', kind: 'tcp' },
  23: { zh: 'Telnet 终端', en: 'Telnet', kind: 'tcp' },
  25: { zh: 'SMTP 邮件', en: 'SMTP', kind: 'tcp' },
  53: { zh: 'DNS 解析', en: 'DNS', kind: 'udp' },
  80: { zh: '网页服务 (HTTP)', en: 'HTTP', kind: 'web' },
  111: { zh: 'RPC 服务', en: 'RPC', kind: 'tcp' },
  135: { zh: 'Windows RPC', en: 'Windows RPC', kind: 'tcp' },
  139: { zh: 'NetBIOS 名称服务', en: 'NetBIOS', kind: 'tcp' },
  143: { zh: 'IMAP 邮件', en: 'IMAP', kind: 'tcp' },
  443: { zh: '加密网页 (HTTPS)', en: 'HTTPS', kind: 'web' },
  445: { zh: 'SMB 文件共享', en: 'SMB', kind: 'tcp' },
  546: { zh: 'DHCPv6', en: 'DHCPv6', kind: 'udp' },
  547: { zh: 'DHCPv6 服务端', en: 'DHCPv6 Server', kind: 'udp' },
  548: { zh: 'AFP 文件共享', en: 'AFP', kind: 'tcp' },
  631: { zh: 'IPP 打印服务', en: 'IPP', kind: 'raw' },
  993: { zh: 'IMAPS 邮件', en: 'IMAPS', kind: 'tcp' },
  995: { zh: 'POP3S 邮件', en: 'POP3S', kind: 'tcp' },
  1080: { zh: 'SOCKS 代理', en: 'SOCKS', kind: 'tcp' },
  1352: { zh: 'Lotus Notes', en: 'Lotus Notes', kind: 'tcp' },
  1433: { zh: 'SQL Server 数据库', en: 'SQL Server', kind: 'tcp' },
  1521: { zh: 'Oracle 数据库', en: 'Oracle', kind: 'tcp' },
  1723: { zh: 'PPTP VPN', en: 'PPTP VPN', kind: 'tcp' },
  1883: { zh: 'MQTT 消息服务', en: 'MQTT', kind: 'tcp' },
  1900: { zh: 'SSDP 设备发现', en: 'SSDP', kind: 'udp' },
  2049: { zh: 'NFS 文件共享', en: 'NFS', kind: 'tcp' },
  2181: { zh: 'ZooKeeper', en: 'ZooKeeper', kind: 'tcp' },
  2375: { zh: 'Docker API', en: 'Docker API', kind: 'raw' },
  2376: { zh: 'Docker API (TLS)', en: 'Docker API TLS', kind: 'tcp' },
  3000: { zh: '开发服务 (Grafana 等)', en: 'Dev / Grafana', kind: 'raw' },
  3128: { zh: 'Squid 代理', en: 'Squid Proxy', kind: 'raw' },
  32400: { zh: 'Plex 媒体库', en: 'Plex', kind: 'raw' },
  3260: { zh: 'Apple Time Machine', en: 'Time Machine', kind: 'tcp' },
  3306: { zh: 'MySQL 数据库', en: 'MySQL', kind: 'tcp' },
  3389: { zh: 'RDP 远程桌面', en: 'RDP', kind: 'tcp' },
  389: { zh: 'LDAP 目录', en: 'LDAP', kind: 'tcp' },
  4443: { zh: 'VMware 管理界面', en: 'VMware', kind: 'raw' },
  5000: { zh: '通用服务 / SSDP', en: 'Universal / SSDP', kind: 'raw' },
  5001: { zh: 'VMware ESXi 管理界面', en: 'VMware ESXi', kind: 'raw' },
  5005: { zh: 'NUT 电源管理', en: 'NUT', kind: 'tcp' },
  5060: { zh: 'SIP 语音', en: 'SIP', kind: 'udp' },
  5222: { zh: 'XMPP 即时通讯', en: 'XMPP', kind: 'tcp' },
  5357: { zh: 'WS-Discovery 设备发现', en: 'WS-Discovery', kind: 'raw' },
  5353: { zh: 'mDNS 设备发现', en: 'mDNS', kind: 'udp' },
  5432: { zh: 'PostgreSQL 数据库', en: 'PostgreSQL', kind: 'tcp' },
  5480: { zh: 'VideoLAN Web 界面', en: 'VideoLAN Web', kind: 'raw' },
  5601: { zh: 'Logstash', en: 'Logstash', kind: 'raw' },
  5672: { zh: 'RabbitMQ 消息队列', en: 'RabbitMQ', kind: 'raw' },
  5900: { zh: 'VNC 远程桌面', en: 'VNC', kind: 'tcp' },
  6379: { zh: 'Redis 缓存', en: 'Redis', kind: 'tcp' },
  6443: { zh: 'Kubernetes API', en: 'Kubernetes API', kind: 'tcp' },
  7000: { zh: 'Twonky 媒体库', en: 'Twonky', kind: 'raw' },
  8000: { zh: 'HTTP 备用 / ComfyUI', en: 'HTTP Alt / ComfyUI', kind: 'raw' },
  8080: { zh: 'HTTP 备用端口', en: 'HTTP Alt', kind: 'raw' },
  8081: { zh: 'HTTP 备用端口', en: 'HTTP Alt', kind: 'raw' },
  8096: { zh: 'Emby 媒体库', en: 'Emby', kind: 'raw' },
  8123: { zh: 'Home Assistant 智能家居', en: 'Home Assistant', kind: 'raw' },
  8443: { zh: 'HTTPS 备用端口', en: 'HTTPS Alt', kind: 'raw' },
  8444: { zh: 'Pi-hole 管理面板', en: 'Pi-hole', kind: 'raw' },
  8686: { zh: 'Mushroom 面板', en: 'Mushroom', kind: 'raw' },
  8788: { zh: 'Snipe-IT 资产管理', en: 'Snipe-IT', kind: 'raw' },
  8888: { zh: 'Jupyter / 备用 HTTP', en: 'Jupyter / HTTP', kind: 'raw' },
  9000: { zh: 'Portainer 容器管理', en: 'Portainer', kind: 'raw' },
  9001: { zh: '维基 / 备用 Web', en: 'Web Alt', kind: 'raw' },
  9080: { zh: 'Domoticz 智能家居', en: 'Domoticz', kind: 'raw' },
  9090: { zh: 'Prometheus 监控 / Transmission', en: 'Prometheus / Transmission', kind: 'raw' },
  9091: { zh: '同步服务', en: 'Sync Service', kind: 'raw' },
  9191: { zh: '时钟 / 开发服务', en: 'Clock / Dev', kind: 'raw' },
  9443: { zh: 'Nextcloud / Portainer 界面', en: 'Nextcloud / Portainer', kind: 'raw' },
  10000: { zh: 'Webmin / 群晖 DSM', en: 'Webmin / DSM', kind: 'raw' },
  11434: { zh: 'Ollama 大模型服务', en: 'Ollama', kind: 'raw' },
  15672: { zh: 'RabbitMQ 管理面板', en: 'RabbitMQ Mgmt', kind: 'raw' },
  19999: { zh: 'Netdata 监控', en: 'Netdata', kind: 'raw' },
  27017: { zh: 'MongoDB 数据库', en: 'MongoDB', kind: 'tcp' },
  51820: { zh: 'WireGuard VPN', en: 'WireGuard', kind: 'udp' },
  50000: { zh: 'Synology DSM 同步', en: 'Synology DSM', kind: 'tcp' },
  56660: { zh: '群晖 DSM 备用端口', en: 'Synology DSM Alt', kind: 'tcp' },
};

/** 默认扫描的 TCP 端口（udp 端口无法 TCP 探测，仅标记） */
export const DEFAULT_SCAN_PORTS = Object.keys(COMMON_PORTS)
  .map(Number)
  .filter((p) => COMMON_PORTS[p].kind !== 'udp')
  .sort((a, b) => a - b);

/* ---------- IP / CIDR 工具 ---------- */

export function ipToInt(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

export function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export function isPrivateIp(ip: string): boolean {
  const n = ipToInt(ip);
  if (n === null) return false;
  return (
    (n >>> 24) === 10 ||
    (n >>> 20 === 272 && (n & 0xffff) >= 1024 && (n & 0xffff) <= 6143) || // 172.16.0.0/12
    (n >>> 16 === 49320) || // 192.168.0.0/16
    (n >>> 24 === 127)
  );
}

/** 展开 CIDR 为可用主机地址（限制 /16 ~ /30，最多 4094 台） */
export function expandCidr(cidr: string): string[] {
  const [ip, maskStr] = cidr.split('/');
  const mask = maskStr === undefined ? 24 : Number(maskStr);
  const base = ipToInt(ip.trim());
  if (base === null || !Number.isInteger(mask) || mask < 16 || mask > 30) return [];
  const hostBits = 32 - mask;
  const count = 2 ** hostBits;
  if (count > 4096) return [];
  const netStart = (base >>> hostBits << hostBits) >>> 0;
  const out: string[] = [];
  // 跳过网络地址与广播地址
  for (let i = 1; i < count - 1; i++) out.push(intToIp(netStart + i));
  return out;
}

/** 获取本机私网 IPv4 及默认扫描网段 */
export function detectLocalNets(): NetInfo {
  const ips: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (isPrivateIp(a.address)) ips.push(a.address);
    }
  }
  const primary = ips[0];
  const cidr = primary ? `${primary.split('.').slice(0, 3).join('.')}.0/24` : '';
  return { cidr, ips, ports: DEFAULT_SCAN_PORTS };
}

/* ---------- 探测 ---------- */

/** TCP 连接探测：open / closed */
function probeTcp(ip: string, port: number, timeout = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (open: boolean) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(open);
    };
    sock.setTimeout(timeout);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    sock.connect(port, ip);
  });
}

/** HTTP(S) 指纹：取页面标题与 Server 头（反映运行的系统/软件）；错误页标题不采信，继续尝试下一协议 */
async function httpFingerprint(
  ip: string,
  port: number,
  tryTls: boolean
): Promise<{ title: string; server: string; tls: boolean } | null> {
  const schemes = tryTls ? ['https', 'http'] : ['http'];
  let best: { title: string; server: string; tls: boolean } | null = null;
  for (const scheme of schemes) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1800);
    try {
      const res = await fetch(`${scheme}://${ip}:${port}/`, {
        signal: ctrl.signal,
        redirect: 'follow',
      });
      const server = res.headers.get('server') ?? '';
      let title = '';
      if ((res.headers.get('content-type') ?? '').includes('html')) {
        const body = (await res.text()).slice(0, 64 * 1024);
        title = body.match(/<title[^>]*>([^<]{1,120})<\/title>/i)?.[1] ?? '';
        title = title.replace(/\s+/g, ' ').trim();
      }
      const cur = { title: title.slice(0, 100), server: server.slice(0, 100), tls: scheme === 'https' };
      // 错误页 / 空标题 → 不作为命名依据，且继续尝试 https 等其它协议
      if (cur.title && !/^\s*(\d{3}\b|error|not found|bad request)/i.test(cur.title)) return cur;
      cur.title = '';
      best = best ?? cur;
    } catch {
      // 继续尝试下一个 scheme
    } finally {
      clearTimeout(timer);
    }
  }
  return best;
}

/** TLS 证书指纹：自签证书的主体 / 签发者常能反映运行的系统（群晖、ESXi、路由器等） */
function tlsSniff(ip: string, port: number, timeout = 1500): Promise<{ subject: string; issuer: string } | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: { subject: string; issuer: string } | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    try {
      const sock = tls.connect(
        { host: ip, port, rejectUnauthorized: false, timeout },
        () => {
          const cert = sock.getPeerCertificate?.() as
            | { subject?: Record<string, string>; issuer?: Record<string, string> }
            | undefined;
          const pair = cert
            ? {
                subject: String(cert.subject?.CN ?? cert.subject?.O ?? '').slice(0, 100),
                issuer: String(cert.issuer?.CN ?? cert.issuer?.O ?? '').slice(0, 100),
              }
            : null;
          sock.destroy();
          finish(pair && (pair.subject || pair.issuer) ? pair : null);
        }
      );
      sock.setTimeout(timeout);
      sock.once('timeout', () => {
        sock.destroy();
        finish(null);
      });
      sock.once('error', () => finish(null));
    } catch {
      finish(null);
    }
  });
}

/**
 * 扫描 CIDR 网段的常用端口，返回开放端口对应的服务列表。
 * 仅允许私网地址段，避免误扫公网。
 */
export async function scanLan(
  cidr: string,
  ports: number[],
  opts: { concurrency?: number } = {}
): Promise<ScanService[]> {
  if (!isPrivateCidr(cidr)) throw new Error('only private CIDR ranges are allowed');
  const hosts = expandCidr(cidr);
  if (hosts.length === 0) throw new Error('invalid cidr');
  const portList = ports.filter((p) => Number.isInteger(p) && p > 0 && p <= 65535).slice(0, 120);
  if (portList.length === 0) throw new Error('no ports');

  const concurrency = opts.concurrency ?? 96;
  const jobs: { ip: string; port: number }[] = [];
  for (const ip of hosts) for (const port of portList) jobs.push({ ip, port });

  const found: ScanService[] = [];
  let cursor = 0;
  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= jobs.length) return;
      const { ip, port } = jobs[i];
      if (!(await probeTcp(ip, port))) continue;
      const def = COMMON_PORTS[port] ?? { zh: '未知服务', en: 'Unknown', kind: 'tcp' as const };
      const svc: ScanService = {
        ip,
        port,
        serviceZh: def.zh,
        serviceEn: def.en,
        kind: def.kind,
        title: '',
        server: '',
        certSubject: '',
        tls: false,
      };
      if (def.kind === 'web' || def.kind === 'raw') {
        const fp = await httpFingerprint(ip, port, def.kind === 'web' || port >= 8443);
        if (fp) {
          svc.title = fp.title;
          svc.server = fp.server;
          svc.tls = fp.tls;
        }
      }
      // 无有效 HTTP 标题时尝试 TLS 证书指纹，识别设备运行的系统
      if (!svc.title) {
        const cert = await tlsSniff(ip, port);
        if (cert) {
          svc.certSubject = [cert.subject, cert.issuer].filter(Boolean).join(' ← ');
          svc.tls = true;
        }
      }
      found.push(svc);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  found.sort((a, b) => (ipToInt(a.ip)! - ipToInt(b.ip)!) || a.port - b.port);
  return found.slice(0, 500);
}

export function isPrivateCidr(cidr: string): boolean {
  const ip = cidr.split('/')[0];
  return !!ip && isPrivateIp(ip);
}

/* ---------- 名称 / 备注自动生成（基于检测到的运行系统与服务） ---------- */

export function deriveName(s: ScanService, locale: 'zh' | 'en'): string {
  const zh = locale === 'zh';
  if (s.title) return `${s.title} [${s.ip}:${s.port}]`;
  if (s.certSubject) return `${s.certSubject.split(' ← ')[0]} [${s.ip}:${s.port}]`;
  const svc = zh ? s.serviceZh : s.serviceEn;
  return `${svc} (${s.ip}:${s.port})`;
}

export function deriveNote(s: ScanService): string {
  const bits: string[] = [];
  bits.push(`${s.serviceZh} / ${s.serviceEn}`);
  if (s.server) bits.push(`服务器 Server: ${s.server}`);
  if (s.title) bits.push(`页面标题: ${s.title}`);
  if (s.certSubject) bits.push(`TLS 证书: ${s.certSubject}`);
  bits.push(s.tls ? `https://${s.ip}:${s.port}` : `${s.ip}:${s.port}`);
  bits.push('自动扫描生成，可手动修改');
  return bits.join(' ｜ ');
}

export function serviceUrl(s: ScanService): string {
  const webLike = (s.title || s.server) && s.kind !== 'udp';
  if (webLike || s.certSubject) return `${s.tls ? 'https' : 'http'}://${s.ip}:${s.port}`;
  // 非 Web 协议：使用对应 scheme，便于识读（浏览器不能直接打开，可用对应客户端）
  const RAW_SCHEME: Record<number, string> = {
    21: 'ftp',
    22: 'ssh',
    23: 'telnet',
    139: 'smb',
    445: 'smb',
    548: 'afp',
    1433: 'mssql',
    1521: 'oracle',
    2049: 'nfs',
    3306: 'mysql',
    3389: 'rdp',
    5432: 'postgresql',
    5900: 'vnc',
    6379: 'redis',
    11211: 'memcached',
    27017: 'mongodb',
  };
  if (RAW_SCHEME[s.port]) return `${RAW_SCHEME[s.port]}://${s.ip}:${s.port}`;
  return `http://${s.ip}:${s.port}`;
}
