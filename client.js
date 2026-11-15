/**
 * 语音快捷键（voice-hotkey）—— 只做两件事：
 *   1. 给官方「语音输入」按钮绑一个可配置的全局热键（默认 Alt+V，轻按开/关，长按≥500ms 松手即停）
 *   2. 静音自动停（默认说完静音 2 秒自动点「停止并识别」）
 *
 * 不重写录音链路：开始/停止都是派发点击官方按钮，转写与写回仍由官方插件负责。
 */

window.__ModuleLoader__.load({
  id: 'dsh-voice-hotkey',
  factory(require) {
    // ── 设置（存本浏览器 localStorage，改完即时生效）─────────────────────────
    const STORE_KEY = 'dsh-voice-hotkey:settings';
    const DEFAULT_HOTKEY = { code: 'KeyV', ctrl: false, alt: true, shift: false, meta: false };
    // 默认对齐主流：Copilot Chat 用 Ctrl+Alt+I 打开/聚焦聊天，Cursor 用 Ctrl+L（浏览器里被地址栏占用）、
    // Claude Code 用 Ctrl+Esc（Windows 上是开始菜单），所以 Web 上只有 Ctrl+Alt+I 是既主流又安全的。
    const DEFAULT_FOCUS_HOTKEY = { code: 'KeyI', ctrl: true, alt: true, shift: false, meta: false };
    const DEFAULTS = {
      autoStop: true,
      autoSend: false,
      silenceMs: 2000,
      hotkey: DEFAULT_HOTKEY,
      focusHotkey: DEFAULT_FOCUS_HOTKEY,
    };
    const SILENCE_MIN = 500;
    const SILENCE_MAX = 10000;
    const SILENCE_STEP = 250;

    // 只允许「修饰键 + 一个普通键」的组合，避免热键抢走正常打字
    const MODIFIER_CODES = ['AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight'];

    function cleanHotkey(value, fallback) {
      const base = fallback || DEFAULT_HOTKEY;
      // null 是「用户主动关掉这个快捷键」，和「没设置过」要区分开
      if (value === null) return null;
      if (!value || typeof value !== 'object') return { ...base };
      if (typeof value.code !== 'string' || !/^[A-Za-z0-9]+$/.test(value.code)) return { ...base };
      const next = {
        code: value.code,
        ctrl: !!value.ctrl,
        alt: !!value.alt,
        shift: !!value.shift,
        meta: !!value.meta,
      };
      // 没有 Ctrl/Alt/Meta 的组合会抢走正常输入，退回默认
      if (!next.ctrl && !next.alt && !next.meta) return { ...base };
      return next;
    }

    function sameHotkey(a, b) {
      return !!a && !!b && a.code === b.code
        && !!a.ctrl === !!b.ctrl && !!a.alt === !!b.alt
        && !!a.shift === !!b.shift && !!a.meta === !!b.meta;
    }

    function clampSilence(ms) {
      const n = Number(ms);
      if (!isFinite(n)) return DEFAULTS.silenceMs;
      const stepped = Math.round(n / SILENCE_STEP) * SILENCE_STEP;
      return Math.min(SILENCE_MAX, Math.max(SILENCE_MIN, stepped));
    }

    // 桌面版（Electron）里 localStorage 可能被 file:// / 分区策略拦住，拦住了就退回内存存一份，
    // 至少当前会话里设置还有效，不会因为读不到而崩掉。
    let memoryRaw = null;
    function readRaw() {
      try {
        const v = window.localStorage?.getItem(STORE_KEY);
        if (typeof v === 'string' && v) return v;
      } catch (e) { /* 落到内存兜底 */ }
      return memoryRaw;
    }
    function writeRaw(value) {
      memoryRaw = value;
      try { window.localStorage?.setItem(STORE_KEY, value); } catch (e) { /* 只存内存 */ }
    }

    function readSettings() {
      try {
        const raw = readRaw();
        if (!raw) return { ...DEFAULTS, hotkey: { ...DEFAULT_HOTKEY }, focusHotkey: { ...DEFAULT_FOCUS_HOTKEY } };
        const parsed = JSON.parse(raw);
        const hotkey = cleanHotkey(parsed.hotkey, DEFAULT_HOTKEY);
        let focusHotkey = cleanHotkey(parsed.focusHotkey, DEFAULT_FOCUS_HOTKEY);
        // 两个功能撞到同一个组合时，聚焦那个退回默认，避免互相打架
        if (hotkey && focusHotkey && sameHotkey(hotkey, focusHotkey)) {
          focusHotkey = sameHotkey(DEFAULT_FOCUS_HOTKEY, hotkey) ? { code: 'KeyB', ctrl: false, alt: true, shift: false, meta: false } : { ...DEFAULT_FOCUS_HOTKEY };
        }
        return {
          autoStop: typeof parsed.autoStop === 'boolean' ? parsed.autoStop : DEFAULTS.autoStop,
          autoSend: typeof parsed.autoSend === 'boolean' ? parsed.autoSend : DEFAULTS.autoSend,
          silenceMs: clampSilence(parsed.silenceMs),
          hotkey,
          focusHotkey,
        };
      } catch (e) { return { ...DEFAULTS, hotkey: { ...DEFAULT_HOTKEY }, focusHotkey: { ...DEFAULT_FOCUS_HOTKEY } }; }
    }

    function writeSettings(next) {
      writeRaw(JSON.stringify(next));
    }

    // 把 {code,alt,...} 显示成 "Alt+V" / "Ctrl+Shift+Space"
    const CODE_NAMES = {
      Space: 'Space', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace',
      CapsLock: 'CapsLock', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
      Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
      Semicolon: ';', Quote: "'", Backquote: '`', Comma: ',', Period: '.', Slash: '/',
    };

    function codeName(code) {
      if (CODE_NAMES[code]) return CODE_NAMES[code];
      if (/^Key[A-Z]$/.test(code)) return code.slice(3);
      if (/^Digit[0-9]$/.test(code)) return code.slice(5);
      if (/^Numpad[0-9]$/.test(code)) return 'Num' + code.slice(6);
      return code;
    }

    function formatHotkey(h) {
      const parts = [];
      if (h.ctrl) parts.push('Ctrl');
      if (h.alt) parts.push('Alt');
      if (h.shift) parts.push('Shift');
      if (h.meta) parts.push('Meta');
      parts.push(codeName(h.code));
      return parts.join('+');
    }

    function matchesHotkey(e, h) {
      if (e.code !== h.code) return false;
      return e.ctrlKey === h.ctrl && e.altKey === h.alt && e.shiftKey === h.shift && e.metaKey === h.meta;
    }

    // ── 常量 ────────────────────────────────────────────────────────────────
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

    // 自动发送：官方发送按钮的 aria-label 取自语言包的 input.send
    const SEND_LABELS = ['发送消息', 'Send message'];

    function composer() {
      const scoped = document.querySelector('[data-composer-input] [contenteditable="true"]');
      if (scoped) return scoped;
      const all = document.querySelectorAll('[contenteditable="true"]');
      return all.length === 1 ? all[0] : null;
    }

    // 输入框里当前的文字（含你原本手打的内容），用来判断转写到底有没有落进来
    function composerText() {
      const el = composer();
      if (!el) return '';
      return String(el.innerText || el.textContent || '');
    }

    function sendComposer() {
      const button = findByLabels(SEND_LABELS, null);
      if (button) {
        // 这次是程序代点的，别被「录音中点发送 = 转完再发」的拦截器再拦一次
        bypassSendClick = true;
        try { return click(button); } finally { bypassSendClick = false; }
      }
      // 没有发送按钮（例如正在生成时按钮变成「停止」）：退回合成一次回车
      const el = composer();
      if (!el) return false;
      const make = (type) => new window.KeyboardEvent(type, {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true,
      });
      el.dispatchEvent(make('keydown'));
      el.dispatchEvent(make('keyup'));
      return true;
    }

    // 转写写回是异步的，可能比相位归位晚几十毫秒，所以隔一会儿再确认有没有新字
    let sendTimer = null;

    function stopAutoSend() {
      if (sendTimer) { clearTimeout(sendTimer); sendTimer = null; }
    }

    function autoSendAfterTranscribe(attempt, force) {
      stopAutoSend();
      const tries = typeof attempt === 'number' ? attempt : 0;
      const forced = !!force;                      // 本轮是「点发送按钮」明确要求的，不受设置开关影响
      const baseline = sessionBaseline;
      const target = sessionComposer;
      sendTimer = setTimeout(() => {
        sendTimer = null;
        if (!forced && !readSettings().autoSend) return; // 中途关掉就不再发
        if (sessionActive) return;                 // 新一轮录音已经开始，旧的作废
        // 只认「同一个输入框、比开录前多了字」：手动取消、转写失败、切会话都不该触发发送
        if (composer() !== target || composerText().length <= baseline.length) {
          if (tries < 6) autoSendAfterTranscribe(tries + 1, forced);
          return;
        }
        sendComposer();
      }, tries === 0 ? 180 : 200);
    }

    // ── 相位观测：不管录音是谁开的，结束都走同一套收尾 ─────────────────────
    // 官方插件把相位写在 DOM 上（requesting / recording / transcribing / feedback，idle 时整行消失）。
    // 本插件自己开录时会顺手做收尾，但用鼠标点官方那个麦克风开录时完全绕过我们 ——
    // 所以统一盯住这个相位：静音自动停、结束时把光标送回输入框、按设置自动发送，两种入口一致。
    let sessionActive = false;   // 当前这一轮录音是否还在进行
    let sessionBaseline = '';    // 开录前输入框里已有的文字，用来看转写有没有真的落进来
    let sessionComposer = null;  // 开录时那个输入框节点，切会话后就不该再发旧内容
    let sendOnFinish = false;    // 这一轮点了「转完就发」：转写落地后直接按发送
    let recStart = 0;            // 这一轮真正开始录音的时间戳（画时长用）
    let clockTimer = null;       // 录音行的计时器（每 250ms 刷新一次时长文本）
    let lastPhase = 'idle';
    let phaseObserver = null;
    let phaseScheduled = false;

    function phaseNow() {
      if (q('[' + PHASE_ATTR + '="recording"]')) return 'recording';
      const row = q('[' + PHASE_ATTR + ']');
      if (!row) return 'idle';
      return row.getAttribute(PHASE_ATTR) === 'feedback' ? 'feedback' : 'active';
    }

    function onPhase(phase) {
      // 新一轮录音开始（不管热键还是鼠标）：记下基线，并把上一轮没发出去的定时器作废
      if (phase !== 'idle' && !sessionActive) {
        sessionActive = true;
        sendOnFinish = false;   // 「转完就发」只对点它的那一轮生效
        stopAutoSend();
        sessionComposer = composer();
        sessionBaseline = composerText();
      }
      if (!sessionActive) return;
      // 麦克风真正开录才算「说完」，requesting 阶段还没声音可判
      if (phase === 'recording') { if (!recStart) recStart = Date.now(); startClock(); startVad(); return; }
      // 转写失败/待确认（feedback）：这轮作废，别把「转完即发」留到下一轮
      if (phase === 'feedback') { sendOnFinish = false; recStart = 0; stopClock(); syncCaptureRow(); return; }
      // 转写阶段：时长停住，等文字落地
      if (phase === 'transcribing') { stopClock(); syncCaptureRow(); return; }
      if (phase !== 'idle') return;
      // 这一轮结束了。说话过程中人可能去点了别处，焦点跑了 —— 送回输入框末尾
      sessionActive = false;
      recStart = 0;
      stopVad();
      stopClock();
      const forceSend = sendOnFinish;   // 录音/转写时点了发送按钮
      sendOnFinish = false;
      syncCaptureRow();
      const sameComposer = composer() === sessionComposer;
      focusComposer();
      if (!sameComposer || composerText().length <= sessionBaseline.length) { stopAutoSend(); return; }
      if (forceSend) { autoSendAfterTranscribe(0, true); return; }
      if (readSettings().autoSend) autoSendAfterTranscribe();
    }

    function checkPhase() {
      phaseScheduled = false;
      const phase = phaseNow();
      if (phase !== lastPhase) {
        lastPhase = phase;
        try { onPhase(phase); } catch (e) { warn('相位收尾失败：' + e); }
      }
      syncCaptureRow();
    }

    // 界面在流式输出时 DOM 变动非常密集，50ms 合并一次足够，别跟着每一次变动跑
    function schedulePhaseCheck() {
      if (phaseScheduled) return;
      phaseScheduled = true;
      setTimeout(checkPhase, 50);
    }

    function observePhases() {
      if (phaseObserver) return;
      lastPhase = phaseNow();
      try {
        phaseObserver = new MutationObserver(schedulePhaseCheck);
        phaseObserver.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: [PHASE_ATTR],
        });
      } catch (e) {
        phaseObserver = null;
        warn('相位观测没挂上，鼠标开录的收尾可能失效：' + e);
      }
      // 插件在录制中途才加载（热重载、切回来）时，也要接管这一轮
      if (lastPhase !== 'idle') onPhase(lastPhase);
      syncCaptureRow();
    }

    function unobservePhases() {
      if (!phaseObserver) return;
      try { phaseObserver.disconnect(); } catch (e) { /* 忽略 */ }
      phaseObserver = null;
      phaseScheduled = false;
      sessionActive = false;
      sendOnFinish = false;
      syncCaptureRow();
    }

    function startRecording() {
      const retry = findByLabels(RETRY_LABELS, '[' + PHASE_ATTR + '="feedback"]');
      const target = retry || findByLabels(START_LABELS, null);
      if (!target) { warn('没找到官方的「开始录音」按钮：语音输入插件可能未启用。'); return false; }
      focusComposer();
      stopAutoSend();
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

    // ── 复用官方那个发送箭头：录音/转写中点它 = 「转完就发」 ─────────────────
    // 官方录音行本来就 有 X（取消）和停止（开始转写），发送箭头也一直在右边；
    // 再插一个纸飞机就会一屏两个发送，所以不新增按钮，改成接管官方那个箭头的点击：
    //   · 录音中点 → 停止、转写、落地后直接发送（不用看文字）
    //   · 转写中点 → 同样只是设标记，等转写落地再发
    //   · 再点一次 → 取消设定
    // 非录音/转写阶段完全不拦，正常发送不受影响。
    const ARMED_ATTR = 'data-voice-hotkey-armed';
    const CHIP_ATTR = 'data-voice-hotkey-chip';
    let bypassSendClick = false;

    function onSendClickCapture(event) {
      if (bypassSendClick || !sessionActive) return;
      const target = event.target && event.target.closest ? event.target.closest('button') : null;
      if (!target) return;
      const label = target.getAttribute('aria-label') || '';
      if (SEND_LABELS.indexOf(label) < 0) return;   // 不是官方发送箭头
      // 直接读官方相位：phaseNow() 会把 transcribing 归成 'active'，这里要原值
      const row = q('[' + PHASE_ATTR + ']');
      const phase = row ? row.getAttribute(PHASE_ATTR) : 'idle';
      if (phase !== 'recording' && phase !== 'transcribing') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (sendOnFinish) { sendOnFinish = false; syncCaptureRow(); return; }  // 再点一次 = 取消
      sendOnFinish = true;
      syncCaptureRow();
      if (phase === 'recording') { stopRecording(); stopVad(); }
    }

    function isEn() { return String(navigator.language || '').toLowerCase().startsWith('en'); }

    function ensureArmedChip(row) {
      let chip = row.querySelector('[' + CHIP_ATTR + ']');
      if (!sendOnFinish) { if (chip) chip.remove(); return; }
      if (chip) return;
      const en = isEn();
      chip = document.createElement('span');
      chip.className = 'vhk-armed';
      chip.setAttribute(CHIP_ATTR, '');
      chip.textContent = en ? 'Sends when ready' : '转完即发';
      chip.title = en ? 'Click to cancel' : '点击取消';
      chip.addEventListener('mousedown', (event) => { event.preventDefault(); });
      chip.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        sendOnFinish = false;
        syncCaptureRow();
      });
      row.appendChild(chip);
    }

    // 相位变化、或 React 重渲染时：同步提示、发送箭头高亮、状态字/红点/时长
    function syncCaptureRow() {
      try {
        // 热重载后页面上可能还挂着旧版注入的纸飞机，清掉
        const stale = document.querySelectorAll('[data-voice-hotkey-send]');
        for (let i = 0; i < stale.length; i++) stale[i].remove();
        const sendBtn = findByLabels(SEND_LABELS, null);
        if (sendBtn) sendBtn.setAttribute(ARMED_ATTR, sendOnFinish ? 'true' : 'false');
        const row = q('[' + PHASE_ATTR + ']');
        if (!row) return;
        ensureArmedChip(row);
        ensureCaptureParts(row);
      } catch (e) { /* 忽略：提示画不出来不影响录音本身 */ }
    }

    // ── 录音行的状态字 / 红点 / 时长 ───────────────────────────────────────
    // 官方那行只有 X + 波形 + 停止，看不出「在听」和录了多久。这里补三样：
    // 「正在聆听…」一行、左侧呼吸红点、右侧 0:07 这样的时长（转写时停住）。
    function ensureCaptureParts(row) {
      const phase = row.getAttribute(PHASE_ATTR);
      const live = phase === 'recording';   // 一停录，红点和计时立刻收掉，不等转写结束
      // 状态字不塞进这行了：占一行会把按钮挤下去，只保留红点和时长
      const staleStatus = row.querySelector('.vhk-status'); if (staleStatus) staleStatus.remove();
      row.classList.remove('vhk-live');
      if (!live) {
        for (const sel of ['.vhk-dot', '.vhk-time']) {
          const node = row.querySelector(sel); if (node) node.remove();
        }
        return;
      }
      if (!row.querySelector('.vhk-dot')) {
        const dot = document.createElement('span');
        dot.className = 'vhk-dot';
        dot.setAttribute('aria-hidden', 'true');
        row.insertBefore(dot, row.firstChild);
      }
      let time = row.querySelector('.vhk-time');
      if (!time) {
        time = document.createElement('span');
        time.className = 'vhk-time';
        const firstButton = row.querySelector('button');
        row.insertBefore(time, firstButton);   // 放在按钮左边（CSS order 兜底）
      }
      time.textContent = elapsedText();
    }

    function elapsedText() {
      const s = recStart ? Math.max(0, Math.round((Date.now() - recStart) / 1000)) : 0;
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    function startClock() {
      if (clockTimer) return;
      clockTimer = setInterval(() => {
        const row = q('[' + PHASE_ATTR + ']');
        if (!row) { stopClock(); return; }
        const time = row.querySelector('.vhk-time');
        if (time) time.textContent = elapsedText();
      }, 250);
    }

    function stopClock() {
      if (!clockTimer) return;
      clearInterval(clockTimer);
      clockTimer = null;
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
      if (vad) return;                  // 这一轮已经在分析了，别重复开一路麦克风
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
    // 设置面板正在录制新热键时，这个函数不为 null：此时全局热键让路
    let captureKey = null;

    // 录音中按空格 = 立刻停止并转写，和点官方的「停止并识别」等价。
    // 只在录音（含正在启动的那几百毫秒）时拦截，平时空格照常打字。
    function spaceStopsCapture() {
      const phase = phaseNow();
      if (phase === 'recording') return true;
      if (phase !== 'active' || !sessionActive) return false;
      // requesting：官方按钮还没出现就别拦，免得把空格吞掉
      return Boolean(findByLabels(STOP_LABELS, null));
    }

    function onKeyDown(e) {
      if (captureKey) return;
      if (e.repeat) return;
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing && spaceStopsCapture()) {
        e.preventDefault();
        e.stopPropagation();
        pressAt = 0;
        stopRecording();
        stopVad();
        return;
      }
      const settings = readSettings();
      // 聚焦输入框：DSH 自己没注册这个命令，这里补上（对任何界面都有效）
      if (settings.focusHotkey && matchesHotkey(e, settings.focusHotkey)) {
        e.preventDefault();
        e.stopPropagation();
        focusComposer();
        return;
      }
      if (!settings.hotkey || !matchesHotkey(e, settings.hotkey)) return;
      e.preventDefault();
      e.stopPropagation();
      if (recording()) { pressAt = 0; stopRecording(); stopVad(); return; }
      pressAt = Date.now();
      // 静音自动停由相位观测统一启动，鼠标点麦克风开录时也照样生效
      startRecording();
    }

    function onKeyUp(e) {
      if (captureKey || !pressAt) return;
      const hotkey = readSettings().hotkey;
      if (!hotkey || e.code !== hotkey.code) return;
      const held = Date.now() - pressAt;
      pressAt = 0;
      if (held >= LONG_PRESS_MS) { stopRecording(); stopVad(); }
    }

    // ── 样式（跟 DSH 主题变量走，深浅色都自适应）────────────────────────────
    const CSS_ID = 'dsh-voice-hotkey-styles';

    function ensureStyles() {
      try {
        if (document.getElementById(CSS_ID)) return;
        const style = document.createElement('style');
        style.id = CSS_ID;
        style.textContent = `
.vhk-wrap{display:flex;flex-direction:column;gap:6px;max-width:700px;color:var(--dsw-alias-label-primary,#e8e8e8)}
.vhk-head{display:flex;flex-direction:column;gap:5px;margin:0 0 6px}
.vhk-title{margin:0;font-size:15px;font-weight:600;line-height:1.4}
.vhk-sub{margin:0;font-size:12.5px;line-height:1.65;color:var(--dsw-alias-label-tertiary,rgba(140,140,140,.9))}
.vhk-group{margin:12px 0 6px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,rgba(180,180,180,.9))}
.vhk-card{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-bg-layer-3,rgba(128,128,128,.06));border-radius:10px;overflow:hidden}
.vhk-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:11px 14px;min-height:54px;box-sizing:border-box}
.vhk-row+.vhk-row{border-top:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.25))}
.vhk-text{display:flex;flex-direction:column;gap:3px;min-width:0}
.vhk-label{font-size:13.5px;line-height:1.35}
.vhk-hint{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary,rgba(140,140,140,.9))}
.vhk-kbd{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;
  padding:6px 13px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.45));
  background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.10));color:inherit;cursor:pointer;white-space:nowrap;
  transition:border-color .15s ease,background .15s ease}
.vhk-kbd:hover{border-color:var(--dsw-alias-state-business-primary,#4f9cf9)}
.vhk-kbd.vhk-capturing{border-color:var(--dsw-alias-state-business-primary,#4f9cf9);
  background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f9cf9) 14%,transparent);
  color:var(--dsw-alias-state-business-primary,#4f9cf9)}
.vhk-switch{flex:none;position:relative;width:36px;height:21px;border-radius:999px;padding:0;cursor:pointer;
  border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.45));
  background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.22));transition:background .15s ease,border-color .15s ease}
.vhk-switch.vhk-on{background:var(--dsw-alias-state-business-primary,#4f9cf9);border-color:transparent}
.vhk-knob{position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;
  transition:transform .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.vhk-switch.vhk-on .vhk-knob{transform:translateX(15px)}
.vhk-right{display:flex;align-items:center;gap:12px;flex:none}
.vhk-range{width:190px;accent-color:var(--dsw-alias-state-business-primary,#4f9cf9);cursor:pointer}
.vhk-val{min-width:62px;text-align:right;font-size:12.5px;font-variant-numeric:tabular-nums;
  color:var(--dsw-alias-label-secondary,rgba(180,180,180,.95))}
.vhk-right{display:flex;align-items:center;gap:6px;flex:none}
.vhk-kbd.vhk-off{color:var(--dsw-alias-label-tertiary,rgba(140,140,140,.9));border-style:dashed}
.vhk-foot{margin:12px 0 2px;font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-tertiary,rgba(140,140,140,.85))}
.vhk-disabled{opacity:.45;pointer-events:none}
/* 录音行：「红点 · 波形 · 时长」在左，取消 / 确认聚右 */
[data-voice-activity]{gap:8px!important;align-items:center}
[data-voice-activity]>button{order:3;flex:none;min-width:34px;width:34px;height:34px;padding:0;border-radius:999px;
  background:transparent!important;color:var(--dsw-alias-label-secondary,#aaa)}
[data-voice-activity]>button:hover{color:inherit;
  background:var(--dsw-alias-interactive-bg-hover-solid,rgba(128,128,128,.2))!important}
[data-voice-activity]>button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4f9cf9);outline-offset:1px}
[data-voice-activity]>svg{order:1;height:24px}
/* 录音中的呼吸绿点 */
.vhk-dot{order:1;flex:none;margin-left:10px;width:7px;height:7px;border-radius:50%;
  background:var(--dsw-alias-state-success-primary,#3fbf7f);
  animation:vhk-pulse 1.6s ease-out infinite}
@keyframes vhk-pulse{0%{box-shadow:0 0 0 0 rgba(63,191,127,.55)}70%{box-shadow:0 0 0 5px rgba(63,191,127,0)}100%{box-shadow:0 0 0 0 rgba(63,191,127,0)}}
/* 已录时长，转写时停住 */
.vhk-time{order:2;flex:none;font-size:14px;line-height:1;font-variant-numeric:tabular-nums;
  color:var(--dsw-alias-label-secondary,#9aa0aa);min-width:32px;text-align:right}
/* 取消和确认统一成同一套线条：16px、1.6 描边、同样的灰；官方图标换成自绘 mask */
[data-voice-activity]>button:first-of-type svg{display:none}
[data-voice-activity]>button:first-of-type::before{content:"";width:18px;height:18px;background:currentColor;
  -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='1.6' stroke-linecap='round'%3E%3Cpath d='M4 4l8 8M12 4l-8 8'/%3E%3C/svg%3E") center/18px 18px no-repeat;
  mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='1.6' stroke-linecap='round'%3E%3Cpath d='M4 4l8 8M12 4l-8 8'/%3E%3C/svg%3E") center/18px 18px no-repeat}
[data-voice-activity="recording"]>button:last-of-type svg{display:none}
[data-voice-activity="recording"]>button:last-of-type::before{content:"";width:18px;height:18px;background:currentColor;
  -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 8.6l3.2 3.2L13 4.6'/%3E%3C/svg%3E") center/18px 18px no-repeat;
  mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 8.6l3.2 3.2L13 4.6'/%3E%3C/svg%3E") center/18px 18px no-repeat}
/* 「转完即发」提示：点了官方发送箭头后出现，点它取消 */
[data-voice-activity]>.vhk-armed{order:4;flex:none;min-width:auto}
.vhk-armed{display:inline-flex;align-items:center;flex:none;padding:2px 9px;border-radius:999px;
  font-size:12px;line-height:1.6;white-space:nowrap;cursor:pointer;user-select:none;
  color:var(--dsw-alias-state-business-primary,#4f9cf9);
  background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f9cf9) 12%,transparent);
  border:1px solid color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f9cf9) 35%,transparent)}
.vhk-armed:hover{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f9cf9) 20%,transparent)}
.vhk-provider{position:relative;display:inline-flex;align-items:center;flex:none;color:var(--dsw-alias-label-secondary,#a8a8a8)}
/* 右侧控制簇里排在模型选择器之后，这样下拉就紧贴在麦克风左边 */
*:has(> .vhk-provider){display:flex;align-items:center;gap:8px}
*:has(> .vhk-provider) > :not(.vhk-provider){order:0}
*:has(> .vhk-provider) > .vhk-provider{order:1}
/* chip 完全照抄官方模型选择器 trigger 的尺寸/字号/圆角/悬停 */
.vhk-provider-trigger{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 4px 0 8px;border:none;
  border-radius:var(--dsw-radius-sm,6px);background:transparent;color:inherit;font:inherit;font-size:13px;
  line-height:20px;font-weight:400;font-family:inherit;max-width:170px;cursor:pointer}
.vhk-provider-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16))}
.vhk-provider-trigger:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4f9cf9))}
.vhk-provider-trigger[disabled]{opacity:.55;cursor:default}
.vhk-provider-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vhk-provider-chevron{flex:0 0 auto;width:12px;height:12px;background:currentColor;
  -webkit-mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M4.5 6.5 8 10 11.5 6.5' fill='none' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>") center/12px 12px no-repeat;mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M4.5 6.5 8 10 11.5 6.5' fill='none' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>") center/12px 12px no-repeat}
/* 弹层：和官方菜单同一材质（bg-layer-2 底、10px 圆角、elevation 阴影、4px 内边距） */
.vhk-provider-menu{position:absolute;right:0;bottom:calc(100% + 8px);z-index:1100;display:flex;flex-direction:column;
  gap:2px;width:max-content;min-width:200px;max-width:min(320px,calc(100vw - 24px));
  max-height:min(360px,calc(100dvh - 96px));overflow:auto;padding:4px;border-radius:10px;
  background:var(--dsw-alias-bg-layer-2,#2a2a2c);box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.45));
  color:var(--dsw-alias-label-primary,#e6e6e6)}
.vhk-provider-item{display:flex;align-items:center;gap:8px;width:100%;min-height:34px;padding:0 8px;border:none;
  border-radius:var(--dsw-radius-md,8px);background:transparent;color:inherit;font:inherit;font-size:13px;
  line-height:20px;text-align:left;cursor:pointer}
.vhk-provider-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16))}
.vhk-provider-item:focus-visible{outline:none;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16))}
.vhk-provider-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vhk-provider-loc{flex:0 0 auto;color:var(--dsw-alias-label-tertiary,#8a8a8a);font-size:12px}
.vhk-provider-check{flex:0 0 auto;width:12px;height:12px;background:var(--dsw-alias-state-business-primary,#4f9cf9);
  -webkit-mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M3 8.6l3.2 3.2L13 4.6' fill='none' stroke='%23000' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/></svg>") center/12px 12px no-repeat;mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M3 8.6l3.2 3.2L13 4.6' fill='none' stroke='%23000' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/></svg>") center/12px 12px no-repeat}
.vhk-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* 官方发送箭头：已设定时描一圈，表示「这一轮转完就发」 */
button[data-voice-hotkey-armed="true"]{box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f9cf9) 55%,transparent)}
`;
        document.head.appendChild(style);
      } catch (e) { warn('样式没注入：' + e); }
    }

    // ── 设置面板 ────────────────────────────────────────────────────────────
    // 同一个组件挂两处：设置页的「语音快捷键」分区，以及插件详情页的配置区。
    function settingsPanel(React) {
      const en = String(navigator.language || '').toLowerCase().startsWith('en');
      const t = (zh, english) => (en ? english : zh);
      const h = React.createElement;

      function Switch(props) {
        return h('button', {
          type: 'button',
          role: 'switch',
          'aria-checked': props.checked ? 'true' : 'false',
          className: 'vhk-switch' + (props.checked ? ' vhk-on' : ''),
          onClick: () => props.onChange(!props.checked),
        }, h('span', { className: 'vhk-knob' }));
      }

      // 一行「标签 + 说明 + 可录制的键位」
      function HotkeyRow(props) {
        const [capturing, setCapturing] = React.useState(false);
        const [hint, setHint] = React.useState('');
        React.useEffect(() => {
          if (!capturing) return undefined;
          const onKey = (e) => {
            if (e.repeat) return;
            e.preventDefault();
            e.stopPropagation();
            // Esc 是「清空」：录制中按 Esc 就把这个热键设为未设置（不是放弃修改）。
            // 只有按下带 Ctrl/Alt/Meta 的普通键才算设置成功；只按修饰键只提示、不落盘。
            if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'Delete') {
              if (e.code !== 'Escape' && (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey)) {
                setHint(t('Backspace / Delete 单独按才能清空', 'Press Backspace / Delete on its own to clear'));
                return;
              }
              props.onChange(null);
              setCapturing(false);
              setHint('');
              return;
            }
            if (MODIFIER_CODES.indexOf(e.code) >= 0) {
              setHint(t('继续按一个普通键，组合成快捷键', 'Now press a regular key to complete the shortcut'));
              return;
            }
            const next = { code: e.code, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };
            if (!next.ctrl && !next.alt && !next.meta) {
              setHint(t('必须带 Ctrl、Alt 或 Meta，否则会抢走正常打字', 'Must include Ctrl, Alt or Meta, otherwise it would swallow normal typing'));
              return;
            }
            if (props.conflict && sameHotkey(next, props.conflict)) {
              setHint(t('这个组合已经用在另一个功能上了，换一个', 'That combination already drives the other action — pick another'));
              return;
            }
            props.onChange(next);
            setCapturing(false);
            setHint('');
          };
          captureKey = onKey;
          window.addEventListener('keydown', onKey, true);
          return () => {
            captureKey = null;
            window.removeEventListener('keydown', onKey, true);
          };
        }, [capturing]);

        const value = props.value;
        const offHint = t('已关闭：这个快捷键目前不起作用', 'Off: this shortcut does nothing right now');
        return h('div', { className: 'vhk-row' },
          h('div', { className: 'vhk-text' },
            h('div', { className: 'vhk-label' }, props.label),
            h('div', { className: 'vhk-hint' }, hint || (value ? props.hint : offHint))),
          h('div', { className: 'vhk-right' },
            h('button', {
              type: 'button',
              className: 'vhk-kbd' + (capturing ? ' vhk-capturing' : '') + (value ? '' : ' vhk-off'),
              onClick: () => { setHint(''); setCapturing((v) => !v); },
            }, capturing
              ? t('请按组合键…（Esc 清空）', 'Press keys… (Esc clears)')
              : (value ? formatHotkey(value) : t('未设置', 'Not set')))));
      }

      return function VoiceHotkeySettings() {
        const [state, setState] = React.useState(readSettings);
        const update = (patch) => setState((current) => {
          const next = { ...current, ...patch };
          writeSettings(next);
          return next;
        });
        const seconds = (ms) => (ms / 1000).toFixed(1) + (en ? ' s' : ' 秒');

        return h('div', { className: 'vhk-wrap' },
          h('div', { className: 'vhk-head' },
            h('h2', { className: 'vhk-title' }, t('语音快捷键', 'Voice hotkey')),
            h('p', { className: 'vhk-sub' },
              t('不用再去点输入框旁边的麦克风。按一下快捷键开始说话，说完自动停，文字直接落进输入框，回车就能发。焦点丢了也能用「聚焦输入框」键一键跳回来。',
                'Skip the microphone button: press the hotkey, speak, and the text lands in the composer when you stop. Lost focus? One key brings the caret back.'))),

          h('div', { className: 'vhk-group' }, t('快捷键', 'Shortcuts')),
          h('div', { className: 'vhk-card' },
            h(HotkeyRow, {
              label: t('语音输入', 'Voice input'),
              hint: t('轻按开/关录音；按住 0.5 秒以上，松手即停', 'Tap to start or stop; hold ≥0.5 s and release to stop'),
              value: state.hotkey,
              conflict: state.focusHotkey,
              onChange: (hotkey) => update({ hotkey }),
            }),
            h(HotkeyRow, {
              label: t('聚焦输入框', 'Focus the composer'),
              hint: t('把光标送回输入框末尾 —— DSH 自带设置里没有这个键', 'Jumps the caret back into the composer — DSH has no shortcut for this'),
              value: state.focusHotkey,
              conflict: state.hotkey,
              onChange: (focusHotkey) => update({ focusHotkey }),
            })),

          h('div', { className: 'vhk-group' }, t('自动停止', 'Auto stop')),
          h('div', { className: 'vhk-card' },
            h('div', { className: 'vhk-row' },
              h('div', { className: 'vhk-text' },
                h('div', { className: 'vhk-label' }, t('说完自动结束录音', 'Stop automatically when I stop talking')),
                h('div', { className: 'vhk-hint' },
                  t('关掉后需要自己再按一次快捷键或空格来结束；录音中随时按空格都能立刻停',
                    'When off, press the hotkey or Space again to finish; Space stops a recording at any time'))),
              h(Switch, { checked: state.autoStop, onChange: (autoStop) => update({ autoStop }) })),
            h('div', { className: 'vhk-row' + (state.autoStop ? '' : ' vhk-disabled') },
              h('div', { className: 'vhk-text' },
                h('div', { className: 'vhk-label' }, t('停顿多久算说完', 'Silence before stopping')),
                h('div', { className: 'vhk-hint' },
                  t('说得慢、爱思考就把这条往右拉长一点', 'Raise it if you pause a lot while thinking'))),
              h('div', { className: 'vhk-right' },
                h('input', {
                  type: 'range',
                  className: 'vhk-range',
                  min: SILENCE_MIN, max: SILENCE_MAX, step: SILENCE_STEP,
                  value: state.silenceMs,
                  onChange: (e) => update({ silenceMs: Number(e.target.value) }),
                }),
                h('span', { className: 'vhk-val' }, seconds(state.silenceMs))))),

          h('div', { className: 'vhk-group' }, t('发送', 'Sending')),
          h('div', { className: 'vhk-card' },
            h('div', { className: 'vhk-row' },
              h('div', { className: 'vhk-text' },
                h('div', { className: 'vhk-label' }, t('说完自动发送', 'Send automatically')),
                h('div', { className: 'vhk-hint' },
                  t('转写完成后直接发出去，不用再按回车。适合一问一答；想先改字就别开',
                    'Presses Enter for you once the text lands. Handy for quick questions; leave it off if you like to edit first'))),
              h(Switch, { checked: state.autoSend, onChange: (autoSend) => update({ autoSend }) }))),

          h('p', { className: 'vhk-foot' },
            t('设置存在这台浏览器里，改完立即生效；换浏览器会回到默认热键（功能照常可用）。',
              'Settings are stored in this browser and apply immediately; another browser simply starts from the defaults.')));
      };
    }

    // 设置页左侧导航用的小图标（麦克风）—— 尺寸由设置页通过 props.size 指定
    function settingsIcon(React) {
      return function VoiceHotkeyIcon(props) {
        const size = props && typeof props.size === 'number' ? props.size : 16;
        return React.createElement('svg', {
          viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
          stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
          'aria-hidden': 'true', style: { display: 'block' },
        },
        React.createElement('rect', { x: 9, y: 3, width: 6, height: 11, rx: 3 }),
        React.createElement('path', { d: 'M5 11a7 7 0 0 0 14 0' }),
        React.createElement('path', { d: 'M12 18v3' }));
      };
    }

    // ── 语音识别服务切换器（输入框工具条左侧的小下拉）───────────────────────
    // 官方已经把「运行时切 provider」做成公开能力：remote.speech.configure({providerId})
    // 写的是 speech-to-text 条目的 defaultProvider（volatile），下一次转写立即生效。
    let speechRemote = null;

    // speech 命名空间由官方 ui-voice-input 挂载后才存在，直接摸可能抛错，统一兜住
    function speechApi(ctx) {
      if (!ctx) return null;
      // remote.speech 是 Typert 挂上来的独立服务名，用 get 最稳（缺失时返回 undefined 而不是抛）
      try {
        const byName = typeof ctx.get === 'function' ? ctx.get('remote.speech') : null;
        if (byName) return byName;
      } catch (e) { /* 继续试属性访问 */ }
      try {
        const remote = ctx.remote;
        return (remote && remote.speech) || null;
      } catch (e) { return null; }
    }

    // 名称全部来自 provider 自己上报的 info（id / name / location），只有这三个常见 id 做了中英短名映射
    function shortProviderName(provider, en) {
      const id = String(provider && provider.id || '');
      if (id === 'doubao') return en ? 'Doubao' : '豆包';
      if (id === 'doubao-polished') return en ? 'Doubao + polish' : '豆包·顺稿';
      // 官方本地识别器：显示它上报的真名（SenseVoiceSmall (INT8)），chip 里超宽会省略号截断
      if (id === 'sensevoice-local') return String(provider && provider.name || 'SenseVoice');
      const name = String(provider && provider.name || id);
      return name.replace(/[（(].*?[）)]/g, '').trim() || id;
    }

    // 名字后面挂「云端 / 本地」：这是 provider.info.location，唯一可靠的部署位置信号
    function providerLabel(provider, en) {
      const base = shortProviderName(provider, en);
      const location = provider && provider.location;
      if (location === 'cloud') return base + (en ? ' · cloud' : ' · 云端');
      if (location === 'host-local') return base + (en ? ' · local' : ' · 本地');
      return base;
    }

    function providerTitle(provider, en) {
      if (!provider) return en ? 'Speech recognition service' : '语音识别服务';
      const languages = Array.isArray(provider.languages) && provider.languages.length
        ? provider.languages.join(' / ') : '';
      return [provider.name || provider.id, languages].filter(Boolean).join(' — ');
    }

    function providerSwitcher(React, en, getRemote) {
      const h = React.createElement;
      const label = en ? 'Speech recognition service' : '语音识别服务';
      // 和官方模型选择器一样的 chip：28px 高、透明底、13px 次要色、右侧 12px 雪佛龙
      const chip = (props, text) => h('button', Object.assign({ type: 'button', className: 'vhk-provider-trigger' }, props),
        h('span', { className: 'vhk-provider-text' }, text),
        h('span', { className: 'vhk-provider-chevron', 'aria-hidden': 'true' }));
      return function ProviderSwitcher() {
        const [catalog, setCatalog] = React.useState(null);
        const [busy, setBusy] = React.useState(false);
        const [open, setOpen] = React.useState(false);
        const rootRef = React.useRef(null);
        React.useEffect(() => {
          let alive = true;
          let timer = null;
          let tries = 0;
          const load = async () => {
            if (!alive) return;
            // 官方 ui-voice-input 挂载 remote.speech 之前这里一直是空的：隔一会儿再看
            const speech = getRemote();
            if (!speech) {
              if (tries++ < 60) timer = setTimeout(load, 500);
              return;
            }
            try {
              const result = await speech.catalog();
              if (!alive) return;
              if (result && result.ok === false) throw result.error;
              setCatalog(result && result.ok ? result.value : result);
            } catch (e) { warn('读不到语音识别服务列表：' + e); }
          };
          load();
          return () => { alive = false; if (timer) clearTimeout(timer); };
        }, []);
        // 点外面、按 Esc 收起菜单
        React.useEffect(() => {
          if (!open) return undefined;
          const onDown = (event) => {
            const root = rootRef.current;
            if (root && !root.contains(event.target)) setOpen(false);
          };
          const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
          document.addEventListener('mousedown', onDown, true);
          document.addEventListener('keydown', onKey, true);
          return () => {
            document.removeEventListener('mousedown', onDown, true);
            document.removeEventListener('keydown', onKey, true);
          };
        }, [open]);
        // 还没连上时留一个占位，至少能看出这条链路是活的
        if (!catalog) {
          return h('span', { className: 'vhk-provider' },
            chip({ disabled: true, title: en ? 'Speech recognition service (connecting…)' : '语音识别服务（连接中…）', 'aria-label': label },
              en ? 'Speech…' : '语音服务'));
        }
        // 服务在、但一个识别器都没注册：明确说出来，别留个空白
        if (!catalog.providers || !catalog.providers.length) {
          return h('span', { className: 'vhk-provider' },
            chip({ disabled: true, title: en ? 'No speech recognizer is registered' : '没有注册任何语音识别服务', 'aria-label': label },
              en ? 'No recognizer' : '无可用识别服务'));
        }
        const selection = catalog.selection || {};
        const current = selection.providerId || '';
        const currentProvider = catalog.providers.find((p) => p.id === current);
        const choose = async (id) => {
          setOpen(false);
          if (id === current) return;
          const speech = getRemote();
          if (!speech) return;
          setBusy(true);
          try {
            const result = await speech.configure({ providerId: id });
            if (result && result.ok === false) throw result.error;
            setCatalog(Object.assign({}, catalog, { selection: Object.assign({}, selection, { providerId: id }) }));
          } catch (e) {
            warn('切换语音识别服务失败：' + e);
            // 失败就把下拉拨回真实值，别让人以为切成功了
            try {
              const again = await speech.catalog();
              if (again && again.ok) setCatalog(again.value); else if (again) setCatalog(again);
            } catch (ignored) { /* 保持原样 */ }
          } finally { setBusy(false); }
        };
        return h('span', { className: 'vhk-provider', ref: rootRef },
          chip({
            disabled: busy || !current,
            'aria-haspopup': 'listbox',
            'aria-expanded': open ? 'true' : 'false',
            title: providerTitle(currentProvider, en),
            onClick: () => setOpen(!open),
          }, providerLabel(currentProvider, en)),
          open ? h('div', { className: 'vhk-provider-menu', role: 'listbox', 'aria-label': label },
            catalog.providers.map((provider) => {
              const selected = provider.id === current;
              const loc = provider.location === 'cloud' ? (en ? 'cloud' : '云端')
                : provider.location === 'host-local' ? (en ? 'local' : '本地') : '';
              return h('button', {
                key: provider.id,
                type: 'button',
                role: 'option',
                'aria-selected': selected ? 'true' : 'false',
                className: 'vhk-provider-item' + (selected ? ' is-selected' : ''),
                title: providerTitle(provider, en),
                onClick: () => choose(provider.id),
              },
                h('span', { className: 'vhk-provider-name' }, shortProviderName(provider, en)),
                h('span', { className: 'vhk-provider-loc' }, loc),
                selected ? h('span', { className: 'vhk-provider-check', 'aria-hidden': 'true' }) : null);
            })) : null);
      };
    }

    return {
      inject: ['slots', 'remote'],
      apply(ctx) {
        const install = () => {
          window.addEventListener('keydown', onKeyDown, true);
          window.addEventListener('keyup', onKeyUp, true);
          window.addEventListener('click', onSendClickCapture, true);
          window.addEventListener('blur', () => { pressAt = 0; }, true);
          observePhases();
        };
        const dispose = () => {
          window.removeEventListener('keydown', onKeyDown, true);
          window.removeEventListener('keyup', onKeyUp, true);
          window.removeEventListener('click', onSendClickCapture, true);
          unobservePhases();
          stopVad();
          stopClock();
          stopAutoSend();
        };
        if (ctx && typeof ctx.effect === 'function') ctx.effect(() => { install(); return dispose; });
        else install();

        ensureStyles();

        const React = require('react');
        const en = String(navigator.language || '').toLowerCase().startsWith('en');
        speechRemote = speechApi(ctx);

        // ③ 输入框右侧控制簇：语音识别服务小下拉，排在模型选择器之后、紧挨麦克风
        try {
          if (ctx && ctx.slots) {
            ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
              name: 'conversation.input.right',
              id: 'voice-provider',
              order: 30,
              label: en ? 'Speech service' : '语音识别服务',
            }, providerSwitcher(React, en, () => speechRemote || speechApi(ctx))));
          }
        } catch (e) { warn('语音服务切换器没挂上：' + e); }

        // ① 设置页里的独立分区 —— 和其它插件的设置项并排出现
        try {
          if (ctx && ctx.slots) {
            ctx.slots.inject('settings.section', () => ctx.slots.register({
              name: 'settings.section',
              id: 'voice-hotkey',
              order: 60,
              label: en ? 'Voice hotkey' : '语音快捷键',
            }, settingsPanel(React)));
            ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
              name: 'settings.section.icon',
              id: 'voice-hotkey',
              order: 60,
            }, settingsIcon(React)));
          }
        } catch (e) { warn('设置分区没挂上：' + e); }

        // ② 插件详情页里的配置区：key 必须是本 bundle 的包名
        try {
          if (ctx && ctx.slots) {
            ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
              name: 'plugins.bundle.config',
              key: 'dsh-voice-hotkey',
            }, settingsPanel(React)));
          }
        } catch (e) { warn('设置面板没挂上：' + e); }
      },
    };
  },
});
