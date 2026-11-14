/**
 * 语音快捷键（voice-hotkey）· Host 半
 *
 * 这里只声明配置：四个字段都是 `.volatile()`，所以 DSH 会把它们作为一个
 * settings namespace（id = 补丁里的行 id `voice-hotkey`）对外提供，客户端
 * 用 `ctx.configForms.get('voice-hotkey')` 读写。值存在 profile 的用户设置
 * 文档里，所以换浏览器、换设备、换访问地址都不会丢。
 */

import z from '@deepseek-ai/schemastery'

/** 插件设置：热键表示成 'Alt+V' 这样的字符串，空字符串表示用户主动关掉。 */
export const Config = z.object({
  hotkey: z.string().default('Alt+V').volatile(),
  focusHotkey: z.string().default('Ctrl+Alt+I').volatile(),
  autoStop: z.boolean().default(true).volatile(),
  silenceMs: z.number().default(2000).volatile(),
})

/**
 * 启用设置命名空间，并声明「不自动生成配置页」——本插件自己提供面板。
 * @param ctx Host 插件上下文。
 */
export function apply(ctx) {
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
}
