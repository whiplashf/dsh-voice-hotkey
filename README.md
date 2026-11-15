# dsh-voice-hotkey 🎤

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-voice-hotkey"><img alt="npm" src="https://img.shields.io/npm/v/dsh-voice-hotkey?label=npm&color=blue"></a>
  <a href="https://www.npmjs.com/package/dsh-voice-hotkey"><img alt="downloads" src="https://img.shields.io/npm/dm/dsh-voice-hotkey?label=%E6%9C%88%E4%B8%8B%E8%BD%BD&color=brightgreen"></a>
  <a href="https://github.com/whiplashf/dsh-voice-hotkey/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/github/license/whiplashf/dsh-voice-hotkey?color=orange"></a>
  <img alt="deps" src="https://img.shields.io/badge/runtime%20deps-0-success">
</p>

<p align="center">
  <b>面向 DeepSeek Harness 的极简语音输入插件。</b><br>
  按一下热键说话，说完自动停，文字落进输入框 —— 回车就发，也可以让它替你按。
</p>

<p align="center">
  <img src="assets/settings.png" width="560" alt="语音快捷键设置面板">
</p>

## 安装

```bash
dsh plugin --profile web add dsh-voice-hotkey    # 从 npm 装；桌面版换成 desktop
```

或者在**插件管理**页的安装框里填 `dsh-voice-hotkey`。装完重启 DSH。

> 前置：官方「语音输入」Bundle 已启用（首次会下载约 231 MB 的 SenseVoice 模型）。本插件是它的遥控器。

## 怎么用

按一下热键开始说话，安静两秒自动结束；字落进输入框，焦点还在，回车就发。短按是开关，按住再松手是"说完即停"。

**直接用鼠标点输入框旁边的麦克风也一样**：插件盯的是官方渲染出来的录音相位，所以不管录音是谁开的，静音自动停、结束时回焦、自动发送都照常生效。

说着说着想立刻收尾？**按一下空格**就停（只在录音时生效，平时空格照常打字）。

想连回车都省掉，就把设置里的**说完自动发送**打开：转写落地后直接发出去。

或者录音时直接点右边的**发送箭头**（官方那个）：不用看文字，停止、转写、发送一次做完；再点一次取消设定。

**两个热键都能换成自己喜欢的组合，也能整个关掉**；另有「聚焦输入框」热键，用来一键把光标送回输入框（DSH 本身没有这个命令）。停顿多久算说完、要不要自动停、要不要自动发，都在设置里调——就是上面那张图。

设置存在当前浏览器的 `localStorage` 里。

## 说明

- 录音、转写、写回草稿都是官方插件的活，本插件只替你去点它的按钮 —— 官方升级不容易把它弄坏。
- **零依赖、零新增网络请求**。音频仍走官方链路到你自己的 dsh 服务器。
- 不支持边说边出字（官方转写是一次性的）；同音字会错，发前扫一眼。
- dsh web 与桌面版（Electron）都能用。

更细的实现与边界见 [docs/DETAIL.md](docs/DETAIL.md)。

## 许可

MIT © whiplashf

[English](README.en.md)
