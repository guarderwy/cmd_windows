<script setup lang="ts">
import { ref } from 'vue'
import { useConfig } from '../composables/useConfig'
import { closeAllPanes, openPane } from '../composables/useTerminalSessions'
import type { Project, QuickLauncher } from '../../../shared/config-types'
import QuickLauncherEditor from './QuickLauncherEditor.vue'

const { config, removeLauncher } = useConfig()

const editor = ref<{ launcher: QuickLauncher | null } | null>(null)

function findTargets(launcher: QuickLauncher): Array<{ project: Project; paneId: string; name: string; cwd?: string; steps: string[] }> {
  const result: Array<{ project: Project; paneId: string; name: string; cwd?: string; steps: string[] }> = []
  for (const target of launcher.targets) {
    const project = config.projects.find((p) => p.id === target.projectId)
    const pane = project?.panes.find((c) => c.id === target.paneId)
    if (project && pane) {
      result.push({ project, paneId: pane.id, name: pane.name, cwd: pane.cwd, steps: pane.steps })
    }
  }
  return result
}

async function launch(launcher: QuickLauncher) {
  const targets = findTargets(launcher)
  for (const [i, t] of targets.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 500))
    openPane({
      title: `${t.project.name} · ${t.name}`,
      cwd: t.cwd || undefined,
      steps: t.steps,
      projectId: t.project.id,
      projectName: t.project.name,
      configPaneId: t.paneId
    })
  }
}

function targetSummary(launcher: QuickLauncher): string {
  const valid = findTargets(launcher).length
  return `${valid} 个命令`
}

function confirmRemoveLauncher(launcher: QuickLauncher) {
  if (window.confirm(`确定删除启动组「${launcher.name}」吗？该操作不可撤销。`)) {
    removeLauncher(launcher.id)
  }
}
</script>

<template>
  <div class="launcher-panel">
    <div class="panel-head">
      <span class="title">一键启动</span>
      <button class="icon-btn" title="新建启动组" @click="editor = { launcher: null }">＋</button>
    </div>

    <div class="panel-body">
      <div v-if="config.quickLaunchers.length === 0" class="empty">
        还没有启动组<br />把多个项目命令组合起来，一键全部打开
      </div>

      <div v-for="launcher in config.quickLaunchers" :key="launcher.id" class="launcher-item">
        <button class="launch-btn" title="点击启动该组所有命令" @click="launch(launcher)">▶</button>
        <div class="launcher-info" @dblclick="launch(launcher)">
          <div class="launcher-name">{{ launcher.name }}</div>
          <div class="launcher-meta">{{ targetSummary(launcher) }}</div>
        </div>
        <span class="launcher-actions">
          <button class="mini" title="编辑" @click="editor = { launcher }">✎</button>
          <button class="mini danger" title="删除" @click="confirmRemoveLauncher(launcher)">🗑</button>
        </span>
      </div>
    </div>

    <!-- <div class="panel-foot">
      <button class="foot-btn danger" @click="closeAllPanes">停止全部终端</button>
    </div> -->

    <QuickLauncherEditor v-if="editor" :launcher="editor.launcher" @close="editor = null" />
  </div>
</template>

<style scoped>
.launcher-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-head {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 8px 0 12px;
  border-bottom: 1px solid var(--border);
  flex: none;
}

.title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 1px;
}

.icon-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-3);
  font-size: 14px;
  padding: 2px 8px;
  cursor: pointer;
}

.icon-btn:hover {
  color: var(--text-strong);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty {
  color: var(--text-faintest);
  font-size: 12px;
  text-align: center;
  line-height: 1.8;
  padding: 40px 0;
}

.launcher-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-card);
  margin-bottom: 6px;
}

.launch-btn {
  width: 30px;
  height: 30px;
  flex: none;
  border: none;
  border-radius: 50%;
  background: var(--green-btn);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.launch-btn:hover {
  background: var(--green-btn-hover);
}

.launcher-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.launcher-name {
  font-size: 13px;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.launcher-meta {
  font-size: 10px;
  color: var(--text-faintest);
  margin-top: 2px;
}

.launcher-actions {
  display: flex;
  gap: 2px;
  flex: none;
}

.mini {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  padding: 2px 4px;
  cursor: pointer;
  border-radius: 4px;
}

.mini:hover {
  color: var(--text-strong);
  background: var(--border-2);
}

.mini.danger:hover {
  color: var(--danger);
}

.panel-foot {
  border-top: 1px solid var(--border);
  padding: 8px;
  flex: none;
}

.foot-btn {
  width: 100%;
  background: var(--bg-foot);
  border: 1px solid var(--border-2);
  color: var(--text-3);
  border-radius: 6px;
  padding: 6px;
  font-size: 11px;
  cursor: pointer;
}

.foot-btn:hover {
  color: var(--text-strong);
}

.foot-btn.danger:hover {
  color: var(--danger);
  border-color: var(--danger);
}
</style>
