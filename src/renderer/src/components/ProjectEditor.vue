<script setup lang="ts">
import { ref } from 'vue'
import { useConfig } from '../composables/useConfig'
import type { Project } from '../../../shared/config-types'

const props = defineProps<{ project: Project | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { addProject, updateProject } = useConfig()

const name = ref(props.project?.name ?? '')

async function save() {
  if (!name.value.trim()) return
  if (props.project) {
    await updateProject(props.project.id, { name: name.value })
  } else {
    await addProject({ name: name.value })
  }
  emit('close')
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <h3>{{ project ? '编辑项目' : '新建项目' }}</h3>
      <label>
        <span>项目名称</span>
        <input v-model="name" placeholder="例如：订单服务" @keyup.enter="save" />
      </label>
      <p class="hint">项目只是分组，真正的工作目录在每个命令里单独设置</p>
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
  width: 380px;
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
  font-family: inherit;
  outline: none;
}

input:focus,
textarea:focus {
  border-color: var(--accent-focus);
}

.hint {
  font-size: 11px;
  color: var(--text-faint);
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
