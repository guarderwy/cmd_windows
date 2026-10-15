import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

let layoutPath = ''

function ensurePath() {
  const dir = app.getPath('userData')
  layoutPath = join(dir, 'layout.json')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export function loadLayout(): unknown | null {
  ensurePath()
  try {
    if (existsSync(layoutPath)) {
      return JSON.parse(readFileSync(layoutPath, 'utf-8'))
    }
  } catch (err) {
    console.error('[layout] 解析 layout.json 失败：', err)
  }
  return null
}

export function saveLayout(layout: unknown): { ok: boolean; error?: string } {
  ensurePath()
  try {
    const tmp = layoutPath + '.tmp'
    writeFileSync(tmp, JSON.stringify(layout), 'utf-8')
    renameSync(tmp, layoutPath)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
