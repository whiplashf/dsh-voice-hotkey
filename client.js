/**
 * 语音快捷键（voice-hotkey）—— 只做两件事：
 *   1. 给官方「语音输入」按钮绑一个全局热键（默认 Alt+V，轻按开/关，长按≥500ms 松手即停）
 *   2. 静音自动停（默认说完静音 2 秒自动点「停止并识别」）
 *
 * 不重写录音链路：开始/停止都是派发点击官方按钮，转写与写回仍由官方插件负责。
 */

window.__ModuleLoader__.load({
  id: 'dsh-voice-hotkey',
  factory(require) {
    // ── 设置（存本浏览器 localStorage，改完即时生效）─────────────────────────
    const STORE_KEY = 'dsh-voice-hotkey:settings';
    const DEFAULTS = { autoStop: true, silenceMs: 2000 };
    const SILENCE_CHOICES = [1000, 1500, 2000, 2500, 3000, 4000, 5000];

    function readSettings() {
      try {
        const raw = window.localStorage?.getItem(STORE_KEY);
        if (!raw) return { ...DEFAULTS };
        const parsed = JSON.parse(raw);
        return {
          autoStop: typeof parsed.autoStop === 'boolean' ? parsed.autoStop : DEFAULTS.autoStop,
          silenceMs: SILENCE_CHOICES.indexOf(Number(parsed.silenceMs)) >= 0 ? Number(parsed.silenceMs) : DEFAULTS.silenceMs,
        };
      } catch (e) { return { ...DEFAULTS }; }
    }

    function writeSettings(next) {
      try { window.localStorage?.setItem(STORE_KEY, JSON.stringify(next)); } catch (e) { /* 忽略 */ }
    }

    // ── 常量 ────────────────────────────────────────────────────────────────
    const HOTKEY_CODE = 'KeyV';     // 按住 Alt + V
    const LONG_PRESS_MS = 500;      // 按住超过这个时长，松手即停
    const POLL_MS = 100;            // VAD 轮询粒度
    const ONSET_RUN = 3;            // 连续 3 帧有声才算「开始说话」
    const START_LABELS = ['开始录音', 'Start recording'];
    const STOP_LABELS = ['停止并识别', 'Stop and transcribe'];
    const RETRY_LABELS = ['重新录音', 'Record again'];
    const PHASE_ATTR = 'data-voice-activity';

    // ── 官方相位与按钮定位（只读官方渲染结果）───────────────────────────────
    const q = (sel) => { try { return document.querySelector(sel); } catch (e) { return null; } };

    function recording() { return !!q('[' + PHASE_ATTR + '="recording"]'); }

    function findByLabels(labels, scopeSel) {
      const region = scopeSel ? q(scopeSel) : null;
      const scope = (region && typeof region.querySelectorAll === 'function') ? region : document;
      let list;
      try { list = scope.querySelectorAll('button'); } catch (e) { return null; }
      for (let i = 0; i < list.length; i++) {
        const label = list[i].getAttribute('aria-label') || '';
        if (labels.indexOf(label) >= 0 && !list[i].disabled) return list[i];
      }
      return null;
    }

    function click(el) {
      try {
        const Ev = window.MouseEvent;
        if (typeof Ev === 'function') {
          el.dispatchEvent(new Ev('click', { bubbles: true, cancelable: true }));
          return true;
        }
        el.click();
        return true;
      } catch (e) {
        try { el.click(); return true; } catch (e2) { return false; }
      }
    }

    // 开录前把光标放回输入框末尾：官方插件在开录那一刻记下选区（active.span），
    // 转写完成后把文字写回这个位置 —— 只要那时光标在框里、结束时焦点还在框里，
    // 插入完直接回车就能发送，不必再用鼠标点一下。
    function focusComposer() {
      try {
        const active = document.activeElement;
        // 人已经在某个可编辑处打字（比如别的输入框）就不抢焦点
        if (active && (active.isContentEditable
          || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

        const scoped = document.querySelector('[data-composer-input] [contenteditable="true"]');
        const all = document.querySelectorAll('[contenteditable="true"]');
        const el = scoped || (all.length === 1 ? all[0] : null);
        if (!el) return;
        el.focus({ preventScroll: false });
        // 光标落到末尾，避免插到正文中间
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (e) { /* 聚焦失败不阻断录音 */ }
    }

    function startRecording() {
      const retry = findByLabels(RETRY_LABELS, '[' + PHASE_ATTR + '="feedback"]');
      const target = retry || findByLabels(START_LABELS, null);
      if (!target) { warn('没找到官方的「开始录音」按钮：语音输入插件可能未启用。'); return false; }
      focusComposer();
      return click(target);
    }

    function stopRecording() {
      const target = findByLabels(STOP_LABELS, '[' + PHASE_ATTR + '="recording"]')
        || findByLabels(STOP_LABELS, null);
      if (!target) return false;
      const ok = click(target);
      // 点击落在启动尚未落地的瞬间会扑空：400ms 后仍在录就再补一次
      setTimeout(() => { if (recording()) { const again = findByLabels(STOP_LABELS, null); if (again) click(again); } }, 400);
      return ok;
    }

    let warned = {};
    function warn(msg) {
      if (warned[msg]) return;
      warned[msg] = true;
      try { console.warn('[voice-hotkey] ' + msg); } catch (e) { /* 忽略 */ }
    }

    // ── 静音自动停（自己的麦克风分析，双门限 + 底噪自适应）──────────────────
    let vad = null;

    async function startVad() {
      stopVad();
      const settings = readSettings();
      if (!settings.autoStop) return;   // 设置里关了静音自动停
      const md = navigator.mediaDevices;
      if (!md || typeof md.getUserMedia !== 'function') { warn('浏览器不支持录音，静音自动停不可用。'); return; }
      let stream, ac;
      try {
        stream = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
        const Ctx = window.AudioContext || window.webkitAudioContext;
        ac = new Ctx();
        const src = ac.createMediaStreamSource(stream);
        const an = ac.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
        const buf = new Float32Array(an.fftSize);
        const state = { stream, ac, an, buf, floor: 0, heard: false, run: 0, quiet: 0, timer: null };
        vad = state;
        const needQuiet = Math.max(1, Math.round(settings.silenceMs / POLL_MS));
        state.timer = setInterval(() => {
          if (!recording()) { stopVad(); return; }   // 官方已经停了（手动/热键），这边收摊
          let rms = 0;
          try {
            an.getFloatTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
            rms = Math.sqrt(sum / buf.length);
          } catch (e) { return; }
          if (!(state.floor > 0)) state.floor = Math.max(rms, 0.0005);
          else state.floor = rms < state.floor ? rms : Math.min(state.floor * 1.02, 0.05);
          const on = Math.max(state.floor * 3, 0.008);   // 开阈：确认有人说话
          const off = Math.max(state.floor * 1.8, 0.005); // 关阈：仍算在说话（迟滞）
          if (rms >= on) { state.run++; } else { state.run = 0; }
          if (state.run >= ONSET_RUN) { state.heard = true; state.quiet = 0; }
          else if (state.heard) {
            if (rms >= off) state.quiet = 0; else state.quiet++;
          }
          if (state.heard && state.quiet >= needQuiet) {
            stopVad();
            stopRecording();
          }
        }, POLL_MS);
      } catch (e) {
        warn('麦克风打不开，静音自动停不可用（热键仍可用）。');
        try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch (e2) { /* 忽略 */ }
        try { if (ac && ac.state !== 'closed') ac.close(); } catch (e3) { /* 忽略 */ }
      }
    }

    function stopVad() {
      const s = vad;
      if (!s) return;
      vad = null;
      try { clearInterval(s.timer); } catch (e) { /* 忽略 */ }
      try { if (s.stream) s.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* 忽略 */ }
      try { if (s.ac && s.ac.state !== 'closed') s.ac.close(); } catch (e) { /* 忽略 */ }
    }

    // ── 热键 ────────────────────────────────────────────────────────────────
    let pressAt = 0;

    function onKeyDown(e) {
      if (e.repeat || e.code !== HOTKEY_CODE) return;
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (recording()) { pressAt = 0; stopRecording(); stopVad(); return; }
      pressAt = Date.now();
      if (startRecording()) startVad();
    }

    function onKeyUp(e) {
      if (e.code !== HOTKEY_CODE || !pressAt) return;
      const held = Date.now() - pressAt;
      pressAt = 0;
      if (held >= LONG_PRESS_MS) { stopRecording(); stopVad(); }
    }

    // ── 设置面板（挂在「插件 → 语音快捷键」详情页里）──────────────────────────
    function settingsPanel(React) {
      const en = String(navigator.language || '').toLowerCase().startsWith('en');
      return function VoicePttSettings() {
        const [state, setState] = React.useState(readSettings);
        const update = (patch) => setState((current) => {
          const next = { ...current, ...patch };
          writeSettings(next);
          return next;
        });
        const row = { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' };
        const seconds = (ms) => String(ms / 1000) + (en ? ' s' : ' 秒');
        return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, padding: '2px 0' } },
          React.createElement('label', { style: row },
            React.createElement('input', {
              type: 'checkbox',
              checked: state.autoStop,
              onChange: (e) => update({ autoStop: e.target.checked }),
            }),
            React.createElement('span', null, en ? 'Stop automatically after silence' : '静音后自动停止')),
          React.createElement('label', { style: { ...row, opacity: state.autoStop ? 1 : 0.5 } },
            React.createElement('span', null, en ? 'Silence before stopping' : '静音多久算说完'),
            React.createElement('select', {
              disabled: !state.autoStop,
              value: String(state.silenceMs),
              onChange: (e) => update({ silenceMs: Number(e.target.value) }),
            }, SILENCE_CHOICES.map((ms) => React.createElement('option', { key: ms, value: String(ms) }, seconds(ms))))),
          React.createElement('p', { style: { margin: 0, fontSize: 12, opacity: 0.65 } },
            en
              ? 'Hotkey Alt+V (hold ≥0.5 s and release to stop). The setting applies to this browser immediately.'
              : '热键 Alt+V（按住 0.5 秒以上松手即停）。设置只存在当前浏览器，改完立即生效。'));
      };
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const install = () => {
          window.addEventListener('keydown', onKeyDown, true);
          window.addEventListener('keyup', onKeyUp, true);
          window.addEventListener('blur', () => { pressAt = 0; }, true);
        };
        const dispose = () => {
          window.removeEventListener('keydown', onKeyDown, true);
          window.removeEventListener('keyup', onKeyUp, true);
          stopVad();
        };
        if (ctx && typeof ctx.effect === 'function') ctx.effect(() => { install(); return dispose; });
        else install();

        // 插件详情页里的配置区：key 必须是本 bundle 的包名
        try {
          if (ctx && ctx.slots) {
            ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
              name: 'plugins.bundle.config',
              key: 'dsh-voice-hotkey',
            }, settingsPanel(require('react'))));
          }
        } catch (e) { warn('设置面板没挂上：' + e); }
      },
    };
  },
});
