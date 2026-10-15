import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultConfig, createId, type AppConfig, type PaneCommand, type Project } from '../shared/config-types'
let configPath = ''
let backupPath = ''

function ensurePaths() {
  const dir = app.getPath('userData')
  configPath = join(dir, 'config.json')
  backupPath = join(dir, 'config.json.bak')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

/** 宽松合并：容忍用户手改 JSON，缺字段补默认值，脏字段尽量挽救 */
function mergeConfig(raw: unknown): AppConfig {
  const cfg = defaultConfig()
  if (!raw || typeof raw !== 'object') return cfg
  const obj = raw as Record<string, any>

  if (obj.settings && typeof obj.settings === 'object') {
    const s = obj.settings
    if (typeof s.stepDelayMs === 'number') cfg.settings.stepDelayMs = s.stepDelayMs
    if (typeof s.restoreLayout === 'boolean') cfg.settings.restoreLayout = s.restoreLayout
    if (typeof s.autoRunOnRestore === 'boolean') cfg.settings.autoRunOnRestore = s.autoRunOnRestore
    if (s.theme === 'light' || s.theme === 'dark') cfg.settings.theme = s.theme
  }

  if (Array.isArray(obj.projects)) {
    cfg.projects = obj.projects
      .filter((p): p is Record<string, any> => !!p && typeof p === 'object')
      .map((p) => {
        const project: Project = {
          id: typeof p.id === 'string' && p.id ? p.id : createId('p'),
          name: typeof p.name === 'string' && p.name ? p.name : '未命名项目',
          panes: []
        }
        if (Array.isArray(p.panes)) {
          project.panes = p.panes
            .filter((c): c is Record<string, any> => !!c && typeof c === 'object')
            .map((c) => {
              const pane: PaneCommand = {
                id: typeof c.id === 'string' && c.id ? c.id : createId('c'),
                name: typeof c.name === 'string' && c.name ? c.name : '未命名命令',
                steps: []
              }
              if (typeof c.cwd === 'string' && c.cwd) pane.cwd = c.cwd
              if (Array.isArray(c.steps)) {
                pane.steps = c.steps.filter((s): s is string => typeof s === 'string')
              }
              return pane
            })
        }
        return project
      })
  }

  if (Array.isArray(obj.quickLaunchers)) {
    cfg.quickLaunchers = obj.quickLaunchers
      .filter((l): l is Record<string, any> => !!l && typeof l === 'object')
      .map((l) => ({
        id: typeof l.id === 'string' && l.id ? l.id : createId('q'),
        name: typeof l.name === 'string' && l.name ? l.name : '未命名启动组',
        targets: Array.isArray(l.targets)
          ? l.targets
              .filter(
                (t: any): t is { projectId: string; paneId: string } =>
                  !!t && typeof t.projectId === 'string' && typeof t.paneId === 'string'
              )
              .map((t: { projectId: string; paneId: string }) => ({ ...t }))
          : []
      }))
  }
  return cfg
}

export function loadConfig(): AppConfig {
  ensurePaths()
  try {
    if (existsSync(configPath)) {
      return mergeConfig(JSON.parse(readFileSync(configPath, 'utf-8')))
    }
  } catch (err) {
    console.error('[config] 解析 config.json 失败，尝试备份：', err)
    try {
      if (existsSync(backupPath)) {
        return mergeConfig(JSON.parse(readFileSync(backupPath, 'utf-8')))
      }
    } catch (err2) {
      console.error('[config] 备份也无法使用：', err2)
    }
  }
  return defaultConfig()
}

export function saveConfig(config: AppConfig): { ok: boolean; error?: string } {
  ensurePaths()
  try {
    if (existsSync(configPath)) copyFileSync(configPath, backupPath)
    const tmp = configPath + '.tmp'
    writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8')
    renameSync(tmp, configPath)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export function getConfigDir(): string {
  ensurePaths()
  return app.getPath('userData')
}
