# 中职舞蹈教资 · 学习工作台（网页版）

纯静态站点，网页版地址：

- GitHub Pages（开启后）：https://xxxbean.github.io/dance-teacher/
- CDN：https://cdn.jsdelivr.net/gh/xxxbean/dance-teacher@site/index.html

手机浏览器打开后 →“添加到主屏幕”即可当 App 用（离线可用，Service Worker 已预缓存全部资源）。学习数据存在浏览器本地 localStorage，换设备不同步。

## 结构

- `main` 分支：只放部署脚本，不含站点源码
- `site` 分支：由工作流自动生成，就是实际发布的整站（含 6 张手绘贴纸）

## 更新内容

本地改好 `中职舞蹈教资学习工作台` 里的文件 → 重新打包 zip → 把 `.github/workflows/pages.yml` 里的下载地址换成新链接 → 提交 main 分支即可。临时包失效时，工作流会自动从线上旧版抓取文件。
