# 素材来源与许可

栖游 VOL. 02 的地表漫反射、OpenGL 法线贴图与天空 HDR 来自 [Poly Haven](https://polyhaven.com/)，以下各项均按 [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) 提供。Poly Haven 的许可说明见 [Asset License](https://polyhaven.com/license)。

素材随项目保存在 `public/textures/`，生产构建复制到 `dist/textures/`。机器可读清单为 [`public/textures/sources.json`](public/textures/sources.json)。表中的原始文件地址对应项目采用的 1K 纹理与 2K HDR。

| 本地文件 | 素材页面 | 原始文件 URL | 许可 |
| --- | --- | --- | --- |
| [`snow-diff.jpg](public/textures/snow-diff.jpg) | [snow_02](https://polyhaven.com/a/snow_02) | [原始文件](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/snow_02/snow_02_diff_1k.jpg) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [`snow-normal.jpg](public/textures/snow-normal.jpg) | [snow_02](https://polyhaven.com/a/snow_02) | [原始文件](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/snow_02/snow_02_nor_gl_1k.jpg) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [`sand-diff.jpg](public/textures/sand-diff.jpg) | [coast_sand_01](https://polyhaven.com/a/coast_sand_01) | [原始文件](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/coast_sand_01/coast_sand_01_diff_1k.jpg) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [`sand-normal.jpg](public/textures/sand-normal.jpg) | [coast_sand_01](https://polyhaven.com/a/coast_sand_01) | [原始文件](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/coast_sand_01/coast_sand_01_nor_gl_1k.jpg) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [`grass-diff.jpg](public/textures/grass-diff.jpg) | [aerial_grass_rock](https://polyhaven.com/a/aerial_grass_rock) | [原始文件](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_grass_rock/aerial_grass_rock_diff_1k.jpg) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [`grass-normal.jpg](public/textures/grass-normal.jpg) | [aerial_grass_rock](https://polyhaven.com/a/aerial_grass_rock) | [原始文件](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_grass_rock/aerial_grass_rock_nor_gl_1k.jpg) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [`rock-diff.jpg](public/textures/rock-diff.jpg) | [rock_boulder_dry](https://polyhaven.com/a/rock_boulder_dry) | [原始文件](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rock_boulder_dry/rock_boulder_dry_diff_1k.jpg) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [`rock-normal.jpg](public/textures/rock-normal.jpg) | [rock_boulder_dry](https://polyhaven.com/a/rock_boulder_dry) | [原始文件](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rock_boulder_dry/rock_boulder_dry_nor_gl_1k.jpg) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [`sky.hdr](public/textures/sky.hdr) | [kloppenheim_06_puresky](https://polyhaven.com/a/kloppenheim_06_puresky) | [原始文件](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloppenheim_06_puresky_2k.hdr) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

漫反射文件使用 `*-diff.jpg`，法线文件使用 `*-normal.jpg`。`sky.hdr` 用于天空背景与环境光。素材作者信息可在对应素材页面查看；此文件只记录来源与适用许可，不把素材作者列为项目开发者或背书方。

山地、草甸、沙丘、海岸、岩石几何、植被轮廓、水面法线及泡沫等由项目代码生成或组合。四处地点用于地貌灵感与文字说明，不代表素材拍摄地，也不表示场景采用当地实测数据。环境音由 Web Audio 合成。

项目使用 Three.js、TypeScript 和 Vite 等开源软件；对应的软件许可独立于上述素材的 CC0 许可，详见各依赖随包附带的许可证。
