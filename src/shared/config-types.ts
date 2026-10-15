/** 主进程与渲染进程共享的配置类型 */

export interface PaneCommand {
  id: string
  name: string
  /** 该 pane 自己的工作目录；为空则从程序所在位置启动 */
  cwd?: string
  /** 打开 pane 后依次执行的命令 */
  steps: string[]
}

export interface Project {
  id: string
  name: string
  panes: PaneCommand[]
}

export interface AppSettings {
  /** 每条启动命令之间的间隔（ms） */
  stepDelayMs: number
  /** 重启后恢复上次的 pane 布局 */
  restoreLayout: boolean
  /** 恢复布局时是否自动重跑命令（默认关，避免误启动） */
  autoRunOnRestore: boolean
  /** 界面主题：深色 / 浅色 */
  theme: 'dark' | 'light'
}

/** 一键启动组：一次点击按顺序打开多个命令 pane */
export interface QuickLauncher {
  id: string
  name: string
  targets: Array<{ projectId: string; paneId: string }>
}

export interface AppConfig {
  version: number
  settings: AppSettings
  projects: Project[]
  quickLaunchers: QuickLauncher[]
}

export const defaultConfig = (): AppConfig => ({
  version: 1,
  settings: {
    stepDelayMs: 400,
    restoreLayout: true,
    autoRunOnRestore: false,
    theme: 'dark'
  },
  projects: [],
  quickLaunchers: []
})

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
