# dsh-voice-hotkey

Minimal push-to-talk voice input for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh).

dsh ships a microphone button. This plugin gives it a keyboard: **`Alt+V` starts recording, silence stops it, and what you said lands in the composer with the caret still there** — so `Enter` sends it. No mouse involved.

It is deliberately small: recording, transcription and text insertion stay in the official Voice Input bundle. This plugin only presses that bundle's buttons for you and adds the two things it does not have — a hotkey and a silence cutoff.

[中文说明](README.zh.md)

## What it does

| | |
|---|---|
| **Hotkey** | `Alt+V` — tap to start, tap again to stop. Works anywhere on the page, no need to click the composer first. |
| **Push to talk** | Hold `Alt+V` for more than 0.5 s, speak, and release to stop immediately — no waiting for silence. |
| **Silence stop** | After speech is detected, N seconds of quiet (default 2 s) stops the recording for you. Configurable 1–5 s, or switch it off entirely. |
| **Focus** | Before recording starts, the caret is put back at the end of the composer, so the transcript goes there and `Enter` sends it. |

## Requirements

- **The official Voice Input bundle must be enabled** (`语音输入` in Plugins). This plugin drives its buttons; without it the hotkey does nothing.
- Desktop browser with microphone permission. The audio is recorded in the browser and posted to the dsh server exactly as the official plugin does — this plugin adds no network path of its own.

## Install

```sh
dsh plugin --profile web add dsh-voice-hotkey
```

Or from a local checkout, add the directory itself:

```sh
dsh plugin --profile web add /path/to/dsh-voice-hotkey
```

Then reload the page. The hotkey needs no extra setup; tuning lives in **Plugins → Voice hotkey**.

## Settings

Stored in the browser's `localStorage`, applied immediately:

- **Stop automatically after silence** — off means manual mode: you stop with `Alt+V` yourself.
- **Silence before stopping** — 1 s to 5 s.

## Notes and limits

- Silence detection uses the microphone's energy envelope, not semantics. A pause longer than the setting ends the recording.
- Noise thresholds self-calibrate to the room; in very noisy rooms, hold-to-talk is the reliable mode.
- Streaming ("words appear while you speak") is not supported — the official transcriber returns the whole utterance at once.

## License

MIT
