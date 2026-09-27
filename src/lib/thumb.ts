/* Cythe | 循息导航 | Cythe Navigation
 * 版权所有 © 2026 Cythe。保留所有权利。
 * 本文件版权注释不可删除。
 */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { THUMB_DIR } from './db';
import { isLanProtectedHost } from './auth';

/**
 * 截图目标准入：仅 http/https，且禁止回环/链路本地（云元数据）/组播等服务器自身地址；
 * 导航目标本身位于内网，故 RFC1918 不拦截。无法解析的 URL 一律拒绝。
 */
export function thumbTargetAllowed(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  return !isLanProtectedHost(u.hostname);
}

let browserPromise: Promise<import('playwright-core').Browser | null> | null = null;

function cacheRoots(): string[] {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return [process.env.PLAYWRIGHT_BROWSERS_PATH];
  if (process.platform === 'darwin')
    return [path.join(os.homedir(), 'Library/Caches/ms-playwright'), '/root/.cache/ms-playwright'];
  return ['/root/.cache/ms-playwright'];
}

function findExecutable(): string | undefined {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH))
    return process.env.CHROMIUM_PATH;
  const names = ['chrome', 'headless_shell', 'chrome-headless-shell'];
  for (const root of cacheRoots()) {
    if (!fs.existsSync(root)) continue;
    for (const build of fs.readdirSync(root)) {
      if (!build.startsWith('chromium')) continue;
      // layouts: <build>/<name> or <build>/<dir>/<name>
      const dirs = ['', ...fs.readdirSync(path.join(root, build))];
      for (const dir of dirs) {
        for (const n of names) {
          const p = path.join(root, build, dir, n);
          if (fs.existsSync(p)) return p;
        }
      }
    }
  }
  return undefined; // let playwright-core resolve its default
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      try {
        const { chromium } = await import('playwright-core');
        return await chromium.launch({
          executablePath: findExecutable(),
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        });
      } catch (e) {
        console.warn('[thumb] chromium unavailable:', (e as Error).message?.slice(0, 160));
        return null;
      }
    })();
    browserPromise.finally(() => {
      setTimeout(() => {
        browserPromise = null;
      }, 30_000).unref?.();
    });
  }
  return browserPromise;
}

export function thumbFile(id: number): string {
  return path.join(THUMB_DIR, `${id}.png`);
}

export async function captureThumb(url: string, id: number, timeoutMs = 20000): Promise<boolean> {
  if (!thumbTargetAllowed(url)) {
    console.warn('[thumb] blocked target:', url.slice(0, 120));
    return false;
  }
  const browser = await getBrowser();
  if (!browser) return false;
  let ctx: import('playwright-core').BrowserContext | null = null;
  try {
    ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: thumbFile(id) });
    return true;
  } catch (e) {
    console.warn('[thumb] capture failed:', (e as Error).message?.slice(0, 160));
    return false;
  } finally {
    await ctx?.close().catch(() => {});
  }
}
