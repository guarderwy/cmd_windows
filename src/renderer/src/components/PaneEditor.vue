<script setup lang="ts">
import { ref } from 'vue'
import { useConfig } from '../composables/useConfig'
import type { PaneCommand, Project } from '../../../shared/config-types'

const props = defineProps<{ project: Project; pane: PaneCommand | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { addPane, updatePane } = useConfig()

const name = ref(props.pane?.name ?? '')
const cwd = ref(props.pane?.cwd ?? '')
const stepsText = ref((props.pane?.steps ?? []).join('\n'))

async function pickDir() {
  const path = await window.api.selectDirectory()
  if (path) cwd.value = path
}

async function save() {
  if (!name.value.trim()) return
  const steps = stepsText.value.split('\n')
  if (props.pane) {
    await updatePane(props.project.id, props.pane.id, { name: name.value, cwd: cwd.value, steps })
  } else {
    await addPane(props.project.id, { name: name.value, cwd: cwd.value, steps })
  }
  emit('close')
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <h3>{{ pane ? '编辑命令' : '新建命令' }}（{{ project.name }}）</h3>
      <label>
        <span>命令名称</span>
        <input v-model="name" placeholder="例如：dev / test" @keyup.enter="save" />
      </label>
      <label>
        <span>工作目录（留空则用项目目录）</span>
        <div class="dir-row">
          <input v-model="cwd" placeholder="例如：D:\www\order\server" />
          <button type="button" class="browse" @click="pickDir">浏览…</button>
        </div>
      </label>
      <label>
        <span>启动命令（每行一条，按顺序执行）</span>
        <textarea v-model="stepsText" rows="6" placeholder="cd /d D:\www&#13;&#10;nvm use 18&#13;&#10;npm run dev" />
      </label>
      <div class="actions">
        <button class="ghost" @click="emit('close')">取消</button>
        <button :disabled="!name.trim()" @click="save">保存</button>
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

input,
textarea {
  background: var(--bg-input);
  border: 1px solid var(--border-2);
  border-radius: 6px;
  color: var(--text);
  padding: 7px 9px;
  font-size: 12px;
  font-family: 'Cascadia Code', Consolas, monospace;
  outline: none;
  resize: vertical;
}

input:focus,
textarea:focus {
  border-color: var(--accent-focus);
}

.dir-row {
  display: flex;
  gap: 6px;
}

.dir-row input {
  flex: 1;
  min-width: 0;
}

.browse {
  flex: none;
  background: var(--bg-chip);
  border: 1px solid var(--border-2);
  color: var(--text-3);
  border-radius: 6px;
  padding: 0 12px;
  font-size: 12px;
  cursor: pointer;
}

.browse:hover {
  color: var(--text-strong);
  border-color: var(--accent-focus);
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
