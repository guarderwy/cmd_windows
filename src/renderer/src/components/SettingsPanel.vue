<script setup lang="ts">
import { useConfig } from '../composables/useConfig'

const emit = defineEmits<{ (e: 'close'): void }>()

const { config, persist } = useConfig()

async function toggleBool(key: 'restoreLayout' | 'autoRunOnRestore') {
  config.settings[key] = !config.settings[key]
  await persist()
}

async function setTheme(theme: 'dark' | 'light') {
  if (config.settings.theme === theme) return
  config.settings.theme = theme
  await persist()
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <h3>设置</h3>

      <div class="row">
        <div class="row-text">
          <span class="row-title">重启后恢复布局</span>
          <span class="row-desc">重新打开软件时，恢复上次打开的窗格与排列</span>
        </div>
        <button
          class="switch"
          :class="{ on: config.settings.restoreLayout }"
          title="重启后恢复布局"
          @click="toggleBool('restoreLayout')"
        >
          <span class="knob" />
        </button>
      </div>

      <div class="row">
        <div class="row-text">
          <span class="row-title">恢复时自动重跑命令</span>
          <span class="row-desc">恢复布局后是否自动执行各命令的启动步骤</span>
        </div>
        <button
          class="switch"
          :class="{ on: config.settings.autoRunOnRestore }"
          title="恢复时自动重跑命令"
          @click="toggleBool('autoRunOnRestore')"
        >
          <span class="knob" />
        </button>
      </div>

      <div class="row">
        <div class="row-text">
          <span class="row-title">主题</span>
          <span class="row-desc">切换界面深色 / 浅色</span>
        </div>
        <div class="seg">
          <button :class="{ active: config.settings.theme === 'dark' }" @click="setTheme('dark')">深色</button>
          <button :class="{ active: config.settings.theme === 'light' }" @click="setTheme('light')">浅色</button>
        </div>
      </div>

      <div class="actions">
        <button class="ghost" @click="emit('close')">关闭</button>
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
  width: 420px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-2);
  border-radius: 10px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

h3 {
  font-size: 14px;
  color: var(--text-strong);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.row-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.row-title {
  font-size: 13px;
  color: var(--text);
}

.row-desc {
  font-size: 11px;
  color: var(--text-faint);
}

.switch {
  flex: none;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: 1px solid var(--border-3);
  background: var(--bg-button);
  padding: 0;
  position: relative;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.switch .knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: transform 0.15s ease, background 0.15s ease;
}

.switch.on {
  background: var(--accent);
  border-color: var(--accent);
}

.switch.on .knob {
  transform: translateX(18px);
  background: #fff;
}

.seg {
  flex: none;
  display: flex;
  gap: 2px;
  background: var(--bg-button);
  border: 1px solid var(--border-3);
  border-radius: 6px;
  padding: 2px;
}

.seg button {
  background: transparent;
  border: none;
  color: var(--text-3);
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}

.seg button.active {
  background: var(--accent);
  color: #fff;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
}

button.ghost {
  background: transparent;
  border: 1px solid var(--border-3);
  color: var(--text-3);
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
}

button.ghost:hover {
  color: var(--text-strong);
}
</style>
