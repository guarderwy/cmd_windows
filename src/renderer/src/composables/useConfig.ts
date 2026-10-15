import { reactive, ref } from 'vue'
import { createId, defaultConfig, type AppConfig, type PaneCommand, type Project, type QuickLauncher } from '../../../shared/config-types'

const config = reactive<AppConfig>(defaultConfig())
const loaded = ref(false)
const saveError = ref('')

export function useConfig() {
  async function load() {
    try {
      const data = await window.api.loadConfig()
      Object.assign(config, data)
      loaded.value = true
      saveError.value = ''
    } catch (err) {
      saveError.value = `加载配置失败：${String(err)}`
    }
  }

  async function persist() {
    // 通过结构化拷贝避免把 reactive 代理传进 IPC
    const snapshot: AppConfig = JSON.parse(JSON.stringify(config))
    const result = await window.api.saveConfig(snapshot)
    saveError.value = result.ok ? '' : `保存配置失败：${result.error ?? '未知错误'}`
    return result.ok
  }

  async function addProject(input: { name: string }): Promise<Project> {
    const project: Project = { id: createId('p'), name: input.name.trim() || '未命名项目', panes: [] }
    config.projects.push(project)
    await persist()
    return project
  }

  async function updateProject(id: string, patch: Partial<Omit<Project, 'id' | 'panes'>>) {
    const project = config.projects.find((p) => p.id === id)
    if (!project) return
    Object.assign(project, patch)
    await persist()
  }

  async function removeProject(id: string) {
    const idx = config.projects.findIndex((p) => p.id === id)
    if (idx >= 0) {
      config.projects.splice(idx, 1)
      await persist()
    }
  }

  async function addPane(projectId: string, input: { name: string; cwd?: string; steps: string[] }): Promise<PaneCommand | undefined> {
    const project = config.projects.find((p) => p.id === projectId)
    if (!project) return undefined
    const pane: PaneCommand = {
      id: createId('c'),
      name: input.name.trim() || '未命名命令',
      steps: input.steps.filter((s) => s.trim())
    }
    if (input.cwd?.trim()) pane.cwd = input.cwd.trim()
    project.panes.push(pane)
    await persist()
    return pane
  }

  async function updatePane(projectId: string, paneId: string, patch: Partial<Omit<PaneCommand, 'id'>>) {
    const project = config.projects.find((p) => p.id === projectId)
    const pane = project?.panes.find((c) => c.id === paneId)
    if (!project || !pane) return
    if (patch.steps) patch.steps = patch.steps.filter((s) => s.trim())
    Object.assign(pane, patch)
    await persist()
  }

  async function removePane(projectId: string, paneId: string) {
    const project = config.projects.find((p) => p.id === projectId)
    if (!project) return
    const idx = project.panes.findIndex((c) => c.id === paneId)
    if (idx >= 0) {
      project.panes.splice(idx, 1)
      await persist()
    }
  }

  async function addLauncher(input: { name: string; targets: QuickLauncher['targets'] }): Promise<QuickLauncher> {
    const launcher: QuickLauncher = {
      id: createId('q'),
      name: input.name.trim() || '未命名启动组',
      targets: input.targets
    }
    config.quickLaunchers.push(launcher)
    await persist()
    return launcher
  }

  async function updateLauncher(id: string, patch: Partial<Omit<QuickLauncher, 'id'>>) {
    const launcher = config.quickLaunchers.find((l) => l.id === id)
    if (!launcher) return
    Object.assign(launcher, patch)
    await persist()
  }

  async function removeLauncher(id: string) {
    const idx = config.quickLaunchers.findIndex((l) => l.id === id)
    if (idx >= 0) {
      config.quickLaunchers.splice(idx, 1)
      await persist()
    }
  }

  async function openConfigDir() {
    await window.api.openConfigDir()
  }

  return {
    config,
    loaded,
    saveError,
    load,
    persist,
    openConfigDir,
    addProject,
    updateProject,
    removeProject,
    addPane,
    updatePane,
    removePane,
    addLauncher,
    updateLauncher,
    removeLauncher
  }
}
