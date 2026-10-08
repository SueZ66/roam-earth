# 栖游 · ROAM — 地球漫游计划 VOL. 02

这是独立的写实版项目 `roam-earth`，以真实地貌为灵感，默认从罗弗敦海岸开启旅程。

代码仓库：[SueZ66/roam-earth](https://github.com/SueZ66/roam-earth)。GitHub Pages 部署地址：[suez66.github.io/roam-earth](https://suez66.github.io/roam-earth/)；是否已成功发布，以仓库 Actions 与 Pages 的部署结果为准。

一个可部署到 GitHub Pages 的纯静态 3D 风景探索项目。以真实地点为灵感，在连续山地、草甸、沙丘和海岸之间切换，观察自然动态，收集旅行手记，保存风景照片。

## 四个目的地

| 目的地 | 地貌灵感 | 场景内容 |
| --- | --- | --- |
| 罗弗敦海岸 · Lofoten Coast | 挪威 Haukland Beach 豪克兰湾 | 海湾、山体、沙滩，以及动态海浪、反射与岸边泡沫 |
| 法罗群岛 · Faroe Islands | 北大西洋 Gásadalur 地区 | 起伏草甸、远山、海湾与随风摆动的草丛 |
| 瑞士阿尔卑斯山 · The Swiss Alps | 采尔马特、马特洪峰地区 | 岩石山脊、按坡度分布的积雪、针叶林与反射冰川湖 |
| 撒哈拉沙漠 · The Sahara | 摩洛哥梅尔祖卡 Erg Chebbi | 连绵沙丘、沙面细纹、风蚀岩石与低角度日光 |

场景参考上述地区的自然地貌进行程序化创作，**不是实测地形、精确数字孪生或当地实时画面**。界面的坐标指向灵感地点；场景光照和气氛为艺术设定，不代表实时天气。地表采用本地实景材质贴图，天空和环境光采用本地 2K HDR 素材。

## 交互与记录

- 拖动观察、滚轮缩放；触屏设备支持单指拖动、双指缩放。相机限制在各场景的观景区域。
- 使用底部目的地按钮，或键盘 `1`–`4` 依次切换罗弗敦海岸、法罗群岛、阿尔卑斯山、撒哈拉沙漠。
- 点击「探索这片风景」后，寻找编号观察点。每个目的地有 3 处，共 **12 处风景印记**，在「旅行手记」中查看记录。
- 镜头巡游、自然动态分别控制；空格切换镜头巡游，重置按钮恢复初始观景位置。
- 「纯净视野」隐藏界面；点击「返回界面」或按 `Esc` 恢复。
- 相机按钮将当前三维画面保存为 PNG，文件名为 `roam-场景ID.png`；照片不包含页面文字和操作按钮。
- 环境音通过 Web Audio 合成，默认关闭；右上角可开启声音或全屏。

新版进度使用 `localStorage` 键 `roam-earth-journal-v2`，保存在当前浏览器、当前站点，不需要账号，不跨浏览器或设备同步。旧版 `roam-fragments-v1` 数据保留，不自动迁移、不删除。新版「重新探索」需再次点击确认，仅重置新版记录；清除整个站点数据会清除相应站点的浏览器存储。浏览器禁止存储时仍可浏览风景，但进度可能无法保留。

## 技术与资源

项目使用 **Three.js + TypeScript + Vite**，无需后端、数据库或运行时第三方素材服务。连续地形由代码生成，植被和岩石采用合批或实例化；材质包含漫反射、法线贴图，结合 HDR 环境光与场景雾。水面包含顶点动画、法线扰动和反射，海岸另有动态泡沫。

地表贴图与天空 HDR 来自 **Poly Haven**，遵循 **CC0**，均存放在 `public/textures/`，构建后随站点一起部署。来源清单见 [`public/textures/sources.json`](public/textures/sources.json)，逐项下载地址与许可见 [`CREDITS.md`](CREDITS.md)。运行时不需要连接 Poly Haven。

当前生产构建的 `dist/` 总量约 **11.78 MB（11.23 MiB）**，其中本地纹理、HDR 与来源清单约 **11.18 MB（10.67 MiB）**。这是磁盘文件总大小，非传输压缩后的大小；后续修改和构建会有小幅变化。首次进入需要加载本地静态素材，之后可使用浏览器缓存。

需要支持 **WebGL 2** 的现代浏览器，建议启用硬件加速。设备性能、屏幕分辨率与反射渲染开销会影响帧率；音频、全屏、图片下载与本地存储也受浏览器设置影响。

## 本地运行

建议使用 Node.js **22.12 或更新版本**及 npm。在项目目录运行：

```powershell
npm ci
npm run dev
```

打开终端显示的地址。开发服务器默认绑定 `127.0.0.1`，默认端口为 `5173`；端口占用时以终端输出为准。

生成生产文件：

```powershell
npm run build
```

该命令先执行 TypeScript 检查，再构建到 `dist/`。预览生产构建：

```powershell
npm run preview
```

打开终端给出的预览地址。请通过开发服务器、预览服务器或静态托管访问，不要直接双击 `index.html`。

## 部署到 GitHub Pages

仓库提供 `.github/workflows/deploy.yml`。GitHub Pages 配置完成后，推送到 `main` 分支会触发构建与部署，也可手动运行工作流。

1. 创建或选择 GitHub 仓库，把本项目内容放在仓库根目录，确保 `package.json` 与 `.github/` 位于根目录。
2. 在仓库 **Settings → Pages → Build and deployment** 中，将 **Source** 设为 **GitHub Actions**。
3. 将代码推送到 **`main` 分支**。
4. 在 **Actions** 查看 **Deploy to GitHub Pages**；需要时通过 **Run workflow** 手动触发。
5. 等待 `build` 与 `deploy` 成功，从部署结果或 **Settings → Pages** 获取站点地址。

工作流使用 Node.js 22，运行 `npm ci` 和 `npm run build`，然后发布 `dist/`。`vite.config.ts` 配置 `base: './'`，可适配 GitHub Pages 的仓库子路径；采用其他分支时，需同步调整工作流触发分支。也可将完整 `dist/` 上传到其他静态托管服务。

这里提供的是部署配置和步骤，**不表示此版本已发布上线**；实际部署状态以目标仓库的 Actions 和 Pages 结果为准。

## 文件结构

```text
roam-earth/
├─ .github/workflows/deploy.yml  # GitHub Pages 构建与发布
├─ public/
│  └─ textures/                 # 本地 CC0 漫反射、法线贴图及 2K HDR
│     └─ sources.json           # 原始素材下载地址和许可清单
├─ src/
│  ├─ main.ts                   # 页面、渲染器、相机、观察点、照片与手记
│  ├─ style.css                 # 页面样式、纯净视野和响应式布局
│  ├─ audio.ts                  # Web Audio 环境音与收集音效
│  └─ scenes/
│     ├─ types.ts               # Landscape、相机与氛围配置接口
│     ├─ nature.ts              # 地形、材质、纹理加载与反射水面
│     ├─ meadow.ts              # 法罗群岛草甸
│     ├─ alpine.ts              # 阿尔卑斯山地与冰川湖
│     ├─ desert.ts              # Erg Chebbi 沙丘
│     └─ coast.ts               # 罗弗敦海岸与动态泡沫
├─ CREDITS.md                   # 逐项素材来源与许可
├─ index.html
├─ package.json
├─ package-lock.json
├─ tsconfig.json
└─ vite.config.ts
```

## 扩展场景

场景工厂返回 `Landscape`，包含 Three.js `Group`、观察点数组 `collectibles`、每帧调用的 `update(elapsed, delta)`，以及可选的 `view` 相机参数和 `atmosphere` 氛围参数。观察点包含世界坐标 `position`、名称 `name` 和说明 `message`；通用界面、灯光、相机控制及观察标记由 `main.ts` 管理。

修改已有场景时保持工厂接口和 3 个观察点。增加目的地时，需要同步更新 `main.ts` 中的场景注册、数量、快捷键、本地存储 ID 校验和界面文案。新增外部素材应保存在 `public/`，确认许可，并同步更新 `sources.json` 与 `CREDITS.md`。几何优先合批或实例化，并实际检查桌面和手机视口的构图与性能。
