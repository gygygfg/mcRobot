# Minecraft 机器人管理系统

一个基于 Mineflayer 的 Minecraft 机器人管理系统，支持多种类型的自动化机器人协同工作。

## 功能特性

### 🤖 机器人类型
- **主控制机器人** (`firstBot`) - 系统核心，负责任务管理和协调
- **农田管理机器人** (`FarmerBot`) - 自动管理农田、种植和收获作物
- **动物喂养机器人** (`BreederBot`) - 自动喂养和繁殖动物
- **挂机刷怪机器人** (`HunterBot`) - 自动攻击附近怪物
- **挖掘机器人** (`MinerBot`) - 自动挖掘指定区域

### ⚙️ 核心功能
- **智能任务队列系统** - 优先级任务调度和链式任务执行
- **模块化机器人设计** - 易于扩展新的机器人类型
- **实时任务管理** - 支持任务状态查询和取消
- **自动物品管理** - 自动丢弃物品给玩家
- **路径规划** - 使用 Mineflayer-pathfinder 进行智能移动

## 快速开始

### 环境要求
- Node.js 18+
- Minecraft Java Edition 服务器（支持离线模式）

### 安装依赖
```bash
npm install
```

### 配置服务器连接
编辑 `app.mjs` 文件中的 `loginOptions` 配置：
```javascript
const loginOptions = {
  host: 'localhost',      // Minecraft 服务器地址
  port: 33266,            // 服务器端口
  auth: 'offline',        // 认证模式（offline/online）
  version: false,         // 自动检测版本
}
```

### 启动系统
```bash
node app.mjs
```

## 使用方法

### 基础命令
在游戏聊天框中输入以下命令：

| 命令 | 功能 | 示例 |
|------|------|------|
| `give me` | 机器人丢弃所有物品给你 | `give me` |
| `task status` | 查看所有机器人任务状态 | `task status` |
| `task cancel <id>` | 取消指定任务ID | `task cancel 123` |
| `bot list` | 列出所有在线机器人 | `bot list` |

### 机器人创建
系统默认创建主控制机器人。要创建其他类型的机器人，取消注释 `main()` 函数中的相应代码：

```javascript
// 创建各种类型的机器人
setTimeout(() => {
  createFarmerBot('FarmerBot1');      // 农田管理机器人
  createBreedingBot('BreederBot1');   // 动物喂养机器人
  createHangUpBot('HunterBot1');      // 挂机刷怪机器人
  createDigBot('MinerBot1', { x: 100, y: 64, z: 100 }); // 挖掘机器人
}, 5000);
```

## 系统架构

### 任务队列系统 (`OptimizedTaskQueue`)
- **优先级调度** - 支持任务优先级设置
- **链式任务** - 支持任务链式执行
- **错误处理** - 自动错误捕获和恢复
- **状态监控** - 实时任务状态查询

### 任务链系统 (`TaskChain`)
- **顺序执行** - 确保任务按顺序执行
- **回调支持** - 支持完成和错误回调
- **状态跟踪** - 实时跟踪任务链进度

### 机器人模块
每个机器人类型都是一个独立的模块，包含：
- 特定功能实现
- 任务链定义
- 事件监听器
- 状态管理

## 技术栈

- **Mineflayer** - Minecraft 机器人框架
- **mineflayer-auto-eat** - 自动进食插件
- **mineflayer-tool** - 工具使用插件
- **mineflayer-pathfinder** - 路径规划插件
- **minecraft-data** - Minecraft 数据包

## 开发指南

### 添加新机器人类型
1. 创建新的机器人函数（参考现有实现）
2. 定义任务链和功能逻辑
3. 在 `main()` 函数中注册机器人

### 扩展功能
- 修改 `OptimizedTaskQueue` 类添加新功能
- 扩展 `TaskChain` 类支持更复杂的任务流
- 添加新的聊天命令到 `setupTaskManagement()`

### 调试技巧
- 使用 `console.log()` 输出调试信息
- 查看机器人任务状态：`task status`
- 监控机器人聊天消息

## 配置说明

### 服务器配置
```javascript
const loginOptions = {
  host: 'localhost',      // 服务器地址
  port: 33266,            // 服务器端口（默认 25565）
  auth: 'offline',        // 认证模式：'offline' 或 'online'
  version: false,         // 游戏版本（false 为自动检测）
  username: 'botName',    // 机器人用户名
}
```

### 任务优先级
- `0` - 最高优先级（紧急任务）
- `1` - 高优先级（重要任务）
- `2` - 普通优先级（常规任务）
- `3` - 低优先级（后台任务）

## 故障排除

### 常见问题
1. **连接失败**
   - 检查服务器地址和端口
   - 确认服务器支持离线模式
   - 检查防火墙设置

2. **机器人无响应**
   - 检查任务队列状态：`task status`
   - 查看控制台错误信息
   - 重启机器人系统

3. **路径规划失败**
   - 确保安装了 `mineflayer-pathfinder`
   - 检查目标位置是否可达
   - 调整路径规划参数

### 日志查看
- 控制台输出所有机器人活动
- 错误信息包含详细堆栈跟踪
- 任务执行状态实时显示

## 许可证

本项目基于 MIT 许可证开源。

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个项目。

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 相关链接

- [Mineflayer 文档](https://github.com/PrismarineJS/mineflayer)
- [Mineflayer 插件列表](https://github.com/PrismarineJS/mineflayer#plugins)
- [Minecraft 协议文档](https://wiki.vg/Protocol)

---

**提示**：请确保遵守 Minecraft 服务器的使用规则，仅在允许的服务器上使用机器人。