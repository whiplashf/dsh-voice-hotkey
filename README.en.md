# dsh-voice-hotkey 🎤

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-voice-hotkey"><img alt="npm version" src="https://img.shields.io/npm/v/dsh-voice-hotkey?label=npm&color=blue"></a>
  <a href="https://www.npmjs.com/package/dsh-voice-hotkey"><img alt="npm monthly downloads" src="https://img.shields.io/npm/dm/dsh-voice-hotkey?label=downloads&color=brightgreen"></a>
  <a href="https://github.com/whiplashf/dsh-voice-hotkey/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/github/license/whiplashf/dsh-voice-hotkey?color=orange"></a>
  <a href="https://github.com/whiplashf/dsh-voice-hotkey"><img alt="stars" src="https://img.shields.io/github/stars/whiplashf/dsh-voice-hotkey?style=social"></a>
  <img alt="platform" src="https://img.shields.io/badge/platform-DeepSeek%20Harness%20Web%20%2F%20Desktop-8A2BE2">
  <img alt="deps" src="https://img.shields.io/badge/runtime%20deps-0-success">
</p>

**Press a key, talk, stop talking — the text lands in the composer, Enter sends it.** No mouse, no clicking the little microphone.

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) ships a Voice Input bundle, but it is missing the three things that decide whether voice input actually feels good: **no hotkey**, **you have to click stop yourself**, and **focus is lost after transcription, so Enter does nothing**. This plugin adds exactly those three. Recording, transcription and writing into the draft remain the official plugin's job — not a line of it is reimplemented.

```
Alt+V  →  speak  →  2 s of silence auto-stops  →  Enter
   ↑                                              ↓
hotkey starts                  text is already in the composer
```

---

## Quick start (1 minute)

**Prerequisite**: the official **Voice Input** bundle is enabled (Plugins → Voice input → enable; it downloads the SenseVoice model on first use, ~231 MB). This plugin is its remote control — without it, nothing works.

**Option A (GUI)**: Plugins → type `dsh-voice-hotkey` in the install box → install.

**Option B (CLI)**:

```bash
dsh plugin --profile web add dsh-voice-hotkey
# desktop app (Electron): use --profile desktop
```

**Restart DSH** afterwards (`dsh web` → restart the service; desktop → relaunch). Then:

1. Press **`Alt + V`** in the composer — recording starts;
2. Speak. **Two seconds of silence** (configurable) stops recording and transcribes;
3. The text appears in the composer with focus intact — press **`Enter`**.

Manual control also works: a **short tap** of `Alt+V` toggles; **holding it for 0.5 s and releasing** is "stop when I let go".

## Hotkeys

| Keys | What it does | Configurable |
| --- | --- | --- |
| `Alt + V` | start / stop recording | yes |
| `Ctrl + Alt + I` | focus the composer (dsh has no such command) | yes, can be disabled |
| `Esc` (while recording) | cancel this take | — |

`Ctrl + Alt + I` follows GitHub Copilot Chat. Cursor's `Ctrl+L` is swallowed by the address bar in a browser, and Claude Code's `Ctrl+Esc` is the Start menu on Windows — neither survives here.

## Settings

**Settings → Voice hotkey** (or Plugins → installed → dsh-voice-hotkey → bottom of the detail page):

| Item | Default | Notes |
| --- | --- | --- |
| Voice hotkey | `Alt+V` | click the key chip to re-record; `Esc` clears it (disables the hotkey) |
| Focus hotkey | `Ctrl+Alt+I` | same; can also be cleared |
| Auto-stop on silence | on | off = stop manually with `Alt+V` |
| Silence threshold | 2.0 s | 0.5–10 s in 250 ms steps |

Settings live in this browser's `localStorage` (falling back to memory on desktop when unavailable). They apply immediately. A different browser, private window or cleared site data resets them to defaults — the plugin still works, just with default keys. dsh's own settings are per-browser too.

## What it actually does

| | Official Voice Input | This plugin |
| --- | --- | --- |
| recording / transcription | ✅ | reuses it, no reimplementation |
| hotkey to start | ❌ click the mic | ✅ `Alt+V` |
| auto-stop on silence | ❌ click "Stop and transcribe" | ✅ local energy VAD |
| Enter right after | ❌ focus is lost | ✅ composer focused before recording |
| extra network requests | — | ✅ none |
| runtime dependencies | — | ✅ none |

The trick is deliberately small: **find the official buttons and click them for you** (`aria-label` = `开始录音` / `Start recording`, `停止并识别` / `Stop and transcribe`, `重新录音` / `Record again`), plus a `getUserMedia` energy meter for silence detection. It never touches recording, transcription or the dsh core, so official upgrades rarely break it.

## Compatibility

- **dsh web** and the **dsh desktop app** (Electron) — same client bundle; only DOM, `localStorage` and `navigator.mediaDevices`.
- **Browsers**: microphone permission required. Non-`https`, non-`localhost` pages cannot get a mic — browser rule, not ours.
- **dsh version**: peer `@deepseek-ai/dsh-client-ui-conversation` `^0.2.0-rc.1 || ^0.2.2-0` (optional).

## Known limits

- **Input only**: no wake word, no always-on mic, no speech output, no live (streaming) captions — the official transcription is one-shot.
- **Composer only**: it types into dsh's composer, not into other applications.
- **Accuracy is the official model's**: SenseVoice-Small makes homophone mistakes; skim before sending.
- **Hotkey clashes**: if `Alt+V` is taken by another app, record another combo (dsh already uses `Ctrl+Alt` + `KeyA/B/D/F/G/K/N/O/P`).

## FAQ

**`Alt+V` does nothing.** Check that the Voice Input bundle is enabled and its model is ready, and that the page has focus. Another voice plugin (e.g. `dsh-voice-prompt-enhancer`) grabbing the same hotkey will also break it.

**It never stops.** Noisy rooms confuse the VAD — raise the silence threshold or turn auto-stop off.

**My settings reset in another browser.** By design; see Settings.

**Does it upload audio?** No new requests. Audio still goes through the official path to your own dsh server.

## Development

```bash
git clone https://github.com/whiplashf/dsh-voice-hotkey
cd dsh-voice-hotkey
dsh plugin --profile web add "$PWD"   # install as a local link
```

Edit `client.js` and refresh the page; `index.js` is the (currently empty) host half and needs a restart.

```
client.js        # everything: hotkeys, VAD, clicking the official buttons, settings panel
index.js         # host half (empty for now)
cordis.patch.yml # inserts the plugin row into the profile
locale/{zh,en}   # strings
docs/DETAIL.md   # deeper implementation notes
```

## License

MIT © whiplashf

---

[中文](README.md)
