<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useConfig } from '../composables/useConfig'
import { launchProject, openPane, closePane, closeAllPanes, sessions, switchProject, equalizeProject } from '../composables/useTerminalSessions'
import type { PaneCommand, Project } from '../../../shared/config-types'
import ProjectEditor from './ProjectEditor.vue'
import PaneEditor from './PaneEditor.vue'
import QuickLauncherPanel from './QuickLauncherPanel.vue'

const { config, removeProject, removePane, openConfigDir } = useConfig()

type Tab = 'projects' | 'launchers'
const tab = ref<Tab>('projects')
const collapsed = ref(false)
const kw = ref('')

// 侧栏可手动拉伸：记录宽度，拖动右边缘手柄调整（收起时固定 40px）
const sidebarWidth = ref(264)
const sidebarWidthPx = computed(() => (collapsed.value ? '40px' : `${sidebarWidth.value}px`))
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 560
function startResize(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startW = sidebarWidth.value
  const onMove = (ev: MouseEvent) => {
    const w = startW + (ev.clientX - startX)
    sidebarWidth.value = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w))
  }
  const onUp = () => {
    document.body.classList.remove('resizing')
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  document.body.classList.add('resizing')
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// 每个项目独立控制命令区域展开/收起；默认均为展开（key 不存在即展开）
const collapsedProjects = reactive<Record<string, boolean>>({})
function isProjectCollapsed(project: Project): boolean {
  return !!collapsedProjects[project.id]
}
function toggleProject(project: Project) {
  collapsedProjects[project.id] = !collapsedProjects[project.id]
}

const filteredProjects = computed(() => {
  const q = kw.value.trim().toLowerCase()
  if (!q) return config.projects
  return config.projects.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.panes || []).some((pane) => pane.name.toLowerCase().includes(q))
  )
})

const projectEditor = ref<{ project: Project | null } | null>(null)
const paneEditor = ref<{ project: Project; pane: PaneCommand | null } | null>(null)

function launchPane(project: Project, pane: PaneCommand) {
  openPane({
    title: `${project.name} · ${pane.name}`,
    cwd: pane.cwd || undefined,
    steps: pane.steps,
    projectId: project.id,
    projectName: project.name,
    configPaneId: pane.id
  })
  switchProject(project.id)
  equalizeProject(project.id)
}

function stopProject(project: Project) {
  for (const [id, s] of [...sessions]) {
    if (s.projectId === project.id) closePane(id)
  }
}

function stopProjectPane(project: Project, pane: PaneCommand) {
  for (const [id, s] of [...sessions]) {
    if (s.projectId === project.id && s.configPaneId === pane.id) closePane(id)
  }
}

function confirmRemoveProject(project: Project) {
  if (window.confirm(`确定删除项目「${project.name}」吗？该操作不可撤销。`)) {
    removeProject(project.id)
  }
}

function confirmRemovePane(project: Project, pane: PaneCommand) {
  if (window.confirm(`确定删除命令「${pane.name}」（项目：${project.name}）吗？`)) {
    removePane(project.id, pane.id)
  }
}

function paneState(project: Project, pane: PaneCommand): 'running' | 'exited' | 'idle' {
  let running = false
  let exited = false
  for (const s of sessions.values()) {
    if (s.configPaneId === pane.id && s.projectId === project.id) {
      if (s.exited) exited = true
      else running = true
    }
  }
  return running ? 'running' : exited ? 'exited' : 'idle'
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }" :style="{ width: sidebarWidthPx }">
    <div v-if="!collapsed" class="resize-handle" title="拖动调整宽度" @mousedown="startResize" />
    <div class="sidebar-head">
      <div class="tabs" v-show="!collapsed">
        <button class="tab" :class="{ active: tab === 'projects' }" @click="tab = 'projects'">项目</button>
        <button class="tab" :class="{ active: tab === 'launchers' }" @click="tab = 'launchers'">一键启动</button>
      </div>
      <span class="head-right" v-show="!collapsed">
        <button
          v-if="tab === 'projects'"
          class="icon-btn"
          title="新建项目"
          @click="projectEditor = { project: null }"
        >
          ＋
        </button>
      </span>
      <button class="collapse-btn" :title="collapsed ? '展开侧栏' : '收起侧栏'" @click="collapsed = !collapsed">
        {{ collapsed ? '»' : '«' }}
      </button>
    </div>

    <div class="sidebar-body" v-show="!collapsed">
      <template v-if="tab === 'projects'">
        <div class="search-wrap">
          <input class="search-box" v-model="kw" placeholder="搜索项目 / 命令..." />
          <button v-if="kw" class="search-clear" title="清空搜索" @click="kw = ''">×</button>
        </div>

        <div v-if="filteredProjects.length === 0" class="empty">
          没有匹配的项目
        </div>

        <div v-for="project in filteredProjects" :key="project.id" class="project">
          <div class="project-head">
            <button
              class="proj-toggle"
              :title="isProjectCollapsed(project) ? '展开命令' : '收起命令'"
              @click="toggleProject(project)"
            >
              {{ isProjectCollapsed(project) ? '▸' : '▾' }}
            </button>
            <span class="project-name" @click="toggleProject(project)">{{ project.name }}</span>
            <span class="project-actions">
              <button class="mini" title="启动全部命令（仅启动未开启的）" @click="launchProject(project)">▶</button>
              <button class="mini" title="停止该项目所有终端" @click="stopProject(project)">⏹</button>
              <button class="mini" title="编辑项目" @click="projectEditor = { project }">✎</button>
              <button class="mini danger" title="删除项目" @click="confirmRemoveProject(project)">🗑</button>
            </span>
          </div>

          <div class="project-body" :class="{ collapsed: isProjectCollapsed(project) }">
            <div class="project-body-inner">
              <div
                v-for="pane in project.panes"
                :key="pane.id"
                class="pane-item"
                :class="paneState(project, pane)"
                @dblclick="launchPane(project, pane)"
              >
                <span class="dot" />
                <span class="pane-name" :title="pane.name">{{ pane.name }}</span>
                <span class="pane-steps" :title="pane.steps.join(' → ')">{{ pane.steps.length }} 条命令</span>
                <span class="pane-toggle">
                  <button
                    v-if="paneState(project, pane) === 'running'"
                    class="mini danger"
                    title="停止"
                    @click.stop="stopProjectPane(project, pane)"
                  >⏹</button>
                  <button
                    v-else
                    class="mini"
                    title="开启命令"
                    @click.stop="launchPane(project, pane)"
                  >▶</button>
                </span>
                <span class="pane-actions">
                  <button class="mini" title="编辑命令" @click.stop="paneEditor = { project, pane }">✎</button>
                  <button class="mini danger" title="删除命令" @click.stop="confirmRemovePane(project, pane)">🗑</button>
                </span>
              </div>

              <button class="add-pane" @click="paneEditor = { project, pane: null }">＋ 添加命令</button>
            </div>
          </div>
        </div>
      </template>

      <QuickLauncherPanel v-else />
    </div>

    <div class="sidebar-foot" v-show="!collapsed">
      <button class="foot-btn" @click="closeAllPanes">停止全部终端</button>
      <button class="foot-btn" @click="openConfigDir">打开配置目录</button>
    </div>

    <ProjectEditor v-if="projectEditor" :project="projectEditor.project" @close="projectEditor = null" />
    <PaneEditor
      v-if="paneEditor"
      :project="paneEditor.project"
      :pane="paneEditor.pane"
      @close="paneEditor = null"
    />
  </aside>
</template>

<style scoped>
.sidebar {
  flex: none;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  position: relative;
}

/* 右边缘拖动手柄：手动拉伸侧栏宽度 */
.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  z-index: 5;
}

.resize-handle:hover {
  background: var(--border-active);
}

.sidebar-head {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 8px 0 6px;
  border-bottom: 1px solid var(--border);
}

.sidebar.collapsed .sidebar-head {
  justify-content: center;
  padding: 0;
}

.head-right {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.collapse-btn {
  margin-left: 4px;
  background: none;
  border: 1px solid var(--border-2);
  color: var(--text-2);
  font-size: 16px;
  line-height: 1;
  font-weight: 700;
  padding: 4px 9px;
  cursor: pointer;
  border-radius: 6px;
}

.collapse-btn:hover {
  color: var(--text-strong);
  background: var(--bg-button);
  border-color: var(--border-active);
}

/* 收起状态下：窄栏内居中显示一个展开按钮 */
.sidebar.collapsed .collapse-btn {
  margin-left: 0;
  font-size: 16px;
  padding: 5px;
  width: 26px;
  border-color: var(--border-active);
}

.search-wrap {
  position: relative;
  margin-bottom: 8px;
}

.search-box {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 26px 6px 8px;
  background: var(--bg-input);
  border: 1px solid var(--border-2);
  border-radius: 6px;
  color: var(--text);
  font-size: 12px;
  outline: none;
}

.search-box:focus {
  border-color: var(--border-active);
}

.search-clear {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 15px;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  border-radius: 4px;
}

.search-clear:hover {
  color: var(--text-strong);
  background: var(--border-2);
}

.tabs {
  display: flex;
  gap: 2px;
}

.tab {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  cursor: pointer;
  border-radius: 6px;
}

.tab:hover {
  color: var(--text);
}

.tab.active {
  color: var(--text-strong);
  background: var(--bg-button);
}

.title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 1px;
}

.icon-btn {
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

.sidebar-body {
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

.project {
  margin-bottom: 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-card);
  overflow: hidden;
}

.project-head {
  display: flex;
  align-items: center;
  padding: 8px 8px 6px 10px;
  gap: 6px;
}

.proj-toggle {
  flex: none;
  background: none;
  border: 1px solid var(--border-2);
  color: var(--text-2);
  font-size: 16px;
  line-height: 1;
  font-weight: 700;
  padding: 1px 1px;
  min-width: 10px;
  cursor: pointer;
  border-radius: 5px;
}

.proj-toggle:hover {
  color: var(--text-strong);
  background: var(--bg-button);
  border-color: var(--border-active);
}

/* 命令区域折叠：用 grid-template-rows 做平滑高度过渡 */
.project-body {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.2s ease;
}

.project-body.collapsed {
  grid-template-rows: 0fr;
}

.project-body-inner {
  overflow: hidden;
}

.project-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.project-actions {
  display: flex;
  gap: 2px;
  flex: none;
}

.pane-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 6px 10px;
  cursor: pointer;
  border-top: 1px solid var(--border);
}

.pane-item:hover {
  background: var(--bg-hover);
}

.pane-item .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--idle);
  flex: none;
}

.pane-item.running .dot {
  background: var(--success);
  box-shadow: 0 0 6px var(--success);
}

.pane-item.exited .dot {
  background: var(--danger);
}

.pane-name {
  font-size: 12px;
  color: var(--text-2);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pane-steps {
  font-size: 10px;
  color: var(--text-faintest);
  flex: none;
}

.pane-toggle {
  display: flex;
  gap: 2px;
  flex: none;
}

/* 始终预留操作区宽度：hover 只淡入按钮，不让整行布局抖动，
   从而避免光标本来对准“开启”却误点到右侧“删除” */
.pane-actions {
  display: flex;
  gap: 2px;
  flex: none;
  width: 40px;
  justify-content: flex-end;
}

.pane-actions .mini {
  opacity: 0;
  transition: opacity 0.12s ease;
}

.pane-item:hover .pane-actions .mini {
  opacity: 1;
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

.add-pane {
  width: 100%;
  background: none;
  border: none;
  border-top: 1px solid var(--border);
  color: var(--text-faint);
  font-size: 11px;
  padding: 7px;
  cursor: pointer;
  text-align: left;
  padding-left: 10px;
}

.add-pane:hover {
  color: var(--text-3);
  background: var(--bg-hover);
}

.sidebar-foot {
  border-top: 1px solid var(--border);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
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
</style>
