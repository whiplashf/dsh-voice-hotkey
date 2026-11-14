# dsh-voice-hotkey 🎤

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-voice-hotkey"><img alt="npm version" src="https://img.shields.io/npm/v/dsh-voice-hotkey?label=npm&color=blue"></a>
  <a href="https://www.npmjs.com/package/dsh-voice-hotkey"><img alt="npm monthly downloads" src="https://img.shields.io/npm/dm/dsh-voice-hotkey?label=%E6%9C%88%E4%B8%8B%E8%BD%BD&color=brightgreen"></a>
  <a href="https://github.com/whiplashf/dsh-voice-hotkey/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/github/license/whiplashf/dsh-voice-hotkey?color=orange"></a>
  <a href="https://github.com/whiplashf/dsh-voice-hotkey"><img alt="stars" src="https://img.shields.io/github/stars/whiplashf/dsh-voice-hotkey?style=social"></a>
  <img alt="platform" src="https://img.shields.io/badge/platform-DeepSeek%20Harness%20Web%20%2F%20Desktop-8A2BE2">
  <img alt="deps" src="https://img.shields.io/badge/runtime%20deps-0-success">
  <img alt="network" src="https://img.shields.io/badge/network-%E9%9B%B6%E6%96%B0%E5%A2%9E%E8%AF%B7%E6%B1%82-lightgrey">
</p>

**按一下键说话，说完自动停，字落在输入框里，回车就发** —— 全程不碰鼠标，也不用去点那个小话筒。

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）官方有「语音输入」，但它少了三个最影响手感的东西：**没有快捷键**、**说完要手点停止**、**转写完焦点不回来（回车发不出去）**。这个插件只补这三件事，录音、转写、写回草稿仍然全部交给官方插件，一行都没重写。

```
Alt+V  →  说话  →  停顿 2 秒自动停  →  Enter
   ↑                                       ↓
热键开录                          字已落在输入框，直接发
```

> 不需要鼠标、不需要切换窗口、不需要等转写完成再点一下。对着一句话说完松手，回车。

---

## 快速开始（1 分钟）

**前置**：dsh 的「语音输入」官方 Bundle 已启用（插件管理 → 语音输入 → 启用，首次会下载 SenseVoice 模型，约 231 MB）。本插件只是它的遥控器，没有它就不工作。

**装法一（图形化）**：插件管理 → 安装框里填 `dsh-voice-hotkey` → 安装。

**装法二（命令行）**：

```bash
dsh plugin --profile web add dsh-voice-hotkey
# 桌面应用（Electron 版）把 web 换成 desktop
```

装完**重启 DSH**（`dsh web` 用户重启服务，桌面版重开应用）。然后：

1. 在输入框里按 **`Alt + V`** —— 开始录音；
2. 说话。**停顿 2 秒**（可调）自动结束录音并开始转写；
3. 字出现在输入框里，焦点还在，按 **`Enter`** 发送。

想手动控制也行：**短按** `Alt+V` 是开/关，**按住超过 0.5 秒再松手**是「说完即停」。

## 快捷键

| 键 | 作用 | 能不能改 |
| --- | --- | --- |
| `Alt + V` | 开始 / 停止录音 | 能，设置里重录 |
| `Ctrl + Alt + I` | 把焦点放进输入框（DSH 本身没有这个命令） | 能，可关掉 |
| `Esc`（录音中） | 取消本次录音 | — |

`Ctrl + Alt + I` 是照着主流工具选的：GitHub Copilot Chat 用的就是这个。Cursor 的 `Ctrl+L` 在网页版会被地址栏抢走，Claude Code 的 `Ctrl+Esc` 在 Windows 上是开始菜单，都不能用。

## 设置

**设置 → 语音快捷键**（或 插件 → 已安装 → dsh-voice-hotkey → 详情页底部）：

| 项 | 默认 | 说明 |
| --- | --- | --- |
| 语音快捷键 | `Alt+V` | 点一下键位就能重录；录制时按 `Esc` 清空 = 不用快捷键 |
| 聚焦快捷键 | `Ctrl+Alt+I` | 同上，也能清空 |
| 说完了自动停 | 开 | 关掉后只能手动按 `Alt+V` 停 |
| 停顿时长 | 2.0 秒 | 0.5–10 秒，250ms 一档。安静超过这个时长就算说完 |

设置存在当前浏览器的 `localStorage` 里（桌面版不可用时退回内存），改完立即生效。换浏览器、开无痕、清站点数据会回到默认——功能照常，只是热键回默认值。DSH 官方的设置同样不跨浏览器，这不是本插件的问题。

## 它到底做了什么

| | 官方语音输入 | 本插件 |
| --- | --- | --- |
| 录音 / 转写 | ✅ | 复用官方链路，不重复实现 |
| 快捷键开录 | ❌ 只能点话筒 | ✅ `Alt+V` |
| 说完自动停 | ❌ 手点「停止并识别」 | ✅ 本地能量 VAD，静音自动停 |
| 转写后能直接回车 | ❌ 焦点丢了 | ✅ 开录前先把焦点放到输入框末尾 |
| 新增网络请求 | — | ✅ 零 |
| 运行时依赖 | — | ✅ 零 |

实现方式很克制：**找到官方那几个按钮，替你点一下**（`aria-label` 为 `开始录音` / `停止并识别` / `重新录音`），再用 `getUserMedia` 自己做一路能量分析判断静音。不碰录音、不碰转写、不碰 DSH 内核，官方插件升级了也不容易碎。

## 兼容性

- **DSH Web**（`dsh web`）与 **DSH 桌面版**（Electron）都能用——同一份客户端 bundle，插件只用 DOM、`localStorage`、`navigator.mediaDevices`。
- **浏览器**：需要麦克风权限。非 `https` / 非 `localhost` 的地址浏览器不给麦克风，这是浏览器的规矩。
- **DSH 版本**：`@deepseek-ai/dsh-client-ui-conversation` 的 `^0.2.0-rc.1 || ^0.2.2-0`（peer，可选）。

## 已知边界

- **只做输入，不做输出**：没有唤醒词、没有常开麦克风、没有语音播报、不支持边说边出字（官方插件的转写是一次性的，想流式要换云 ASR）。
- **只对输入框生效**：它把字送进 DSH 的 composer，不会往别的应用里打字。
- **识别质量由官方模型决定**：SenseVoice-Small 对同音字会错（「开放时间」→「开饭时间」），重要内容请扫一眼再发。慢点说、说整句比逐字念准。
- **热键冲突**：如果 `Alt+V` 和你别的软件撞了，设置里重录一个即可（已占用的 DSH 键位是 `KeyA/B/D/F/G/K/N/O/P` 那一批 `Ctrl+Alt` 组合）。

## 常见问题

**按 `Alt+V` 没反应？**
先确认「语音输入」官方 Bundle 是启用状态、模型已就绪；再看是不是页面没焦点（点一下页面任意处）。装了别的语音增强插件（比如 `dsh-voice-prompt-enhancer`）也会抢同一个热键，两个都开会打架。

**说完不停？**
环境噪音大时 VAD 会误判：把「停顿时长」调长一点，或关掉自动停改用手动。

**换浏览器热键就回默认了？**
正常，设置存在浏览器侧（理由见「设置」一节）。

**会不会偷偷上传音频？**
不会新增任何请求。音频仍然走官方链路发到你自己跑的 dsh 服务器上，插件本身不联网。

## 开发

```bash
git clone https://github.com/whiplashf/dsh-voice-hotkey
cd dsh-voice-hotkey
dsh plugin --profile web add "$PWD"   # 以本地目录链接安装
```

改 `client.js` 后刷新页面即可（客户端半侧）；`index.js` 目前是空的 Host 半侧，改它要重启 dsh。

```
client.js        # 全部逻辑：热键、VAD、点官方按钮、设置面板
index.js         # Host 半侧（当前为空）
cordis.patch.yml # 往 profile 里插入一条插件行
locale/{zh,en}   # 文案
docs/DETAIL.md   # 更细的实现与边界说明
```

## 许可

MIT © whiplashf

---

[English](README.en.md)
