# dsh-voice-hotkey

Minimal push-to-talk voice input for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh): **press a key, talk, stop talking — the text lands in the composer and Enter sends it.** No mouse on the way.

Recording, transcription and writing into the draft are still done by the official Voice Input bundle. This plugin only presses its buttons for you, and fills three gaps it leaves open.

[中文](README.md)

## Three things

| | |
|---|---|
| **Voice hotkey** | Default `Alt+V`, remappable. Tap to start, tap to stop; works anywhere on the page, no need to click the composer first. |
| **Silence auto-stop** | Once speech is detected, N seconds of silence ends the recording. Adjustable `0.5–10 s` on a slider, or switch it off. |
| **Focus the composer** | Default `Ctrl+Alt+I`, one key puts the caret back at the end of the composer. DSH has **no** such command of its own. |

## What other tools use to focus their input

| Tool | Shortcut | Why it can't be copied as-is |
|---|---|---|
| Cursor | `Ctrl+L` / `Cmd+L` | The browser address bar owns `Ctrl+L`, so it breaks on the web |
| VS Code · GitHub Copilot Chat | `Ctrl+Alt+I` | Free everywhere, safe on the web |
| VS Code · Claude Code | `Ctrl+Esc` / `Cmd+Esc` | On Windows this opens the Start menu |
| **this plugin** | **`Ctrl+Alt+I`** | Matches Copilot; same on web and desktop |

## Why focusing deserves its own key

The official voice plugin remembers the caret position **at the moment recording starts** and writes the transcript back there. So:

- pressing the hotkey inside the conversation puts the caret at the end of the composer first (otherwise the text has nowhere sensible to go);
- but if you clicked elsewhere in the meantime — sidebar, plugins page, another window — the caret is gone and you need the mouse again.

dsh ships no "focus the input" command, which is exactly where people get stuck. This plugin makes it a key: **press it anytime and the caret is back in the composer**, ready for `Enter`.

## Turning a hotkey off

Both hotkeys can be disabled:

- click the key to start recording, then press `Esc` to clear it to **Not set** (`Backspace` / `Delete` work too).

When a shortcut shows "Not set" that action is fully disabled — no listener, no key swallowed. A shortcut is only saved once you press a **regular key with `Ctrl`/`Alt`/`Meta`**; modifiers alone just show a hint.

## Requirements

- The official **Voice Input** bundle must be enabled. This plugin clicks its buttons; without it nothing happens.
- A browser with microphone access. Audio still travels the official path to the dsh server; this plugin adds no network requests.

## Desktop app

The dsh desktop app is an Electron shell around the same web UI, so the plugin works there unchanged: hotkey, auto-stop and focus all live in the renderer process and need no extra permissions.

Two known differences, both handled:

- `localStorage` can be blocked under `file://` or storage partitioning in Electron — settings then fall back to memory for the current session instead of throwing;
- microphone permission is granted by the desktop app; if the first recording is silent, allow the mic in the OS privacy settings.

## Install

```sh
dsh plugin --profile web add dsh-voice-hotkey
```

Or from a local checkout:

```sh
dsh plugin --profile web add /path/to/dsh-voice-hotkey
```

Reload the page. The defaults work right away (`Alt+V` to talk, `Ctrl+Alt+I` to focus); change them under **Settings → Voice hotkey**.

## Settings

Available both on the settings page and on the plugin's detail page, stored in `localStorage` (memory fallback on desktop), applied immediately:

- **Voice input hotkey** — `Alt+V` by default. Must include `Ctrl` / `Alt` / `Meta` so it never swallows normal typing.
- **Focus the composer** — `Ctrl+Alt+I` by default. The two hotkeys cannot be the same; a conflict is reported inline.
- **Stop automatically when I stop talking** — off means pure manual mode: press the hotkey again to finish.
- **Silence before stopping** — `0.5–10 s` slider.

## Limits

- Silence detection is energy-based, not semantic: pausing longer than the threshold ends the recording.
- The threshold adapts to ambient noise; in a loud room, hold-to-talk is steadier.
- No live/streaming captions — the official transcription returns the whole utterance at once.

## License

MIT
