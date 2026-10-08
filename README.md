# 栖游 · ROAM — 地球漫游计划 VOL. 02

这是独立的写实版项目 `roam-earth`，以真实照片为视觉目标，结合公开地形高程数据、实扫材质和三维建模创作自然风景，默认从罗弗敦海岸开启旅程。

代码仓库：[SueZ66/roam-earth](https://github.com/SueZ66/roam-earth)。GitHub Pages 部署地址：[suez66.github.io/roam-earth](https://suez66.github.io/roam-earth/)；是否已成功发布，以仓库 Actions 与 Pages 的部署结果为准。

一个可部署到 GitHub Pages 的纯静态 3D 风景探索项目。以真实地点为灵感，在连续山地、草甸、沙丘和海岸之间切换，观察自然动态，收集旅行手记，保存风景照片。

## 四个目的地

| 目的地 | 地貌灵感 | 场景内容 |
| --- | --- | --- |
| 罗弗敦海岸 · Lofoten Coast | 挪威 Haukland Beach 豪克兰湾 | DEM 山体与海湾轮廓、潮间带、实扫近景岩石，以及动态海浪、水深透色、反射和岸边泡沫 |
| 法罗群岛 · Faroe Islands | 北大西洋 Gásadalur / Vágar 地区 | DEM 山谷与海崖、草甸和风动草簇、实扫近景岩石，以及草顶小屋 |
| 瑞士阿尔卑斯山 · The Swiss Alps | Riffelsee 里菲尔湖望马特洪峰 | DEM 山体、细化刀脊与岩壁沟槽、按坡度分布的积雪、不规则湖岸、低矮高山草甸与湖面倒影 |
| 撒哈拉沙漠 · The Sahara | 摩洛哥梅尔祖卡 Erg Chebbi | 主次沙丘、沙面细纹、切面风蚀岩石、散落砾石与低角度日光 |

海岸、法罗群岛和阿尔卑斯山使用公开 DEM（数字高程模型）作为大地形参考；沙漠为程序化地貌创作。近岸水深、湖岸、峰顶细节、植被、建筑及道具位置包含艺术化调整，**不能视为精确测绘、数字孪生或当地实时画面**。界面坐标指向参考地点，光照与气氛为艺术设定。实扫贴图和岩石来自独立素材库，不代表采集于画面所标地点。项目以接近真实照片为目标，效果仍取决于模型细节、构图与设备渲染能力。

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

项目使用 **Three.js + TypeScript + Vite**，无需后端、数据库或运行时第三方素材服务。DEM 采样被本地编码为地形数据，由连续网格呈现；近景结合摄影测量岩石、实例化植被和程序化细节。渲染使用 AgX 色调映射、HDR 环境光、场景雾与级联阴影。水面包含波浪动画、法线扰动、随水深变化的透色和反射，海岸另有细波与浅水白沫。

`src/scenes/surface.ts` 统一管理地表与岩石细节材质：以世界坐标沿三个方向投影，减轻陡峭岩壁的纹理拉伸；保留素材的物理尺寸，结合多尺度变化降低重复感；根据坡度、高度和空间变化混合草皮、岩石、沙地或积雪。颜色、OpenGL 法线、粗糙度、环境遮蔽与高度通道参与材质分层。`landscapeMaterial` 用于连续地形，`detailMaterial` 用于道具；前者的 `scale` 控制宏观变化范围，微观纹理仍采用各素材的物理尺寸。

海岸和法罗草甸接入 6 种摄影测量苔藓岩石，通过共享几何和实例化放置在近景。法罗小屋、草簇、阿尔卑斯近岸碎石及沙漠地形仍由代码生成。观察点位置通过世界坐标投影和地形遮挡检测确定，画面由实时三维场景绘制。

当前地表使用 6 套 **Poly Haven CC0** 扫描 PBR 素材：`rocky_terrain_02` 草皮、`rocky_terrain` 航拍岩壁、`dark_rock_02` 岩石细节、`damp_beach_sand_02` 湿沙，以及 `sand_03` 沙丘和 `snow_02` 积雪。岩壁组合 90 米扫描层与约 2 米的微观纹理：前者提供远处仍可辨认的中尺度地质结构，后者提供近景颗粒，减轻远山细纹在纹理缩小时被平均成灰色的问题。WebP 贴图保存在 `public/textures/pbr/`；`*-surface.webp` 将环境遮蔽（R）、粗糙度（G）和高度（B）打包在一张贴图中。来源、作者、原文件 URL 与 MD5、派生文件尺寸与 SHA-256 见 [`PBR 来源清单`](public/textures/pbr/sources.json)。摄影测量模型及校验值见 [`岩石来源清单`](public/models/rock-moss/sources.json)。

页面在初次加载时，根据视口宽度与触控指针选择素材档位。桌面 `grass`、`rock` 漫反射为 4K，其余地表通道（包括 `cliff` 岩壁扫描层）为 2K；手机档位地表贴图为 1K。天空与环境光使用 `kloofendal_48d_partly_cloudy_puresky` 的蓝天与云层 HDR，桌面为 4K、手机为 1K；来源见 [`天空清单`](public/textures/sky-sources.json)。岩石模型目前共用 2K 纹理。桌面使用 3 级级联阴影与 1024×1024 水面反射，手机使用 2 级与 512×512 反射。首次进入会加载相应静态资源，随后可使用浏览器缓存。

所有运行素材随站点部署，运行时不需要连接 Poly Haven 或 DEM 服务。`public/textures/` 根目录仍保留部分旧版 1K JPEG 与 2K HDR 以供兼容；旧清单不等于当前运行资源列表。地形数据有独立的来源与许可要求，详见 [`CREDITS.md`](CREDITS.md)，不能统一归入材质素材的 CC0 许可。

静态阴影在场景、视口或相机发生变化时更新，镜头不动时复用；植被和岩石采用实例化或合批。场景切换前异步编译材质。

需要支持 **WebGL 2** 的现代浏览器，建议启用硬件加速。设备性能、屏幕分辨率与反射渲染开销会影响帧率；音频、全屏、图片下载与本地存储也受浏览器设置影响。

素材准备脚本见 [`scripts/prepare-materials.py`](scripts/prepare-materials.py) 和 [`scripts/prepare-rock-moss.py`](scripts/prepare-rock-moss.py)，需要 Python 3 与 Pillow；脚本从提供方 API 获取下载信息，校验原文件后生成本地派生素材。HDR 可通过 [`scripts/prepare-sky.py`](scripts/prepare-sky.py) 下载和校验。海岸 DEM 可通过 [`scripts/generate-coast-dem.py`](scripts/generate-coast-dem.py) 重建，需要额外安装 NumPy。一般运行和部署直接使用仓库内已生成的资源，无需执行这些准备脚本。

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
│  ├─ models/rock-moss/         # 六块实扫岩石、2K 纹理与 sources.json
│  ├─ terrain/                  # DEM 来源、变换说明与归属信息
│  └─ textures/
│     ├─ pbr/                   # desktop / mobile WebP 与 sources.json
│     ├─ sky-4k.hdr             # 桌面天空
│     ├─ sky-mobile.hdr         # 手机天空
│     ├─ sky-sources.json       # 当前天空来源与校验信息
│     └─ sources.json           # 保留的旧版素材来源清单
├─ scripts/                    # PBR、岩石与海岸 DEM 准备脚本
├─ src/
│  ├─ main.ts                   # 页面、渲染器、相机、观察点、照片与手记
│  ├─ style.css                 # 页面样式、纯净视野和响应式布局
│  ├─ audio.ts                  # Web Audio 环境音与收集音效
│  └─ scenes/
│     ├─ types.ts               # Landscape、相机与氛围配置接口
│     ├─ nature.ts              # 地形、基础材质、纹理加载与反射水面
│     ├─ surface.ts             # 三向投影、物理纹理尺度与 PBR 分层
│     ├─ scanned-rocks.ts       # glTF 实扫岩石加载与实例化
│     ├─ *-dem.ts               # 编码的海岸与阿尔卑斯高程采样
│     ├─ faroe-elevation.ts     # 法罗群岛高程采样与来源注释
│     ├─ meadow.ts              # 法罗群岛草甸
│     ├─ alpine.ts              # Riffelsee 湖岸与马特洪峰
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
