<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { DockviewVue, themeDark, themeLight } from 'dockview-vue'
import type { DockviewReadyEvent } from 'dockview-vue'
import TerminalPanel from './components/TerminalPanel.vue'
import ProjectSidebar from './components/ProjectSidebar.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import {
  bindDockApi,
  markRestoring,
  openFreeTerminal,
  sessions,
  openProjects,
  activeProjectId,
  switchProject,
  closeProject,
  FREE_TAB_ID,
  getSavedLayout,
  loadLayoutsOnce
} from './composables/useTerminalSessions'
import { useConfig } from './composables/useConfig'

const { load: loadConfig, loaded, config, persist, saveError } = useConfig()

const showSettings = ref(false)
const isLight = computed(() => config.settings.theme === 'light')
const dockviewTheme = computed(() => (isLight.value ? themeLight : themeDark))

function applyThemeClass() {
  document.documentElement.classList.toggle('theme-light', isLight.value)
}

async function toggleTheme() {
  config.settings.theme = isLight.value ? 'dark' : 'light'
  applyThemeClass()
  await persist()
}

// 顶部标签：“默认终端”常驻 + 各打开的项目
const tabs = computed(() => [{ id: FREE_TAB_ID, name: '默认终端' }, ...openProjects.value])

onMounted(async () => {
  await loadConfig()
  applyThemeClass()
  if (config.settings.restoreLayout) {
    const layouts = await loadLayoutsOnce()
    // 依据已保存的布局表重建项目标签（每个项目一个 dockview），名称取自配置
    const keys = Object.keys(layouts).filter((k) => k !== FREE_TAB_ID)
    openProjects.value = keys.map((id) => ({
      id,
      name: config.projects.find((p) => p.id === id)?.name ?? id
    }))
    activeProjectId.value = keys[0] ?? FREE_TAB_ID
  } else {
    activeProjectId.value = FREE_TAB_ID
  }
  // 全部为空时开一个默认终端（等面板挂载后再判断）
  setTimeout(() => {
    if (sessions.size === 0) void openFreeTerminal()
  }, 400)
})

// 主题变化时同步到根元素类名
watch(isLight, applyThemeClass)

async function onReady(event: DockviewReadyEvent, projectId: string) {
  bindDockApi(event, projectId)
  if (!loaded.value) await loadConfig()

  // 恢复该项目自己的布局（各 dockview 相互独立，只恢复属于自己的快照）
  if (config.settings.restoreLayout) {
    const saved = await getSavedLayout(projectId)
    if (saved) {
      markRestoring()
      event.api.fromJSON(saved as Parameters<typeof event.api.fromJSON>[0])
    }
  }
}
</script>

<template>
  <div class="app">
    <header class="topbar">
      <span class="brand">CmdWindows</span>
      <span v-if="saveError" class="error">{{ saveError }}</span>
      <div class="actions">
        <button class="icon-action" :title="isLight ? '切换到深色' : '切换到浅色'" @click="toggleTheme">
          {{ isLight ? '☾' : '☀' }}
        </button>
        <button class="icon-action" title="设置" @click="showSettings = true">⚙</button>
        <button @click="openFreeTerminal()">+ 新开终端</button>
      </div>
    </header>
    <div class="project-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="ptab"
        :class="{ active: activeProjectId === tab.id }"
        :title="tab.name"
        @click="switchProject(tab.id)"
      >
        <span class="ptab-name">{{ tab.name }}</span>
        <span v-if="tab.id !== FREE_TAB_ID" class="ptab-close" title="关闭项目" @click.stop="closeProject(tab.id)">×</span>
      </button>
    </div>

    <div class="main-row">
      <ProjectSidebar />
      <div class="stage">
        <!-- 每个标签一个独立 dockview，全部绝对定位堆叠铺满；
             仅激活项可见，其余用 opacity:0 隐藏以保留布局与终端内容 -->
        <DockviewVue
          v-for="tab in tabs"
          :key="tab.id"
          class="dock"
          :class="{ 'dock-hidden': activeProjectId !== tab.id }"
          :theme="dockviewTheme"
          @ready="onReady($event, tab.id)"
        >
          <template #panel-terminal="slotProps">
            <TerminalPanel v-bind="slotProps" />
          </template>
        </DockviewVue>
      </div>
    </div>

    <SettingsPanel v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 42px;
  padding: 0 12px;
  background: var(--bg-topbar);
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
  flex: none;
}

.brand {
  font-weight: 600;
  color: var(--text-strong);
}

.error {
  font-size: 11px;
  color: var(--danger);
}

.actions {
  margin-left: auto;
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-action {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-3);
  padding: 4px 8px;
  font-size: 14px;
  line-height: 1;
}

.icon-action:hover {
  color: var(--text-strong);
  background: var(--bg-button);
}

button {
  background: var(--bg-button);
  color: var(--text);
  border: 1px solid var(--border-3);
  border-radius: 6px;
  padding: 5px 12px;
  cursor: pointer;
  font-size: 12px;
}

button:hover {
  background: var(--bg-button-hover);
}

.main-row {
  flex: 1;
  display: flex;
  min-height: 0;
}

.project-tabs {
  display: flex;
  align-items: stretch;
  gap: 2px;
  height: 34px;
  padding: 0 6px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}

.ptab {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 200px;
  padding: 0 10px;
  background: var(--bg-surface-2);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  color: var(--text-4);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.ptab:hover {
  color: var(--text);
  background: var(--bg-tab-hover);
}

.ptab.active {
  color: var(--text-strong);
  background: var(--bg-button);
  border-color: var(--border-active);
}

.ptab-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.ptab-close {
  margin-left: 2px;
  font-size: 14px;
  line-height: 1;
  color: var(--text-muted);
  border-radius: 4px;
  padding: 0 3px;
}

.ptab-close:hover {
  color: var(--danger);
  background: var(--danger-bg);
}

.stage {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
}

/* DockviewVue 渲染为 Fragment，根 div 不会继承 App.vue 的 scoped 属性，
   故用 :deep 透传，让尺寸规则真正命中该元素 */
.stage :deep(.dock) {
  position: absolute;
  inset: 0;
}

/* 非激活项目：用 opacity:0 隐藏。不能用 visibility:hidden——dockview 对激活标签的
   关闭按钮(×)显式设置了 visibility:visible，会覆盖父级 hidden 导致 × 透出。
   opacity:0 作用于整棵子树、无法被后代覆盖，且保留布局尺寸与终端渲染，切回时内容原样恢复。 */
.stage :deep(.dock.dock-hidden) {
  opacity: 0;
  pointer-events: none;
}
</style>
