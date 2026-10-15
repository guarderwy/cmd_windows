# CmdWindows

Windows 本地多终端管理工具：把常用命令按「项目」组织好，点一下就能一次性打开一堆终端并自动跑命令。

## 这玩意儿是干嘛的

日常开发经常要开好几个终端（前端 dev、后端、数据库、docker……），一个个手动 `cd` + 敲命令很烦。
CmdWindows 让你把这些「项目 + 命令组」提前配好：

- 每个项目可以挂多个命令面板（pane），每个面板指定**工作目录**和**一组启动命令**，打开就自动依次执行；
- 还能把多个项目的多个命令编成一个「一键启动组」，一次点击全部拉起。

本质上是个带项目管理的终端，终端是**真实的 cmd.exe**（用 node-pty 起的，不是假终端），所以啥命令都能跑。

## 已实现功能

- **真实终端**：基于 xterm.js + node-pty，起的是系统 cmd.exe；支持分屏（拖拽分割）、搜索、点击链接。
- **项目管理**：按项目组织命令；每个项目含多个面板，面板可设工作目录（`cwd`）和一组启动命令（`steps`），打开自动依次执行。
- **一键启动组（QuickLauncher）**：把多个项目/面板的命令编排成一组，一次点击按顺序全部打开（组内的命令之间间隔 500ms 依次拉起）。
- **布局记忆**：关掉再开，自动恢复上次的终端布局（可选：恢复时是否自动重跑命令，默认关，避免误启动）。
- **深浅色主题**切换。
- **配置本地持久化**，设置里可一键打开配置目录手动改。
- 侧栏可搜索、可伸缩；多个项目以标签页形式切换。

## 使用方法

### 1. 开发

```bash
npm install        # 需要 Node 20.19+ / 22.12+（Vite 7 的要求，Node 16 会构建报错）
npm run dev        # 启动开发模式（带热更新）
```

### 2. 打包成 exe

```bash
npm run package
```

产出在 `release/`：

- `CmdWindows Setup 0.1.0.exe` —— 安装包，双击安装；
- `win-unpacked/` —— 绿色版，不用安装，直接运行里面的 `CmdWindows.exe` 就行（整个文件夹一起带走，不能只拷那个 exe）。

> 打包时需要联网，会从 npmmirror 镜像拉 electron（脚本里已内置镜像配置，不用翻墙）。
> 如果系统默认 Node 是 16，打包脚本会自动 `nvm use 24`，不用担心。

### 3. 日常使用

- 顶部「＋ 新开终端」开一个空白终端；
- 左侧「项目」里新建项目 → 加面板 → 填工作目录和启动命令（一行一条，按顺序执行）；
- 想一键拉起多个命令，就在「一键启动」里编个组，点 ▶ 即可；
- 设置和主题在右上角 ⚙ / ☀☾。

配置都存在本地（设置里「打开配置目录」能看到），换机器把配置目录拷过去就能复用。

## 技术栈

Electron + electron-vite + Vue 3 + TypeScript；终端用 xterm.js，多面板布局用 dockview-vue，原生终端用 node-pty。

## 提交到 GitHub

远程仓库：`https://github.com/guarderwy/cmd_windows.git`

```bash
git remote add origin https://github.com/guarderwy/cmd_windows.git
git add .
git commit -m "init: CmdWindows 多终端管理工具"
git push -u origin main
```

> 提交前记得忽略 `node_modules/`、`out/`、`release/`（建议加个 `.gitignore`，要的话我直接补上）。
