import mineflayer from 'mineflayer';
import { loader as autoEat } from 'mineflayer-auto-eat'
import { plugin as toolPlugin } from 'mineflayer-tool';
import { pathfinder } from 'mineflayer-pathfinder';
// import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
// const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
import minecraftData from 'minecraft-data';


// 全局变量
let firstBot = null;
let botlist = [];
let mcData;

const loginOptions = {
  host: 'localhost', // minecraft server ip
  // username: `bot${botlist.length}`, // username to join as if auth is `offline`, else a unique identifier for this account. Switch if you want to change accounts
  auth: 'offline', // for offline mode servers, you can set this to 'offline'
  port: 33266,              // set if you need a port that isn't 25565
  version: false,           // only set if you need a specific version or snapshot (ie: "1.8.9" or "1.16.5"), otherwise it's set automatically
  // password: '12345678'      // set if you want to use password-based auth (may be unreliable). If specified, the `username` must be an email
}

class OptimizedTaskQueue {
  // 优化版任务队列类
  constructor(bot) {
    this.bot = bot;
    this.queue = [];
    this.isProcessing = false;
    this.taskId = 0;
    this.currentTask = null;
  }

  addTask(taskFn, priority = 0, description = '') {
    const task = {
      id: this.taskId++,
      fn: taskFn,
      priority,
      description,
      timestamp: Date.now(),
      onComplete: null,
      onError: null
    };

    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - b.priority || a.timestamp - b.timestamp);

    if (!this.isProcessing) {
      this.processNextTask();
    }

    return task.id;
  }

  addChainTask(taskFn, description = '') {
    const task = {
      id: this.taskId++,
      fn: taskFn,
      priority: 0,
      description,
      timestamp: Date.now(),
      onComplete: null,
      onError: null,
      isChainTask: true
    };

    this.queue.push(task);

    if (!this.isProcessing && this.currentTask === null) {
      this.processNextTask();
    }

    return task.id;
  }

  async processNextTask() {
    if (this.isProcessing || this.queue.length === 0) {
      this.isProcessing = false;
      this.currentTask = null;
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift();
    this.currentTask = task;

    try {
      await task.fn();

      if (task.onComplete) {
        await task.onComplete();
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      this.processNextTask();

    } catch (error) {
      console.error(`任务执行失败 (${task.description}):`, error);
      this.bot.chat(`任务执行失败: ${error.message}`);

      if (task.onError) {
        await task.onError(error);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      this.processNextTask();
    }
  }

  createTaskChain() {
    return new TaskChain(this);
  }

  cancelTask(taskId) {
    const index = this.queue.findIndex(task => task.id === taskId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }

    if (this.currentTask && this.currentTask.id === taskId) {
      this.currentTask = null;
      this.isProcessing = false;
      this.processNextTask();
      return true;
    }

    return false;
  }

  getStatus() {
    return {
      total: this.queue.length,
      processing: this.isProcessing,
      currentTask: this.currentTask ? this.currentTask.description : null,
      tasks: this.queue.map(task => ({
        id: task.id,
        description: task.description,
        priority: task.priority,
        isChainTask: task.isChainTask || false
      }))
    };
  }

  clearQueue() {
    this.queue = [];
    this.currentTask = null;
    this.isProcessing = false;
  }
}

class TaskChain {
  // 任务链类
  constructor(taskQueue) {
    this.taskQueue = taskQueue;
    this.chain = [];
    this.currentIndex = 0;
  }

  add(taskFn, description = '') {
    this.chain.push({ fn: taskFn, description });
    return this;
  }

  onComplete(callback) {
    if (this.chain.length > 0) {
      this.chain[this.chain.length - 1].onComplete = callback;
    }
    return this;
  }

  onError(errorCallback) {
    if (this.chain.length > 0) {
      this.chain[this.chain.length - 1].onError = errorCallback;
    }
    return this;
  }

  start() {
    if (this.chain.length === 0) return;

    this.currentIndex = 0;
    this.executeNext();
  }

  async executeNext() {
    if (this.currentIndex >= this.chain.length) return;

    const task = this.chain[this.currentIndex];
    const taskId = this.taskQueue.addChainTask(async () => {
      await task.fn();
      this.currentIndex++;

      if (this.currentIndex < this.chain.length) {
        setTimeout(() => this.executeNext(), 10);
      }
    }, task.description);

    return taskId;
  }

  getStatus() {
    return {
      total: this.chain.length,
      current: this.currentIndex,
      completed: this.currentIndex,
      remaining: this.chain.length - this.currentIndex
    };
  }
}

function createBots(loginOptions) {
  // 创建机器人并初始化任务队列
  const username = loginOptions.username || `bot${botlist.length}`;
  const bot = mineflayer.createBot(loginOptions);

  bot.taskQueue = new OptimizedTaskQueue(bot);
  botlist.push(bot);

  bot.on('end', (reason) => {
    console.log(`${username} 连接断开，原因: ${reason}`);
    const index = botlist.indexOf(bot);
    if (index !== -1) botlist.splice(index, 1);
  });

  bot.once('physicTick', () => {
    bot.loadPlugin(autoEat);
    bot.autoEat.enableAuto();
    bot.loadPlugin(toolPlugin);
    bot.loadPlugin(pathfinder);
    mcData = minecraftData(bot.version);
    console.log(username, '上线');

    if (!firstBot) firstBot = bot;
  });

  // 修改聊天监听，使用任务队列
  bot.on('chat', async (username, message) => {
    if (message.includes('give me')) {
      bot.taskQueue.addTask(async () => {
        const player = bot.players[username];
        if (!player || !player.entity) return;

        const playerPos = player.entity.position;
        const botPos = bot.entity.position;
        if (playerPos.distanceTo(botPos) > 6) return;

        await bot.lookAt(playerPos);

        for (const item of bot.inventory.items()) {
          try {
            await bot.toss(item.type, item.metadata, item.count);
          } catch (err) {
            console.log(`丢弃物品失败: ${err.message}`);
          }
        }
      }, 1, `给玩家 ${username} 物品`);
    }
  });

  return bot;
}

function attackMobs(bot) {
  // 攻击怪物功能
  setInterval(() => {
    bot.taskQueue.addTask(async () => {
      try {
        const entities = Object.values(bot.entities);
        const monsters = entities.filter(entity => {
          const distance = bot.entity.position.distanceTo(entity.position);
          return distance <= 3.5 &&
            entity.type !== 'player' &&
            (entity.kind + "").includes('mob') &&
            entity.type === 'hostile' &&
            entity !== bot.entity;
        });

        if (monsters.length) {
          let attackEntity = monsters[0];
          monsters.forEach(item => {
            if (bot.entity.position.distanceTo(item.position) < bot.entity.position.distanceTo(attackEntity.position)) {
              attackEntity = item;
            }
          });
          await bot.lookAt(attackEntity.position);
          await bot.attack(attackEntity);
        }
      } catch (error) {
        console.log(error);
      }
    }, 0, '攻击附近怪物');
  }, 800);
}

async function moveToPosition(bot, targetPos) {
  // 移动到指定位置
  return new Promise((resolve) => {
    bot.taskQueue.addTask(async () => {
      const botPos = bot.entity.position;
      const distance = botPos.distanceTo(targetPos);

      if (distance < 1.2) {
        resolve();
        return;
      }

      const goal = new goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, 0.2);
      bot.pathfinder.setGoal(goal);

      const checkArrival = () => {
        const currentPos = bot.entity.position;
        const currentDistance = currentPos.distanceTo(targetPos);

        if (currentDistance < 0.2) {
          bot.removeListener('move', checkArrival);
          resolve();
        }
      };

      bot.on('move', checkArrival);
    }, 2, `移动到位置 ${targetPos}`);
  });
}

function createFarmerBot(botName) {
  // 农田管理机器人
  function findNearbyFarmland(bot) {
    // 简化实现 - 实际应根据具体逻辑实现
    const botPos = bot.entity.position;
    return { position: { x: botPos.x + 2, y: botPos.y, z: botPos.z } };
  }

  async function processFarmland(bot, farmland) {
    await bot.waitForTicks(10);
    console.log(`${bot.username}: 处理农田`);
  }

  async function harvestCrops(bot) {
    await bot.waitForTicks(8);
    console.log(`${bot.username}: 收集作物`);
  }

  const bot = createBots({ ...loginOptions, username: botName });

  const farmingChain = bot.taskQueue.createTaskChain()
  .add(async () => {
    console.log(`${botName}: 开始农田管理任务`);
    await bot.waitForTicks(5);
  }, '初始化农田管理')
  .add(async () => {
    console.log(`${botName}: 扫描附近农田`);
    const farmland = findNearbyFarmland(bot);
    if (farmland) {
      await moveToPosition(bot, farmland.position);
      await processFarmland(bot, farmland);
    }
  }, '处理农田')
  .add(async () => {
    console.log(`${botName}: 收集成熟作物`);
    await harvestCrops(bot);
  }, '收集作物')
  .onComplete(() => {
    console.log(`${botName}: 农田管理完成，等待下一轮`);
    setTimeout(() => farmingChain.start(), 10000);
  });

  bot.once('spawn', () => {
    setTimeout(() => farmingChain.start(), 3000);
  });

  return bot;
}

function createBreedingBot(botName) {
  // 动物喂养机器人

  function findFeedableAnimals(bot) {
    // 简化实现
    return [{ name: 'cow', position: bot.entity.position }];
  }

  async function prepareFood(bot) {
    await bot.waitForTicks(3);
    console.log(`${bot.username}: 准备食物`);
  }

  async function feedAnimal(bot, animal) {
    await bot.waitForTicks(2);
    console.log(`${bot.username}: 喂养 ${animal.name}`);
  }
  const bot = createBots({ ...loginOptions, username: botName });

  const breedingChain = bot.taskQueue.createTaskChain()
  .add(async () => {
    console.log(`${botName}: 开始动物喂养任务`);
    const animals = findFeedableAnimals(bot);
    return animals;
  }, '扫描动物')
  .add(async (animals) => {
    console.log(`${botName}: 准备喂养 ${animals.length} 只动物`);
    await prepareFood(bot);
    for (const animal of animals) {
      await feedAnimal(bot, animal);
      await bot.waitForTicks(2);
    }
  }, '执行喂养')
  .onComplete(() => {
    console.log(`${botName}: 喂养任务完成`);
    setTimeout(() => breedingChain.start(), 15000);
  });

  bot.once('spawn', () => {
    setTimeout(() => breedingChain.start(), 2000);
  });

  return bot;
}

function createHangUpBot(botName) {
  // 挂机刷怪机器人
  const bot = createBots({ ...loginOptions, username: botName });

  bot.once('spawn', () => {
    bot.taskQueue.addTask(async () => {
      bot.chat(`/execute in minecraft:the_nether run tp ${botName} -747.5 252.5 611.5`);
      attackMobs(bot);
    }, 0, '挂机刷怪初始化');
  });

  return bot;
}

function createDigBot(botName, digRegion) {
  // 挖掘机器人
  const bot = createBots({ ...loginOptions, username: botName });

  bot.digQueue = [];
  bot.isDigging = false;
  bot.currentTarget = null;
  bot.digRegion = digRegion;

  const diggingChain = bot.taskQueue.createTaskChain()
  .add(async () => {
    console.log(`${botName}: 开始挖掘任务`);
    await analyzeDigRegion(bot);
  }, '分析挖掘区域')
  .add(async () => {
    console.log(`${botName}: 执行挖掘操作`);
    await startDiggingCycle(bot);
  }, '挖掘循环')
  .onComplete(() => {
    console.log(`${botName}: 挖掘任务完成`);
    setTimeout(() => diggingChain.start(), 5000);
  });

  bot.once('spawn', async () => {
    bot.loadPlugin(pathfinder);
    bot.loadPlugin(toolPlugin);
    mcData = minecraftData(bot.version);

    bot.on('diggingCompleted', (block) => {
      bot.taskQueue.addTask(async () => {
        if (bot.currentTarget && bot.currentTarget.position.equals(block.position)) {
          console.log(`${botName}: 挖掘完成 ${block.name}`);
          bot.digQueue.shift();
          bot.currentTarget = null;
          bot.isDigging = false;
          startNextDigTask(bot);
        }
      }, 1, '挖掘完成处理');
    });

    setTimeout(() => diggingChain.start(), 3000);
  });

  return bot;
}

// 辅助函数


async function analyzeDigRegion(bot) {
  await bot.waitForTicks(5);
  console.log(`${bot.username}: 分析挖掘区域`);
}

async function startDiggingCycle(bot) {
  await bot.waitForTicks(10);
  console.log(`${bot.username}: 执行挖掘`);
}

function startNextDigTask(bot) {
  if (bot.isDigging || bot.digQueue.length === 0) return;

  bot.taskQueue.addTask(async () => {
    bot.isDigging = true;
    const task = bot.digQueue[0];
    bot.currentTarget = task;

    try {
      await processDigTask(bot, task);
    } catch (error) {
      console.error(`${bot.username}: 挖掘任务出错`, error.message);
      bot.isDigging = false;
      bot.currentTarget = null;
      setTimeout(() => startNextDigTask(bot), 2000);
    }
  }, 2, '挖掘任务执行');
}

async function processDigTask(bot, task) {
  await bot.waitForTicks(5);
  console.log(`${bot.username}: 处理挖掘任务`);
}

// 任务管理命令
function setupTaskManagement(firstBot) {
  firstBot.on('message', (jsonMsg, position) => {
    if (jsonMsg.translate !== 'chat.type.text') return;

    const username = jsonMsg.with[0].text;
    const message = jsonMsg.with[1].text;

    if (message.trim().toLowerCase() === 'task status') {
      const statusMessages = [];
      botlist.forEach(bot => {
        const status = bot.taskQueue.getStatus();
        statusMessages.push(`${bot.username}: ${status.total}任务等待, 处理中: ${status.processing ? '是' : '否'}`);
      });

      firstBot.whisper(username, statusMessages.join('\n'));
    }

    if (message.trim().toLowerCase().startsWith('task cancel ')) {
      const taskId = parseInt(message.trim().split(' ')[2]);
      let cancelled = false;

      botlist.forEach(bot => {
        if (bot.taskQueue.cancelTask(taskId)) {
          cancelled = true;
        }
      });

      if (cancelled) {
        firstBot.whisper(username, `任务 ${taskId} 已取消`);
      } else {
        firstBot.whisper(username, `未找到任务 ${taskId}`);
      }
    }

    if (message.trim().toLowerCase() === 'bot list') {
      const botNames = botlist.map(bot => bot.username).join(', ');
      firstBot.whisper(username, `在线机器人: ${botNames}`);
    }
  });
}

// 主函数 - 创建机器人系统
function main() {
  // 创建主控制机器人
  firstBot = createBots({ ...loginOptions, username: "firstBot" });

  // 设置任务管理
  setupTaskManagement(firstBot);

  // 创建各种类型的机器人
  // setTimeout(() => {
  //   createFarmerBot('FarmerBot1');
  //   createBreedingBot('BreederBot1');
  //   createHangUpBot('HunterBot1');
  //   createDigBot('MinerBot1', { x: 100, y: 64, z: 100 });
  //
  //   console.log('所有机器人创建完成');
  // }, 5000);
}

main();
