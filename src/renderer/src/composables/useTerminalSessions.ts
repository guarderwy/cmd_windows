import { reactive, ref } from 'vue'
import type { DockviewApi, DockviewPanelApi, DockviewReadyEvent } from 'dockview-vue'

export interface TerminalParams {
  paneId: string
  cwd?: string
  steps?: string[]
  projectId?: string
  projectName?: string
  configPaneId?: string
}

export interface TerminalSession {
  paneId: string
  title: string
  cwd?: string
  steps: string[]
  projectId?: string
  projectName?: string
  /** 对应配置里的命令 id，用于侧边栏显示运行状态 */
  configPaneId?: string
  /** 该面板所在 group 的 id */
  groupId?: string
  running: boolean
  exited: boolean
  panelApi?: DockviewPanelApi
}

export const sessions = reactive(new Map<string, TerminalSession>())

// 每个项目（含“默认终端”）各自拥有一个独立的 dockview 实例，彼此布局完全隔离。
// 切换顶部标签只是切换 activeProjectId，由模板用 visibility 显隐对应 dockview，
// 因此任一项目的布局/宽高/终端内容都不会因切换而改变（除用户手动拖拽外）。
export const openProjects = ref<{ id: string; name: string }[]>([])
// 自由终端（新建终端）作为“默认终端”也参与顶部标签切换；FREE_TAB_ID 是其虚拟 id
export const FREE_TAB_ID = '__free__'
export const activeProjectId = ref<string | null>(FREE_TAB_ID)

// projectId -> 该项目的 dockview 实例
const dockApis = new Map<string, DockviewApi>()
// dockview 尚未 onReady 时，先把 openPane 的请求挂起，ready 后放行
const dockReadyWaiters = new Map<string, Array<(api: DockviewApi) => void>>()

// 布局持久化：以 { [projectId]: snapshot } 形式整体保存在 layout.json
let savedLayouts: Record<string, unknown> = {}
let layoutsLoaded = false
let layoutsPromise: Promise<Record<string, unknown>> | null = null

/** 加载一次已保存的布局表（记忆化，多处调用共享同一 Promise） */
export function loadLayoutsOnce(): Promise<Record<string, unknown>> {
  if (!layoutsPromise) {
    layoutsPromise = (async () => {
      try {
        const saved = await window.api.layoutLoad()
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
          savedLayouts = saved as Record<string, unknown>
        }
      } catch (e) {
        console.warn('[layout] 加载布局失败：', e)
      }
      layoutsLoaded = true
      return savedLayouts
    })()
  }
  return layoutsPromise
}

/** 取某个项目已保存的布局快照（无则返回 null） */
export async function getSavedLayout(projectId: string): Promise<unknown | null> {
  const layouts = await loadLayoutsOnce()
  return layouts[projectId] ?? null
}

async function persistLayouts() {
  if (!layoutsLoaded) await loadLayoutsOnce()
  try {
    await window.api.layoutSave(savedLayouts)
  } catch (e) {
    console.warn('[layout] 保存布局失败：', e)
  }
}

function registerProjectTab(projectId: string, name: string) {
  if (!openProjects.value.some((p) => p.id === projectId)) {
    openProjects.value = [...openProjects.value, { id: projectId, name }]
  }
}

/** 取得某项目的 dockview；若尚未创建则登记标签（触发模板渲染）并挂起，ready 后 resolve */
function getProjectDock(projectId: string, name?: string): Promise<DockviewApi> {
  const existing = dockApis.get(projectId)
  if (existing) return Promise.resolve(existing)
  if (projectId !== FREE_TAB_ID) registerProjectTab(projectId, name ?? projectId)
  return new Promise((resolve) => {
    const arr = dockReadyWaiters.get(projectId) ?? []
    arr.push(resolve)
    dockReadyWaiters.set(projectId, arr)
  })
}

/** 绑定某个项目 dockview 的 ready 事件：登记实例、放行挂起请求、设置自动保存与关闭清理 */
export function bindDockApi(event: DockviewReadyEvent, projectId: string) {
  const api = event.api
  dockApis.set(projectId, api)

  const waiters = dockReadyWaiters.get(projectId)
  if (waiters) {
    for (const w of waiters) w(api)
    dockReadyWaiters.delete(projectId)
  }

  // 布局变化后防抖保存（仅保存该项目自己的快照）
  let timer: ReturnType<typeof setTimeout> | undefined
  api.onDidLayoutChange(() => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      try {
        // 项目已被关闭（标签移除）时不再回写，避免留下空布局
        if (projectId !== FREE_TAB_ID && !openProjects.value.some((p) => p.id === projectId)) return
        // toJSON() 产物含不可结构化克隆的字段，先拍平为纯 JSON 对象再过 IPC
        savedLayouts[projectId] = JSON.parse(JSON.stringify(api.toJSON()))
        void persistLayouts()
      } catch (e) {
        console.warn('[layout] 保存布局失败：', e)
      }
    }, 500)
  })

  // 关闭标签页时同步杀进程（TerminalPanel 卸载时也会杀，双保险且幂等）
  api.onDidRemovePanel((panel) => {
    const s = sessions.get(panel.id)
    if (!s) return
    window.api.killPty(panel.id)
    sessions.delete(panel.id)
    if (!s.projectId) {
      // 自由终端：其 group 被移除时清空记录
      const gid = freeGroupId
      if (gid && !api.getGroup(gid)) freeGroupId = null
    } else {
      // 项目内 pane 全部关闭时，移除对应标签与布局
      pruneProjectTab(s.projectId)
    }
  })
}

/** 项目已无任何会话时，移除其标签、清理实例与已保存布局 */
function pruneProjectTab(projectId: string) {
  if (projectId === FREE_TAB_ID) return
  const remaining = [...sessions.values()].some((s) => s.projectId === projectId)
  if (remaining) return
  dockApis.delete(projectId)
  openProjects.value = openProjects.value.filter((p) => p.id !== projectId)
  delete savedLayouts[projectId]
  void persistLayouts()
  if (activeProjectId.value === projectId) {
    // 标签消失后切回“默认终端”
    activeProjectId.value = FREE_TAB_ID
  }
}

export function registerPanelApi(paneId: string, api: DockviewPanelApi) {
  const s = sessions.get(paneId)
  if (s) s.panelApi = api
}

/** 恢复布局时面板也会走挂载流程，此时没有经过 openPane，需要补录会话 */
export function ensureSession(params: TerminalParams & { title?: string; groupId?: string }): void {
  if (sessions.has(params.paneId)) return
  const session: TerminalSession = {
    paneId: params.paneId,
    title: params.title || 'cmd',
    cwd: params.cwd,
    steps: params.steps || [],
    projectId: params.projectId,
    projectName: params.projectName,
    configPaneId: params.configPaneId,
    groupId: params.groupId,
    running: true,
    exited: false
  }
  sessions.set(params.paneId, session)
}

let restoringUntil = 0

/** 标记进入布局恢复窗口，窗口内挂载的面板按设置决定是否自动执行命令 */
export function markRestoring() {
  restoringUntil = Date.now() + 1500
}

export function isRestoring(): boolean {
  return Date.now() < restoringUntil
}

let seq = 0

function newPaneId() {
  return `t${Date.now().toString(36)}${(seq++).toString(36)}`
}

// pty 数据/退出事件改为全局只绑定一次 IPC 监听，再按 paneId 路由到对应回调。
// 避免每个面板各自注册一个 listener 而在 HMR / 反复挂载时无限堆积（超过 10 个会触发 MaxListeners 警告）
const ptyDataHandlers = new Map<string, (data: string) => void>()
const ptyExitHandlers = new Map<string, (exitCode: number) => void>()
let ptyIpcDispose: (() => void) | null = null

function bindPtyIpc() {
  if (ptyIpcDispose) return
  const offData = window.api.onPtyData(({ id, data }) => {
    ptyDataHandlers.get(id)?.(data)
  })
  const offExit = window.api.onPtyExit(({ id, exitCode }) => {
    ptyExitHandlers.get(id)?.(exitCode)
  })
  ptyIpcDispose = () => {
    offData()
    offExit()
  }
}

export function registerPtyHandlers(
  paneId: string,
  onData: (data: string) => void,
  onExit: (exitCode: number) => void
) {
  ptyDataHandlers.set(paneId, onData)
  ptyExitHandlers.set(paneId, onExit)
  bindPtyIpc()
}

export function unregisterPtyHandlers(paneId: string) {
  ptyDataHandlers.delete(paneId)
  ptyExitHandlers.delete(paneId)
}

let freeSeq = 0
// 自由终端实际 group 的 id（首次为 dockview 自动生成，之后固定沿用），多条自由终端并入同一 group
let freeGroupId: string | null = null

export async function openPane(
  opts: {
    title?: string
    cwd?: string
    steps?: string[]
    projectId?: string
    projectName?: string
    configPaneId?: string
  } = {}
): Promise<string | undefined> {
  // 项目 pane 进入该项目自己的 dockview；自由终端进入“默认终端”dockview
  const projectKey = opts.projectId ?? FREE_TAB_ID
  const api = await getProjectDock(projectKey, opts.projectName)
  if (!api) {
    console.warn('[openPane] dockApi 尚未就绪，无法打开 pane')
    return undefined
  }
  const paneId = newPaneId()
  const session: TerminalSession = {
    paneId,
    title: opts.title || 'cmd',
    cwd: opts.cwd,
    steps: opts.steps || [],
    projectId: opts.projectId,
    projectName: opts.projectName,
    configPaneId: opts.configPaneId,
    groupId: undefined,
    running: true,
    exited: false
  }
  sessions.set(paneId, session)

  // 定位策略（在单个项目 dockview 内）：
  //  - 项目 pane：每个独占一个 group，贴在该 dockview 最后一个 group 右侧，平铺成格子。
  //  - 自由终端：统一并入同一个 group，其内多条自由终端以 tab 呈现。
  let position: { referenceGroup?: string; direction: 'right' | 'within' } | undefined
  if (opts.projectId) {
    const last = api.groups[api.groups.length - 1]
    position = last ? { referenceGroup: last.id, direction: 'right' } : { direction: 'right' }
  } else {
    const gid = freeGroupId
    if (gid && api.getGroup(gid)) {
      position = { referenceGroup: gid, direction: 'within' }
    } else {
      position = { direction: 'right' }
    }
  }

  const baseOptions = {
    id: paneId,
    component: 'terminal',
    title: session.title,
    params: {
      paneId,
      cwd: opts.cwd,
      steps: session.steps,
      projectId: opts.projectId,
      projectName: opts.projectName,
      configPaneId: opts.configPaneId
    },
    position
  }

  let panel: { group?: { id: string } } | undefined
  try {
    panel = api.addPanel(baseOptions as Parameters<typeof api.addPanel>[0]) as typeof panel
  } catch (e) {
    console.warn('[openPane] 带位置添加失败，退化为普通添加：', e)
    const fallback = { ...baseOptions }
    delete (fallback as Record<string, unknown>).position
    panel = api.addPanel(fallback as Parameters<typeof api.addPanel>[0]) as typeof panel
  }
  const gid = panel?.group?.id
  session.groupId = gid
  // 记录自由终端实际 group id，供后续并入同一 group
  if (!opts.projectId && gid) freeGroupId = gid
  return paneId
}

/** 启动整个项目：命令全部塞进该项目自己的 dockview，并切到该项目标签 */
export async function launchProject(project: {
  id: string
  name: string
  panes: { id: string; name: string; cwd?: string; steps: string[] }[]
}) {
  if (project.panes.length === 0) {
    await openPane({ title: `${project.name} · 终端`, projectId: project.id, projectName: project.name })
  } else {
    for (const pane of project.panes) {
      // 重复点击 ▶ 时，只跳过当前仍在运行的面板；已停止的允许重新开启
      const exists = [...sessions.values()].some(
        (s) => s.projectId === project.id && s.configPaneId === pane.id && !s.exited
      )
      if (exists) continue
      await openPane({
        title: `${project.name} · ${pane.name}`,
        cwd: pane.cwd || undefined,
        steps: pane.steps,
        projectId: project.id,
        projectName: project.name,
        configPaneId: pane.id
      })
    }
  }
  switchProject(project.id)
  equalizeProject(project.id)
}

/** 切换顶部标签：仅切换激活项目，显隐由模板按 activeProjectId 处理，不改动任何布局 */
export function switchProject(projectId: string) {
  activeProjectId.value = projectId
  // 仅把目标项目的首个 group 设为激活，便于获得焦点
  dockApis.get(projectId)?.groups[0]?.api.setActive()
}

/**
 * 将指定项目 dockview 内的全部 group 等分为相同宽度（项目首次启动时均分 pane）。
 * setSize 只接受像素，按容器宽度均分（横向单行排布时各 group 等宽）。
 */
export function equalizeProject(projectId: string = activeProjectId.value ?? FREE_TAB_ID) {
  const api = dockApis.get(projectId)
  if (!api) return
  const groups = api.groups
  if (groups.length <= 1) return
  const w = Math.floor(api.width / groups.length)
  for (const g of groups) g.api.setSize({ width: w })
}

/** 关闭项目：关闭其全部面板，清理标签与布局 */
export function closeProject(projectId: string) {
  for (const [id, s] of [...sessions]) {
    if (s.projectId === projectId) closePane(id)
  }
  pruneProjectTab(projectId)
  if (activeProjectId.value === projectId) activeProjectId.value = FREE_TAB_ID
}

/** 顶栏“新开终端”：在“默认终端”dockview 里开一个自由终端，并切到默认终端标签 */
export async function openFreeTerminal() {
  freeSeq += 1
  await openPane({ title: `终端 ${freeSeq}` })
  switchProject(FREE_TAB_ID)
}

export function closePane(paneId: string) {
  sessions.get(paneId)?.panelApi?.close()
}

export function closeAllPanes() {
  for (const id of [...sessions.keys()]) closePane(id)
}

// 热更新时保留各 dockview 实例，避免模块重求值后 openPane 因实例丢失而失效
const hot = import.meta.hot
if (hot) {
  if (hot.data.dockApis) {
    for (const [k, v] of hot.data.dockApis as Map<string, DockviewApi>) dockApis.set(k, v)
  }
  hot.dispose((data) => {
    data.dockApis = dockApis
    ptyIpcDispose?.()
    ptyIpcDispose = null
  })
}
