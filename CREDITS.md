# 素材来源与许可

栖游 VOL. 02 使用公开 DEM 作为部分场景的大地形参考，并结合实扫 PBR 材质、摄影测量岩石与程序化细节进行三维创作。地形数据和视觉素材分属不同许可体系；下面分别记录来源与处理方式。场景包含艺术化调整，不能视为精确测绘、现场摄影或实时景观。

## 当前地表 PBR 素材

以下 6 套素材来自 [Poly Haven](https://polyhaven.com/)，按 [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) 提供。提供方许可说明见 [Asset License](https://polyhaven.com/license)。完整下载 URL、原文件 MD5、作者、发布时间和派生文件 SHA-256 见 [`public/textures/pbr/sources.json`](public/textures/pbr/sources.json)。

| 用途与文件前缀 | 素材页面 | 作者 | 素材物理尺寸 |
| --- | --- | --- | --- |
| 草甸 / `grass-*` | [rocky_terrain_02](https://polyhaven.com/a/rocky_terrain_02) | Amal Kumar | 90 米 |
| 岩壁中尺度结构 / `cliff-*` | [rocky_terrain](https://polyhaven.com/a/rocky_terrain) | Amal Kumar | 90 米 |
| 岩石微观颗粒与近景 / `rock-*` | [dark_rock_02](https://polyhaven.com/a/dark_rock_02) | Amal Kumar | 2.001 米 |
| 湿沙 / `sand-*` | [damp_beach_sand_02](https://polyhaven.com/a/damp_beach_sand_02) | Dimitrios Savva | 1.87 米 |
| 沙丘 / `dune-*` | [sand_03](https://polyhaven.com/a/sand_03) | Charlotte Baglioni | 2 米 |
| 积雪 / `snow-*` | [snow_02](https://polyhaven.com/a/snow_02) | Rob Tuytel | 2 米 |

`dark_rock_02` 与 `damp_beach_sand_02` 的提供方发布时间分别为 2026 年 7 月、2026 年 8 月。

桌面派生素材在 `public/textures/pbr/desktop/`：`grass` 与 `rock` 漫反射为 4096×4096，其余通道为 2048×2048，包括 `cliff` 的全部通道。手机素材在 `public/textures/pbr/mobile/`，均为 1024×1024。`*-diff.webp` 为漫反射，`*-normal.webp` 为 OpenGL 法线，`*-surface.webp` 的 R、G、B 通道依次为环境遮蔽、粗糙度和高度。高度用于表面混合，并不等于新增实测几何精度。

岩壁组合 90 米航拍扫描的地质结构和约 2 米扫描的微观颗粒。前者在远处保留中尺度纹理，后者补充近景细节，减轻单靠小尺度贴图时纹理缩小后变成均匀灰色的问题。这些扫描素材并非各场景所在地的现场岩壁采样。

[`scripts/prepare-materials.py`](scripts/prepare-materials.py) 从 Poly Haven API 读取原文件信息，校验 MD5 后以 Pillow 缩放、打包并转为 WebP，同时记录派生文件尺寸和 SHA-256。原始下载缓存在忽略的 `work/material-originals/`，运行时只访问项目自身静态文件。

## 摄影测量岩石

海岸和法罗草甸的部分近景岩石使用 [Rock Moss Set 01](https://polyhaven.com/a/rock_moss_set_01)，由 Poly Haven 以 CC0 提供。它包含 6 个独立岩石网格，总计 63,127 个三角形，原始模型与 UV 保留。场景对岩石执行居中、缩放、旋转和实例化放置；其拍摄地不代表场景所标地点。

本地目录为 [`public/models/rock-moss/`](public/models/rock-moss/)，运行入口为 [`rock-moss.gltf`](public/models/rock-moss/rock-moss.gltf)，使用 2K WebP 纹理和 `EXT_texture_webp`。原始 glTF、bin 和 JPEG 同时保留。完整原始 URL、API MD5、实际校验结果和派生 hash 见 [`sources.json`](public/models/rock-moss/sources.json)。可通过 [`scripts/prepare-rock-moss.py`](scripts/prepare-rock-moss.py) 重新下载、校验和生成。

## 天空与环境光

当前 HDR 使用 Poly Haven 的 [kloofendal_48d_partly_cloudy_puresky](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)，许可为 CC0，以蓝天及层次清晰的云层作为背景与环境光。云层来自 HDR 影像，并非实时体积云模拟，也不是四个目的地各自的现场天空照片。下载地址和校验结果见 [`public/textures/sky-sources.json`](public/textures/sky-sources.json)。

| 本地文件 | 原始文件 | 经 API 核对的 MD5 |
| --- | --- | --- |
| [sky-4k.hdr](public/textures/sky-4k.hdr) | [桌面 4K HDR](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/kloofendal_48d_partly_cloudy_puresky_4k.hdr) | `816340c969d2e60d659051d13ac3c4dc` |
| [sky-mobile.hdr](public/textures/sky-mobile.hdr) | [手机 1K HDR](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_puresky_1k.hdr) | `c69498687e876bf68d2a8b8a62234eb9` |

## 地形高程数据

三个场景的大地形参考均来自 [Mapzen Terrain Tiles / AWS Open Data](https://registry.opendata.aws/terrain-tiles/) 的 Terrarium 高程瓦片。原始瓦片由多个数据集汇集而成，其许可与鸣谢要求参见 [上游 attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)。**这些高程数据不属于 Poly Haven，也不统一采用 CC0。** 重采样后的网格间距或高度量化步长不表示原始测绘精度。

### 罗弗敦海岸

挪威 Haukland–Mannen 地形来源为 Kartverket，经 Mapzen/Terrarium 分发：**Norwegian terrain data © Kartverket**，依据海岸来源记录采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。原始挪威地形源为 10 米 DTM，zoom 14 瓦片中的更密像素属于重采样。

[`public/terrain/coast-sources.json`](public/terrain/coast-sources.json) 记录 30 张瓦片 URL 与 SHA-256、局部坐标和处理步骤。项目拼接瓦片、隔点采样、将高度量化到 0.1 米，并把负海面单元截为零，再进行差分与游程编码。近岸水深、小尺度侵蚀和道具为艺术化补充。重建脚本为 [`scripts/generate-coast-dem.py`](scripts/generate-coast-dem.py)。

### 阿尔卑斯山

Riffelsee–Matterhorn 地形来自 25 张 zoom 13 瓦片，使用 601×601 采样网格与四分之一米高度量化。湖泊参考海拔为 2757 米；4478 米峰顶参考用于艺术化刀脊和沟槽细化。湖岸与近景也经过构图调整，不能视作现场扫描。

来源、瓦片 URL、坐标范围和变换说明见 [`public/terrain/alpine-dem-source.json`](public/terrain/alpine-dem-source.json)。完整上游归属文本保存在 [`alpine-dem-attribution.md`](public/terrain/alpine-dem-attribution.md)。需保留的归属包括：

> Produced using Copernicus data and information funded by the European Union – EU-DEM layers. Global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey. Distributed through Mapzen Terrain Tiles.

### 法罗群岛

Gásadalur / Vágar 地形以 62.108°N、7.434°W 为中心，来源为 Terrarium zoom 13、x=3925…3927、y=2278…2280 的 9 张瓦片，URL 格式为 `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/{x}/{y}.png`。源码 [`src/scenes/faroe-elevation.ts`](src/scenes/faroe-elevation.ts) 头部保留来源、数据归属和处理说明：四分之一米高度解码与双线性插值；场景另加表面细节与平整的小屋基底，不复现测绘建筑或当前状况。

按照源码记录保留以下上游数据集归属，并以完整上游 attribution 为准：

> Copernicus / EU-DEM data and information funded by the European Union. ArcticDEM DEM(s) created from DigitalGlobe, Inc. imagery and funded under National Science Foundation awards 1043681, 1559691 and 1542736. Global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey. Global ETOPO1 terrain data: U.S. National Oceanic and Atmospheric Administration.

## 保留的旧版素材

`public/textures/` 根目录保留部分旧版 1K JPEG 与 2K `sky.hdr` 以供兼容。它们的原始 URL 和许可仍见 [`public/textures/sources.json`](public/textures/sources.json)，不能把该旧清单当成当前运行素材的完整列表。

| 旧文件前缀 | 素材页面 | 许可 |
| --- | --- | --- |
| `grass-*` | [aerial_grass_rock](https://polyhaven.com/a/aerial_grass_rock) | CC0 |
| `rock-*` | [rock_boulder_dry](https://polyhaven.com/a/rock_boulder_dry) | CC0 |
| `sand-*` | [coast_sand_01](https://polyhaven.com/a/coast_sand_01) | CC0 |
| `snow-*` | [snow_02](https://polyhaven.com/a/snow_02) | CC0 |
| `sky.hdr` | [kloppenheim_06_puresky](https://polyhaven.com/a/kloppenheim_06_puresky) | CC0 |

## 项目创作与软件

地形表面细化、沙丘、小屋、植被、部分岩石和碎石、水面动画及泡沫由项目代码生成或组合；三向纹理投影、表面混合与重复抑制由项目着色器实现。环境音由 Web Audio 合成。素材作者在本文件中作为来源鸣谢，不表示参与项目开发或为项目背书。

Three.js、TypeScript、Vite 等开源依赖的软件许可独立于素材与地形许可，详见各依赖随包附带的许可证。
