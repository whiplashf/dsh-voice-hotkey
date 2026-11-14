# 发版

```bash
./scripts/release.sh          # patch（默认），会先问一句再动手
./scripts/release.sh minor
```

它做三件事：检查「自上次 tag 以来是否真有代码改动」→ `npm version` → 推 main 和 tag。

**发版前先确认**，确认地点是跟 AI 助手的那次对话，不是 GitHub。脚本自己也会问一句（`确认发？(y/N)`），回车就是取消；要跳过提问用 `RELEASE_YES=1`。发布本身仍由 GitHub Actions + Trusted Publishing 完成，仓库里没有 npm token。

## 两条规则

- **只改文档不发版。** README、docs、assets、LICENSE 改了只推 main：GitHub 首页立刻是新的，npm 页面的 README 会停在上一版，等下次真发版一起同步。脚本会拦住你，CI 里也有一道同样的闸（`publish.yml` 的 "Does this release still change code?"）。
- **代码改了才升版号。** `client.js` / `index.js` / `cordis.patch.yml` / `locale` / `package.json` 动过，就算「代码」。

## 时间预期

- 推 tag 后 Actions 约 20 秒跑完；
- npm 上 `npm view <包> version` 能看到新版本，还要等发布队列 + Cloudflare 缓存，各约 5 分钟——不要前台等。

## 手动发版（脚本坏了时）

```bash
npm version patch -m "release: %s"
git push origin HEAD --follow-tags
```
