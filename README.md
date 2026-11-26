# 中职舞蹈教资 · 学习工作台（网页版）

纯静态站点，发布在 GitHub Pages：

https://xxxbean.github.io/dance-teacher/

- 离线可用（Service Worker 预缓存全部资源）
- 手机可「添加到主屏幕」当 App 用（PWA，独立窗口、自带图标）
- 数据存在浏览器本地 localStorage，换设备不同步

## 为什么仓库里没有源码

站点资源（含 6 张手绘贴纸）由 `.github/workflows/pages.yml` 在工作流运行时取回并直接发布为 Pages 产物，仓库只保留部署脚本。原始文件保存在本地工作目录 `中职舞蹈教资学习工作台`。

更新内容：本地改好 → 重新打包站点 zip → 替换工作流里的下载地址 → 提交触发部署；或直接改工作流里的抓取列表从线上旧版本复制后再覆盖。
