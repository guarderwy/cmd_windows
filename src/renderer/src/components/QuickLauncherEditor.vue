<script setup lang="ts">
import { ref } from 'vue'
import { useConfig } from '../composables/useConfig'
import type { QuickLauncher } from '../../../shared/config-types'

const props = defineProps<{ launcher: QuickLauncher | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { config, addLauncher, updateLauncher } = useConfig()

const name = ref(props.launcher?.name ?? '')
const selected = ref<Set<string>>(new Set((props.launcher?.targets ?? []).map((t) => `${t.projectId}:${t.paneId}`)))

function toggle(projectId: string, paneId: string) {
  const key = `${projectId}:${paneId}`
  if (selected.value.has(key)) selected.value.delete(key)
  else selected.value.add(key)
}

function isChecked(projectId: string, paneId: string) {
  return selected.value.has(`${projectId}:${paneId}`)
}

async function save() {
  if (!name.value.trim()) return
  const targets = [...selected.value].map((key) => {
    const [projectId, paneId] = key.split(':')
    return { projectId, paneId }
  })
  if (props.launcher) {
    await updateLauncher(props.launcher.id, { name: name.value, targets })
  } else {
    await addLauncher({ name: name.value, targets })
  }
  emit('close')
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <h3>{{ launcher ? '编辑启动组' : '新建启动组' }}</h3>
      <label>
        <span>启动组名称</span>
        <input v-model="name" placeholder="例如：日常开发环境" @keyup.enter="save" />
      </label>
      <label>
        <span>选择要启动的命令（可跨项目多选）</span>
      </label>
      <div class="tree">
        <div v-if="config.projects.length === 0" class="empty">还没有项目命令，请先在「项目」页创建</div>
        <div v-for="project in config.projects" :key="project.id" class="tree-project">
          <div class="tree-project-name">{{ project.name }}</div>
          <label v-for="pane in project.panes" :key="pane.id" class="tree-item">
            <input type="checkbox" :checked="isChecked(project.id, pane.id)" @change="toggle(project.id, pane.id)" />
            <span>{{ pane.name }}</span>
            <span class="steps">{{ pane.steps.length }} 条命令</span>
          </label>
        </div>
      </div>
      <div class="actions">
        <button class="ghost" @click="emit('close')">取消</button>
        <button :disabled="!name.trim() || selected.size === 0" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: var(--mask);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  width: 440px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-2);
  border-radius: 10px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h3 {
  font-size: 14px;
  color: var(--text-strong);
}

label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  color: var(--text-3);
}

input[type='text'],
input:not([type]) {
  background: var(--bg-input);
  border: 1px solid var(--border-2);
  border-radius: 6px;
  color: var(--text);
  padding: 7px 9px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
}

input:focus {
  border-color: var(--accent-focus);
}

.tree {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  background: var(--bg-input);
}

.tree-project {
  margin-bottom: 8px;
}

.tree-project-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-strong);
  padding: 4px 0;
}

.tree-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 4px 0 4px 14px;
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
}

.tree-item:hover {
  color: var(--text-strong);
}

.tree-item input {
  accent-color: var(--accent);
}

.steps {
  margin-left: auto;
  font-size: 10px;
  color: var(--text-faintest);
}

.empty {
  color: var(--text-faintest);
  font-size: 12px;
  text-align: center;
  padding: 20px 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

button {
  background: var(--accent);
  border: none;
  color: #fff;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.ghost {
  background: transparent;
  border: 1px solid var(--border-3);
  color: var(--text-3);
}
</style>
