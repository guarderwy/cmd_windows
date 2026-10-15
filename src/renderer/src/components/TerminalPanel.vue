<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { IDockviewPanelProps } from 'dockview-vue'
import { ensureSession, isRestoring, registerPanelApi, registerPtyHandlers, unregisterPtyHandlers, sessions, type TerminalParams } from '../composables/useTerminalSessions'
import { useConfig } from '../composables/useConfig'

const props = defineProps<IDockviewPanelProps<TerminalParams>>()
const { config } = useConfig()

const termEl = ref<HTMLElement>()

let term: Terminal
let fitAddon: FitAddon
let resizeObserver: ResizeObserver
// 记录终端最近一次收到数据的时刻，用于判断上一条命令是否已“跑完”（输出安静）
let lastDataTime = Date.now()

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// xterm 配色随主题切换
const XTERM_THEMES: Record<'dark' | 'light', Record<string, string>> = {
  dark: { background: '#0f1115', foreground: '#d5dbe1', cursor: '#d5dbe1', selectionBackground: '#264f78' },
  light: { background: '#ffffff', foreground: '#1a1f26', cursor: '#1a1f26', selectionBackground: '#add6ff' }
}

// 仅在容器有真实尺寸时 fit。dockview 隐藏 group 时会把容器宽高设为 0，
// 此时若 fit 会把终端缩到约 0 列、重排清空缓冲区并向 pty 发错误 resize，导致内容错乱。
function safeFit() {
  const el = termEl.value
  if (!el || el.clientWidth === 0 || el.clientHeight === 0) return
  fitAddon.fit()
}

onMounted(async () => {
  const { paneId, cwd, steps } = props.params
  ensureSession({
    paneId,
    title: props.api.title ?? 'cmd',
    cwd,
    steps,
    projectId: props.params.projectId,
    projectName: props.params.projectName,
    configPaneId: props.params.configPaneId
  })
  registerPanelApi(paneId, props.api)

  term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: "'Cascadia Code', Consolas, monospace",
    scrollback: 5000,
    allowProposedApi: true,
    theme: XTERM_THEMES[config.settings.theme]
  })
  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.loadAddon(new WebLinksAddon())
  term.open(termEl.value!)
  fitAddon.fit()

  await window.api.createPty({ id: paneId, cwd })
  window.api.resizePty(paneId, term.cols, term.rows)
  // cmd 默认 GBK，切 UTF-8 避免中文乱码
  window.api.writePty(paneId, 'chcp 65001\r')

  registerPtyHandlers(
    paneId,
    (data) => {
      term.write(data)
      lastDataTime = Date.now()
    },
    (exitCode) => {
      const s = sessions.get(paneId)
      if (s) {
        s.running = false
        s.exited = true
      }
      term.write(`\r\n\x1b[90m[进程已退出，exit code: ${exitCode}]\x1b[0m\r\n`)
    }
  )
  term.onData((data) => window.api.writePty(paneId, data))
  term.onResize(({ cols, rows }) => window.api.resizePty(paneId, cols, rows))

  // 复制/粘贴：有选区时 Ctrl+C 复制（否则放行给终端做中断），Ctrl+V / Shift+Insert 粘贴
  const copySelection = () => {
    const sel = term.getSelection()
    if (sel) void window.api.clipboardWrite(sel)
  }
  const pasteText = () => {
    void window.api.clipboardRead().then((text) => {
      if (text) window.api.writePty(paneId, text)
    })
  }
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true
    const k = e.key.toLowerCase()
    if (e.ctrlKey && k === 'c') {
      if (term.hasSelection()) {
        copySelection()
        return false
      }
      return true
    }
    if (e.ctrlKey && k === 'v') {
      pasteText()
      return false
    }
    if (e.ctrlKey && k === 'insert') {
      copySelection()
      return false
    }
    if (e.shiftKey && k === 'insert') {
      pasteText()
      return false
    }
    return true
  })

  // 标签页切换 / 拖拽分屏后重新适配尺寸。
  // dockview 隐藏 group 只是把容器宽高设为 0（不卸载、不 display:none），终端 DOM 与进程全程保留。
  // 真正导致内容消失/错乱的是：隐藏瞬间容器为 0 尺寸时仍去 fit，把 xterm 缩到约 0 列而重排清空。
  // 因此只要在 0 尺寸时跳过 fit（见 safeFit），切回时内容原样恢复，无需任何重绘。
  props.api.onDidVisibilityChange(({ isVisible }) => {
    if (!isVisible) return
    // 显示事件先于 dockview 回填容器尺寸触发，延迟一帧等尺寸就位后再 fit（仅适配尺寸，不重绘内容）
    requestAnimationFrame(() => {
      safeFit()
      
      term.focus()
    })
  })
  props.api.onDidDimensionsChange(() => safeFit())

  resizeObserver = new ResizeObserver(() => safeFit())
  resizeObserver.observe(termEl.value!)
  term.focus()

  // 依次执行配置的启动命令；恢复布局时按设置决定是否自动执行
  const shouldRunSteps = isRestoring() ? config.settings.autoRunOnRestore : true
  if (shouldRunSteps) {
    // 每条命令之间：先等上一个命令执行完（终端 300ms 没有新输出即视为命令结束），
    // 再额外等待 300ms，确保命令的副作用生效后，才发送下一条命令。
    const waitStepGap = async () => {
      const start = Date.now()
      while (Date.now() - lastDataTime < 300 && Date.now() - start < 30000) {
        await sleep(50)
      }
      await sleep(300)
    }
    for (let i = 0; i < (steps?.length ?? 0); i++) {
      window.api.writePty(paneId, `${steps![i]}\r`)
      lastDataTime = Date.now()
      if (i < steps!.length - 1) await waitStepGap()
    }
  } else if (steps?.length) {
    term.write(`\x1b[90m[布局已恢复，${steps.length} 条启动命令未自动执行]\x1b[0m\r\n`)
  }
})

onBeforeUnmount(() => {
  unregisterPtyHandlers(props.params.paneId)
  resizeObserver?.disconnect()
  window.api.killPty(props.params.paneId)
  term?.dispose()
})

// 主题切换时实时更新已打开终端的配色
watch(
  () => config.settings.theme,
  (theme) => {
    if (term) term.options.theme = XTERM_THEMES[theme]
  }
)

</script>

<template>
  <div class="terminal-panel">
    <div ref="termEl" class="term" />
  </div>
</template>

<style scoped>
.terminal-panel {
  width: 100%;
  height: 100%;
  background: var(--term-bg);
}

.term {
  width: 100%;
  height: 100%;
  padding: 2px 0 0 4px;
  user-select: text;
  -webkit-user-select: text;
}


.term :deep(.xterm) {
  user-select: text;
  -webkit-user-select: text;
}
</style>
