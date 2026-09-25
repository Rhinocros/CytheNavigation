# Cythe 导航 (CytheNavigation)

自托管本地服务导航页，为多 NAS / 多服务的内网环境而生。

## 功能

- 站点导航：名称 / URL / 备注 / 分组 / 内外网标记，三种浏览模式（列表、网格卡片、大卡片）
- 图标与缩略图自动生成（内置 headless Chromium，内网地址同样可截图）
- 多用户：用户名密码注册登录、管理员开关注册与普通用户添加权限、用户管理
- 多语言（简体中文 / English）、深浅双模式 + 4 套高级配色（靛蓝/石墨/森绿/暖砂）
- 微动效：卡片浮起、光斑跟随、进场动画、背景光球
- 数据：SQLite + 本地文件缓存，全部落在挂载卷 `./data`；支持 JSON 导出/导入

## Docker 部署

```bash
docker compose up -d --build
# 访问 http://<host>:3000
```

环境变量（docker-compose.yml 可改）：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| CYTHE_HTTP_PORT | 3000 | 对外端口 |
| ADMIN_USERNAME / ADMIN_PASSWORD | (空) | 初始管理员；留空则第一个注册用户成为管理员 |
| TZ | Asia/Shanghai | 时区 |

数据持久化在 `./data`（含 cythe.db、icons、thumbs）。

## 1Panel 部署

1. 将 `1panel/cythe-navigation/` 整个目录上传到 `/opt/1panel/apps/local/`；
2. 1Panel → 应用商店 → 本地应用 → 安装，按表单填端口等参数；
3. 数据自动持久化到应用目录下 `data/`。

镜像基于 `mcr.microsoft.com/playwright`（内置 Chromium），约 2GB 属正常。

## 本地开发

```bash
npm install
npm run dev        # http://localhost:3000
# 本地缩略图功能需: npx playwright-core install chromium-headless-shell
```

## 技术栈

Next.js 15 (App Router, standalone) · better-sqlite3 · playwright-core · 自研 i18n/主题层
