# dsh-voice-hotkey 🎤

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-voice-hotkey"><img alt="npm" src="https://img.shields.io/npm/v/dsh-voice-hotkey?label=npm&color=blue"></a>
  <a href="https://www.npmjs.com/package/dsh-voice-hotkey"><img alt="downloads" src="https://img.shields.io/npm/dm/dsh-voice-hotkey?label=downloads&color=brightgreen"></a>
  <a href="https://github.com/whiplashf/dsh-voice-hotkey/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/github/license/whiplashf/dsh-voice-hotkey?color=orange"></a>
  <img alt="deps" src="https://img.shields.io/badge/runtime%20deps-0-success">
</p>

<p align="center">
  <b>Minimal push-to-talk voice input for DeepSeek Harness.</b><br>
  Press a hotkey, speak, silence stops it, the text lands in the composer — Enter sends, or let it press Enter for you.
</p>

<p align="center">
  <img src="assets/settings.png" width="560" alt="Voice hotkey settings panel">
</p>

## Install

```bash
dsh plugin --profile web add dsh-voice-hotkey    # from npm; use desktop for the Electron app
```

Or type `dsh-voice-hotkey` into the install box on the **Plugins** page. Restart DSH afterwards.

> Requires the official **Voice Input** bundle (it downloads the ~231 MB SenseVoice model on first use). This plugin is its remote control.

## Usage

Press the hotkey, speak, and two seconds of silence ends the take; the text lands in the composer with focus intact, Enter sends. A short tap toggles, holding and releasing means "stop when I let go".

To skip the Enter key too, turn on **Send automatically** in settings: the message goes out as soon as the transcript lands.

**Both hotkeys are yours to rebind or disable**, including a separate "focus the composer" hotkey (dsh has no such command). The silence threshold, auto-stop and auto-send live in the same panel — the screenshot above.

Settings are stored in this browser's `localStorage`.

## Notes

- Recording, transcription and writing the draft stay the official plugin's job — this one just clicks its buttons, so official upgrades rarely break it.
- **Zero dependencies, zero extra network requests.** Audio still goes through the official path to your own dsh server.
- No live captions (the official transcription is one-shot); homophones happen — skim before sending.
- Works in dsh web and the desktop app (Electron).

More detail: [docs/DETAIL.md](docs/DETAIL.md).

## License

MIT © whiplashf

[中文](README.md)
