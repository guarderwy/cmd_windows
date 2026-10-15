import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { spawn, type IPty } from 'node-pty'
import { loadConfig, saveConfig, getConfigDir } from './config'
import { loadLayout, saveLayout } from './layout'
import type { AppConfig } from '../shared/config-types'

let win: BrowserWindow | null = null
const ptys = new Map<string, IPty>()

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    title: 'CmdWindows',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Windows 下 npm/node 会派生子进程，退出时杀整棵进程树
function killTree(pid: number) {
  execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => {})
}

app.on('before-quit', () => {
  for (const term of ptys.values()) killTree(term.pid)
  ptys.clear()
})

interface CreateOpts {
  id: string
  cwd?: string
}

ipcMain.handle('pty:create', (_e, opts: CreateOpts) => {
  if (ptys.has(opts.id)) return { ok: true }
  const shell = process.env.COMSPEC || 'cmd.exe'
  const term = spawn(shell, [], {
    cwd: opts.cwd || process.env.USERPROFILE || process.cwd(),
    env: process.env,
    name: 'xterm-256color'
  })
  ptys.set(opts.id, term)
  term.onData((data) => win?.webContents.send('pty:data', { id: opts.id, data }))
  term.onExit(({ exitCode }) => {
    ptys.delete(opts.id)
    win?.webContents.send('pty:exit', { id: opts.id, exitCode })
  })
  return { ok: true }
})

ipcMain.on('pty:write', (_e, { id, data }: { id: string; data: string }) => {
  ptys.get(id)?.write(data)
})

ipcMain.on('pty:resize', (_e, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
  try {
    ptys.get(id)?.resize(cols, rows)
  } catch {
    // pane 已销毁时 resize 会抛错，忽略即可
  }
})

ipcMain.handle('pty:kill', (_e, { id }: { id: string }) => {
  const term = ptys.get(id)
  if (!term) return { ok: true }
  killTree(term.pid)
  ptys.delete(id)
  return { ok: true }
})

ipcMain.handle('config:load', () => loadConfig())

ipcMain.handle('config:save', (_e, config: AppConfig) => saveConfig(config))

ipcMain.handle('config:openDir', async () => {
  await shell.openPath(getConfigDir())
})

ipcMain.handle('dialog:selectDir', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择目录',
    properties: ['openDirectory', 'createDirectory']
  })
  return canceled || filePaths.length === 0 ? null : filePaths[0]
})

ipcMain.handle('layout:load', () => loadLayout())

ipcMain.handle('layout:save', (_e, layout: unknown) => saveLayout(layout))

// M3: 配置 IPC 就绪
