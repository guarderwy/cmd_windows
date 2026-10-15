import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig } from '../shared/config-types'

const api = {
  createPty: (opts: { id: string; cwd?: string }) => ipcRenderer.invoke('pty:create', opts),
  writePty: (id: string, data: string) => ipcRenderer.send('pty:write', { id, data }),
  resizePty: (id: string, cols: number, rows: number) => ipcRenderer.send('pty:resize', { id, cols, rows }),
  killPty: (id: string) => ipcRenderer.invoke('pty:kill', { id }),
  loadConfig: () => ipcRenderer.invoke('config:load') as Promise<AppConfig>,
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('config:save', config) as Promise<{ ok: boolean; error?: string }>,
  openConfigDir: () => ipcRenderer.invoke('config:openDir') as Promise<string>,
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDir') as Promise<string | null>,
  layoutLoad: () => ipcRenderer.invoke('layout:load') as Promise<unknown | null>,
  layoutSave: (layout: unknown) => ipcRenderer.invoke('layout:save', layout) as Promise<{ ok: boolean; error?: string }>,
  clipboardWrite: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
  clipboardRead: () => ipcRenderer.invoke('clipboard:readText') as Promise<string>,
  onPtyData: (cb: (payload: { id: string; data: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: { id: string; data: string }) => cb(payload)
    ipcRenderer.on('pty:data', handler)
    return () => ipcRenderer.off('pty:data', handler)
  },
  onPtyExit: (cb: (payload: { id: string; exitCode: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: { id: string; exitCode: number }) => cb(payload)
    ipcRenderer.on('pty:exit', handler)
    return () => ipcRenderer.off('pty:exit', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
