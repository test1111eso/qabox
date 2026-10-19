import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Report } from '@/types';

export type CropType = 'radish' | 'wheat' | 'strawberry' | 'melon';

export interface CropConfig {
  type: CropType;
  name: string;
  icon: string;
  growthTimeMs: number;
  seedCost: number;
  sellPrice: number;
  exp: number;
  unlockLevel: number;
  score: number;
  description: string;
}

export const CROP_CONFIGS: Record<CropType, CropConfig> = {
  radish: {
    type: 'radish',
    name: '小蘿蔔',
    icon: '🥕',
    growthTimeMs: 15 * 60 * 1000, // 15 分鐘
    seedCost: 15,
    sellPrice: 40,
    exp: 12,
    unlockLevel: 1,
    score: 40,
    description: '生長迅速的脆甜蘿蔔，新手入門最佳選擇。',
  },
  wheat: {
    type: 'wheat',
    name: '黃金小麥',
    icon: '🌾',
    growthTimeMs: 45 * 60 * 1000, // 45 分鐘
    seedCost: 40,
    sellPrice: 120,
    exp: 30,
    unlockLevel: 2,
    score: 110,
    description: '耐旱高產的黃金麥穗，農莊的經濟支柱。',
  },
  strawberry: {
    type: 'strawberry',
    name: '甜心草莓',
    icon: '🍓',
    growthTimeMs: 2 * 60 * 60 * 1000, // 2 小時
    seedCost: 120,
    sellPrice: 380,
    exp: 80,
    unlockLevel: 3,
    score: 350,
    description: '高單價的多汁草莓，滋味酸甜迷人。',
  },
  melon: {
    type: 'melon',
    name: '無Bug蜜瓜',
    icon: '🍈',
    growthTimeMs: 4 * 60 * 60 * 1000, // 4 小時
    seedCost: 320,
    sellPrice: 1080,
    exp: 240,
    unlockLevel: 4,
    score: 950,
    description: '經 QA 嚴格驗證的頂級蜜瓜，完全無蟲無瑕疵！',
  },
};

// 天然災害類型（主管級突發災難）
export type DisasterType = 'octopus' | 'james' | 'flower' | 'steak' | 'grandpa' | 'cs';

export interface DisasterConfig {
  type: DisasterType;
  bossName: string;
  disasterName: string;
  icon: string;
  desc: string;
  cost: number;
  resolveMsg: string;
}

export const DISASTER_CONFIGS: Record<DisasterType, DisasterConfig> = {
  octopus: {
    type: 'octopus',
    bossName: '章魚主管',
    disasterName: '驚奇深海大老爪',
    icon: '🐙',
    desc: '章魚不知從哪裡爬出海裡，用黏答答的觸手把好不容易長好的農田全部胡亂捲起，並大喊：「這季的 KPI 怎麼還沒收成！」',
    cost: 50,
    resolveMsg: '呈報超額 KPI 假報表！章魚主管揮舞觸手心滿意足地縮回深海！',
  },
  james: {
    type: 'james',
    bossName: '詹姆士',
    disasterName: '突發性全英文簡報暴風',
    icon: '💼',
    desc: '詹姆士帶著滿嘴讓人頭痛的英文術語空降農場，強行舉辦「農作物成長動態檢討會」，導致周遭蔬菜因為聽不懂而集體枯萎。',
    cost: 60,
    resolveMsg: '大聲背出「Synergy, Alignment, Deep dive」！詹姆士滿意微笑快步趕往下一場會議！',
  },
  flower: {
    type: 'flower',
    bossName: '三八花朵',
    disasterName: '帶刺玫瑰低氣壓',
    icon: '🥀',
    desc: '表面看似嬌豔的櫻花，其實帶有劇毒刺，所到之處雜草叢生，還會瘋狂挑剔你的澆水姿勢不符合「企業核心價值」。',
    cost: 45,
    resolveMsg: '獻上九十度深鞠躬並朗誦公司核心價值！花朵主管收起毒刺離去！',
  },
  steak: {
    type: 'steak',
    bossName: '牛排',
    disasterName: '三分熟鐵板熱浪',
    icon: '🥩',
    desc: '牛排帶著熊熊怒火與高溫鐵板進駐農田，散發出「今天不交出企劃就準備被煎」的強烈壓迫感，把田裡的土壤直接烤到乾涸。',
    cost: 70,
    resolveMsg: '端出大杯冰檸檬水與急件企劃！牛排鐵板瞬間降溫熄火撤退！',
  },
  grandpa: {
    type: 'grandpa',
    bossName: '阿公',
    disasterName: '碎碎唸古董級寒流',
    icon: '👴',
    desc: '阿公邁著緩慢但致命的步伐靠近，開始無止盡地發表「還想騙我?你對公司有什麼貢獻……」的精神訓話，直接把農夫的精神值扣到見底。',
    cost: 40,
    resolveMsg: '親切奉上熱茶並假裝用心做筆記！阿公主管終於意猶未盡地移步去訓示別人！',
  },
  cs: {
    type: 'cs',
    bossName: '客人',
    disasterName: '客訴海嘯級泥石流',
    icon: '🌊',
    desc: '客人一出現就帶來排山倒海的抱怨電話，無差別攻擊所有剛發芽的幼苗，宣稱「你的菜長得太慢，客戶森七七了」！',
    cost: 55,
    resolveMsg: '火速發送客訴專用安撫補償大禮包！海嘯級客訴瞬間風平浪靜！',
  },
};

export const DISASTER_TYPES: DisasterType[] = ['octopus', 'james', 'flower', 'steak', 'grandpa', 'cs'];

export type ActiveTool = 'hoe' | 'water' | 'scythe' | 'seed' | 'fertilizer';

export interface FarmCrop {
  type: CropType;
  plantedAt: number;
  totalDurationMs: number;
  wateredUntil: number;
  accumulatedMs: number;
  lastTickMs: number;
  isReady: boolean;
}

export interface FarmPlot {
  id: number;
  isUnlocked: boolean;
  isTilled: boolean;
  wateredUntil: number;
  crop: FarmCrop | null;
  hasWeed: boolean;
  weedGrownAt: number | null;
  disaster: DisasterType | null;
  disasterOccurredAt: number | null;
}

export interface DailyTask {
  id: string;
  title: string;
  desc: string;
  target: number;
  current: number;
  claimed: boolean;
  rewardCoins: number;
  rewardFertilizer: number;
  rewardSeeds?: { type: CropType; count: number };
}

export interface LeaderboardUser {
  rank: number;
  name: string;
  avatar: string;
  title: string;
  score: number;
  level: number;
  disastersCleared: number;
  isSelf?: boolean;
}

const MOISTURE_DURATION_MS = 6 * 60 * 60 * 1000; // 澆水一次保持濕潤 6 小時
const FERTILIZER_REDUCE_MS = 60 * 60 * 1000; // QA 金肥料加速 1 小時

// 頻率限制設定：天災至少 1 小時、長草至少 30 分鐘
const DISASTER_COOLDOWN_MS = 60 * 60 * 1000; // 至少 1 小時
const WEED_COOLDOWN_MS = 30 * 60 * 1000; // 至少 30 分鐘

function getStorageKey(): string {
  const uid =
    localStorage.getItem('qa_user_id') ||
    localStorage.getItem('qa_username') ||
    localStorage.getItem('qa_display_name') ||
    'default';
  return `qabox_farm_v5_${uid}`;
}

export const useFarmStore = defineStore('farm', () => {
  const isLoaded = ref(false);

  // 基礎資源
  const coins = ref(200);
  const exp = ref(0);
  const score = ref(0); // 當前遊玩積分
  const highestScore = ref(0); // 歷史最高遊玩紀錄
  const fertilizer = ref(3); // QA 金肥料
  const activeTool = ref<ActiveTool>('hoe');
  const selectedSeed = ref<CropType>('radish');

  // 冷卻時間戳
  const lastDisasterAt = ref(Date.now());
  const lastWeedAt = ref(Date.now());

  // 背包庫存
  const inventory = ref<Record<CropType, number>>({
    radish: 0,
    wheat: 0,
    strawberry: 0,
    melon: 0,
  });

  const seeds = ref<Record<CropType, number>>({
    radish: 6,
    wheat: 3,
    strawberry: 1,
    melon: 1,
  });

  // 30 塊乾淨田地（前 15 塊已開墾、無任何初始災害與雜草）
  const plots = ref<FarmPlot[]>(createCleanPlots());

  // 每日任務
  const taskDate = ref('');
  const dailyTasks = ref<DailyTask[]>([]);

  // 統計數據
  const totalHarvested = ref(0);
  const totalWeedsCleared = ref(0);
  const totalDisastersResolved = ref(0);
  const totalFertilizerUsed = ref(0);

  // 等級計算
  const level = computed(() => {
    let l = 1;
    let req = 60;
    let currentExp = exp.value;
    while (currentExp >= req) {
      currentExp -= req;
      l++;
      req = l * 60;
    }
    return l;
  });

  const currentLevelProgress = computed(() => {
    let l = 1;
    let req = 60;
    let currentExp = exp.value;
    while (currentExp >= req) {
      currentExp -= req;
      l++;
      req = l * 60;
    }
    return {
      current: currentExp,
      max: req,
      percent: Math.min(100, Math.round((currentExp / req) * 100)),
    };
  });

  // 檢查是否有待收成、長雜草、遭遇天然災害或任務待領取
  const hasAlerts = computed(() => {
    const hasReadyCrop = plots.value.some((p) => p.crop?.isReady);
    const hasWeed = plots.value.some((p) => p.hasWeed);
    const hasDisaster = plots.value.some((p) => !!p.disaster);
    const hasUnclaimedTask = dailyTasks.value.some(
      (t) => t.current >= t.target && !t.claimed
    );
    return hasReadyCrop || hasWeed || hasDisaster || hasUnclaimedTask;
  });

  const avatarPool = ['👩‍🌾', '👨‍🌾', '🤠', '🥷', '🧙‍♂️', '🤖', '🦊', '🐯', '🦁', '🐻'];
  function getAvatarForName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    return avatarPool[Math.abs(hash) % avatarPool.length];
  }

  // 同步個人最高遊玩紀錄到共用排行榜
  function syncSharedLeaderboard(myName: string) {
    if (!myName) return;
    try {
      const raw = localStorage.getItem('qabox_farm_shared_records');
      const records: Record<string, { highScore: number; level: number; disastersCleared: number }> = raw ? JSON.parse(raw) : {};
      const current = records[myName] || { highScore: 0, level: 1, disastersCleared: 0 };
      const currentPeak = Math.max(current.highScore, highestScore.value, score.value);
      highestScore.value = currentPeak;

      records[myName] = {
        highScore: currentPeak,
        level: Math.max(current.level, level.value),
        disastersCleared: Math.max(current.disastersCleared, totalDisastersResolved.value),
      };
      localStorage.setItem('qabox_farm_shared_records', JSON.stringify(records));
    } catch (e) {
      console.warn('Failed to sync leaderboard:', e);
    }
  }

  // 排行榜：以實際「最高遊玩紀錄分數」為準，不亂灌虛構分數！
  function getLeaderboard(reports: Report[] = [], myName = '我'): LeaderboardUser[] {
    const cleanMyName = myName.trim();
    syncSharedLeaderboard(cleanMyName);

    let records: Record<string, { highScore: number; level: number; disastersCleared: number }> = {};
    try {
      const raw = localStorage.getItem('qabox_farm_shared_records');
      if (raw) records = JSON.parse(raw);
    } catch {}

    // 彙整系統中所有真實同仁名冊
    const allUsers = new Set<string>();
    reports.forEach((r) => {
      let rawName = r.tester_name || '';
      const dashIdx = rawName.indexOf(' - ');
      if (dashIdx >= 0) rawName = rawName.substring(0, dashIdx);
      const name = rawName.trim();
      if (name) allUsers.add(name);
    });
    if (cleanMyName) allUsers.add(cleanMyName);
    Object.keys(records).forEach((u) => allUsers.add(u));

    const entries: Omit<LeaderboardUser, 'rank'>[] = [];

    allUsers.forEach((userName) => {
      const isMe = userName === cleanMyName;
      const rec = records[userName];
      const playScore = isMe ? Math.max(highestScore.value, score.value) : (rec?.highScore || 0);
      const userLevel = isMe ? level.value : (rec?.level || 1);
      const userDisasters = isMe ? totalDisastersResolved.value : (rec?.disastersCleared || 0);

      let title = playScore > 0 ? `Lv.${userLevel} 農莊探險家` : '尚未開工耕作';
      if (playScore >= 800) title = '🌾 QA 農神傳說';
      else if (playScore >= 350) title = '🛡️ 職場避災大師';
      else if (playScore >= 100) title = '🥕 辛勤耕耘達人';

      entries.push({
        name: userName,
        avatar: getAvatarForName(userName),
        title,
        score: playScore,
        level: userLevel,
        disastersCleared: userDisasters,
        isSelf: isMe,
      });
    });

    // 依最高遊玩分數排序
    entries.sort((a, b) => b.score - a.score);

    return entries.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }

  // 取得尚未降臨的災害類型（全場最多 2 個且不重複）
  function getRandomAvailableDisaster(): DisasterType | null {
    const currentDisasters = plots.value
      .map((p) => p.disaster)
      .filter((d): d is DisasterType => !!d);

    // 全場天災最多降臨 2 個
    if (currentDisasters.length >= 2) {
      return null;
    }

    // 不重複：挑選目前尚未降臨的災害種類
    const availableTypes = DISASTER_TYPES.filter((t) => !currentDisasters.includes(t));
    if (availableTypes.length === 0) return null;

    const idx = Math.floor(Math.random() * availableTypes.length);
    return availableTypes[idx];
  }

  // 建立 30 塊乾淨田地（一開始僅解鎖 2 塊空田，其餘 28 塊需逐步開墾）
  function createCleanPlots(): FarmPlot[] {
    const defaultPlots: FarmPlot[] = [];
    for (let i = 0; i < 30; i++) {
      defaultPlots.push({
        id: i,
        isUnlocked: i < 2, // 一開始只有 2 塊已開墾空田
        isTilled: i < 2,
        wateredUntil: 0,
        crop: null,
        hasWeed: false,
        weedGrownAt: null,
        disaster: null,
        disasterOccurredAt: null,
      });
    }
    return defaultPlots;
  }

  // 初始化每日任務
  function initDailyTasks(todayStr: string) {
    taskDate.value = todayStr;
    dailyTasks.value = [
      {
        id: 'checkin',
        title: '早晨巡田簽到',
        desc: '登入工作台並查看農場',
        target: 1,
        current: 1,
        claimed: false,
        rewardCoins: 50,
        rewardFertilizer: 0,
        rewardSeeds: { type: 'radish', count: 3 },
      },
      {
        id: 'care',
        title: '辛勤農事日常',
        desc: '完成 3 次澆水、鬆土或除草',
        target: 3,
        current: 0,
        claimed: false,
        rewardCoins: 60,
        rewardFertilizer: 1,
      },
      {
        id: 'disaster',
        title: '主管危機處理大師',
        desc: '成功化解 1 次職場天然災害',
        target: 1,
        current: 0,
        claimed: false,
        rewardCoins: 120,
        rewardFertilizer: 1,
      },
      {
        id: 'qa_duty',
        title: 'QA 今日戰功',
        desc: '於工作台建立 1 筆測試報告或上正式',
        target: 1,
        current: 0,
        claimed: false,
        rewardCoins: 100,
        rewardFertilizer: 2,
        rewardSeeds: { type: 'melon', count: 1 },
      },
      {
        id: 'harvest',
        title: '五穀豐收',
        desc: '收割任意 2 顆成熟農作物',
        target: 2,
        current: 0,
        claimed: false,
        rewardCoins: 80,
        rewardFertilizer: 1,
        rewardSeeds: { type: 'wheat', count: 2 },
      },
    ];
  }

  function incrementTask(taskId: string, amount = 1) {
    const t = dailyTasks.value.find((item) => item.id === taskId);
    if (t && !t.claimed) {
      t.current = Math.min(t.target, t.current + amount);
      saveState();
    }
  }

  function claimTask(taskId: string) {
    const t = dailyTasks.value.find((item) => item.id === taskId);
    if (t && t.current >= t.target && !t.claimed) {
      t.claimed = true;
      coins.value += t.rewardCoins;
      fertilizer.value += t.rewardFertilizer;
      addPlayScore(120);
      if (t.rewardSeeds) {
        seeds.value[t.rewardSeeds.type] += t.rewardSeeds.count;
      }
      saveState();
      return true;
    }
    return false;
  }

  function addPlayScore(amount: number) {
    score.value += amount;
    if (score.value > highestScore.value) {
      highestScore.value = score.value;
    }
  }

  function rewardOnReportCreate(type: 'normal' | 'prod') {
    if (type === 'prod') {
      fertilizer.value += 2;
      seeds.value.melon += 1;
      coins.value += 100;
      addPlayScore(150);
    } else {
      fertilizer.value += 1;
      seeds.value.strawberry += 1;
      coins.value += 50;
      addPlayScore(80);
    }
    incrementTask('qa_duty', 1);
    saveState();
  }

  function saveState() {
    if (!isLoaded.value) return;
    try {
      const data = {
        coins: coins.value,
        exp: exp.value,
        score: score.value,
        highestScore: highestScore.value,
        fertilizer: fertilizer.value,
        selectedSeed: selectedSeed.value,
        inventory: inventory.value,
        seeds: seeds.value,
        plots: plots.value,
        taskDate: taskDate.value,
        dailyTasks: dailyTasks.value,
        totalHarvested: totalHarvested.value,
        totalWeedsCleared: totalWeedsCleared.value,
        totalDisastersResolved: totalDisastersResolved.value,
        totalFertilizerUsed: totalFertilizerUsed.value,
        lastDisasterAt: lastDisasterAt.value,
        lastWeedAt: lastWeedAt.value,
        savedAt: Date.now(),
      };
      localStorage.setItem(getStorageKey(), JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save farm state:', e);
    }
  }

  function loadState() {
    try {
      const currentKey = getStorageKey();
      const raw = localStorage.getItem(currentKey);

      const todayStr = new Date().toISOString().split('T')[0];
      const now = Date.now();

      if (raw) {
        const parsed = JSON.parse(raw);
        coins.value = typeof parsed.coins === 'number' ? parsed.coins : 200;
        exp.value = typeof parsed.exp === 'number' ? parsed.exp : 0;
        score.value = typeof parsed.score === 'number' ? parsed.score : 0;
        highestScore.value = typeof parsed.highestScore === 'number' ? parsed.highestScore : score.value;
        fertilizer.value = typeof parsed.fertilizer === 'number' ? parsed.fertilizer : 3;
        selectedSeed.value = parsed.selectedSeed || 'radish';
        lastDisasterAt.value = parsed.lastDisasterAt || now;
        lastWeedAt.value = parsed.lastWeedAt || now;

        if (parsed.inventory) inventory.value = { ...inventory.value, ...parsed.inventory };
        if (parsed.seeds) seeds.value = { ...seeds.value, ...parsed.seeds };

        if (Array.isArray(parsed.plots)) {
          let loadedPlots: FarmPlot[] = parsed.plots;
          if (loadedPlots.length < 30) {
            for (let i = loadedPlots.length; i < 30; i++) {
              loadedPlots.push({
                id: i,
                isUnlocked: i < 2,
                isTilled: i < 2,
                wateredUntil: 0,
                crop: null,
                hasWeed: false,
                weedGrownAt: null,
                disaster: null,
                disasterOccurredAt: null,
              });
            }
          }

          // 天災上限裁減：最多保留 2 個不重複
          const seenDisasters: DisasterType[] = [];
          loadedPlots.forEach((p) => {
            if (p.disaster) {
              if (seenDisasters.length < 2 && !seenDisasters.includes(p.disaster)) {
                seenDisasters.push(p.disaster);
              } else {
                p.disaster = null;
                p.disasterOccurredAt = null;
              }
            }
          });

          // 離線時間成長
          loadedPlots.forEach((p: FarmPlot) => {
            if (p.crop && !p.crop.isReady && !p.disaster) {
              const lastTick = p.crop.lastTickMs || p.crop.plantedAt;
              const delta = Math.max(0, now - lastTick);
              if (p.crop.wateredUntil > lastTick) {
                const effectiveWaterMs = Math.min(delta, Math.max(0, p.crop.wateredUntil - lastTick));
                p.crop.accumulatedMs += effectiveWaterMs;
              }
              p.crop.lastTickMs = now;
              if (p.crop.accumulatedMs >= p.crop.totalDurationMs) {
                p.crop.isReady = true;
                p.crop.accumulatedMs = p.crop.totalDurationMs;
              }
            }
          });
          plots.value = loadedPlots;
        } else {
          plots.value = createCleanPlots();
        }

        if (parsed.taskDate === todayStr && Array.isArray(parsed.dailyTasks)) {
          dailyTasks.value = parsed.dailyTasks;
          taskDate.value = todayStr;
        } else {
          initDailyTasks(todayStr);
        }

        totalHarvested.value = parsed.totalHarvested || 0;
        totalWeedsCleared.value = parsed.totalWeedsCleared || 0;
        totalDisastersResolved.value = parsed.totalDisastersResolved || 0;
        totalFertilizerUsed.value = parsed.totalFertilizerUsed || 0;
      } else {
        plots.value = createCleanPlots();
        initDailyTasks(todayStr);
      }
    } catch (e) {
      console.warn('Failed to load farm state:', e);
      plots.value = createCleanPlots();
      initDailyTasks(new Date().toISOString().split('T')[0]);
    }

    isLoaded.value = true;
    saveState();
  }

  let tickCounter = 0;

  function tickUpdate() {
    const now = Date.now();
    let stateChanged = false;
    tickCounter++;

    // 1. 作物生長結算
    plots.value.forEach((plot) => {
      if (plot.disaster) {
        if (plot.crop) {
          plot.crop.lastTickMs = now;
        }
        return;
      }

      if (plot.crop && !plot.crop.isReady) {
        const lastTick = plot.crop.lastTickMs || plot.crop.plantedAt;
        const delta = Math.max(0, now - lastTick);

        if (plot.crop.wateredUntil > lastTick) {
          const effectiveWaterMs = Math.min(delta, Math.max(0, plot.crop.wateredUntil - lastTick));
          plot.crop.accumulatedMs += effectiveWaterMs;
        }

        plot.crop.lastTickMs = now;

        if (plot.crop.accumulatedMs >= plot.crop.totalDurationMs) {
          plot.crop.isReady = true;
          plot.crop.accumulatedMs = plot.crop.totalDurationMs;
          stateChanged = true;
        }
      }
    });

    // 2. 天然災害控制：至少 1 小時才可能觸發一次，且全場上限最多 2 個不重複！
    if (now - lastDisasterAt.value >= DISASTER_COOLDOWN_MS) {
      const activeDisasters = plots.value.filter((p) => !!p.disaster);
      if (activeDisasters.length < 2) {
        // 僅針對有作物的開墾地塊
        const eligiblePlots = plots.value.filter((p) => p.isUnlocked && !p.disaster && p.crop);
        if (eligiblePlots.length > 0 && Math.random() < 0.65) {
          const target = eligiblePlots[Math.floor(Math.random() * eligiblePlots.length)];
          const newD = getRandomAvailableDisaster();
          if (newD) {
            target.disaster = newD;
            target.disasterOccurredAt = now;
            lastDisasterAt.value = now;
            stateChanged = true;
          }
        }
      }
    }

    // 3. 雜草控制：至少 30 分鐘才可能冒出一次，且全場雜草不超過 3 株
    if (now - lastWeedAt.value >= WEED_COOLDOWN_MS) {
      const activeWeeds = plots.value.filter((p) => p.hasWeed);
      if (activeWeeds.length < 3) {
        const emptyPlots = plots.value.filter(
          (p) => p.isUnlocked && !p.crop && !p.hasWeed && !p.disaster
        );
        if (emptyPlots.length > 0) {
          const target = emptyPlots[Math.floor(Math.random() * emptyPlots.length)];
          target.hasWeed = true;
          target.weedGrownAt = now;
          lastWeedAt.value = now;
          stateChanged = true;
        }
      }
    }

    if (stateChanged || tickCounter % 5 === 0) {
      saveState();
    }
  }

  function unlockPlot(plotId: number): { ok: boolean; msg: string } {
    const plot = plots.value.find((p) => p.id === plotId);
    if (!plot || plot.isUnlocked) return { ok: false, msg: '該田地已解鎖' };

    const cost = 50 + Math.max(0, (plotId - 2) * 15);
    if (coins.value < cost) {
      return { ok: false, msg: `金幣不足！解鎖需要 ${cost} 🪙` };
    }

    coins.value -= cost;
    plot.isUnlocked = true;
    plot.isTilled = true;
    addPlayScore(100);
    saveState();
    return { ok: true, msg: `🎉 成功開拓新農地！花費 ${cost} 🪙 (+100 積分)` };
  }

  function resolveDisaster(plotId: number): { ok: boolean; msg: string; sound?: string; cost?: number } {
    const plot = plots.value.find((p) => p.id === plotId);
    if (!plot || !plot.disaster) {
      return { ok: false, msg: '此地塊目前平安無事，沒有天然災害！' };
    }

    const config = DISASTER_CONFIGS[plot.disaster];
    if (coins.value < config.cost) {
      return { ok: false, msg: `金幣不足！處理【${config.bossName}】需要 ${config.cost} 🪙！可先販售作物或完成 QA 任務賺錢` };
    }

    coins.value -= config.cost;
    plot.disaster = null;
    plot.disasterOccurredAt = null;
    totalDisastersResolved.value++;
    addPlayScore(150);
    incrementTask('disaster', 1);
    incrementTask('care', 1);
    saveState();

    return {
      ok: true,
      sound: 'coin',
      cost: config.cost,
      msg: `🛡️ 危機解除！${config.resolveMsg} (+150 積分)`,
    };
  }

  function interactPlot(plotId: number): {
    ok: boolean;
    msg: string;
    sound?: string;
    harvested?: CropConfig;
    hasDisasterPrompt?: DisasterConfig;
  } {
    const plot = plots.value.find((p) => p.id === plotId);
    if (!plot) return { ok: false, msg: '找不到田地' };
    if (!plot.isUnlocked) {
      return { ok: false, msg: '該地塊尚未開墾（🔒），請先解鎖開墾後再使用！' };
    }

    if (plot.disaster) {
      const dConfig = DISASTER_CONFIGS[plot.disaster];
      return {
        ok: false,
        msg: `🚨 突發【${dConfig.disasterName}】！請點擊花費 ${dConfig.cost} 🪙 迎合主管除災！`,
        hasDisasterPrompt: dConfig,
      };
    }

    const tool = activeTool.value;
    const now = Date.now();

    // 1. 鋤頭
    if (tool === 'hoe') {
      if (!plot.isTilled) {
        plot.isTilled = true;
        addPlayScore(15);
        incrementTask('care', 1);
        saveState();
        return { ok: true, sound: 'hoe', msg: '鬆土完成！泥土鬆軟肥沃 (+15 積分)' };
      }
      return { ok: false, msg: '此塊田地已經整好土囉！' };
    }

    // 2. 水壺
    if (tool === 'water') {
      if (!plot.isTilled) {
        return { ok: false, msg: '請先用鋤頭鬆土才能澆水喔！' };
      }
      if (plot.wateredUntil > now) {
        return { ok: false, msg: '土壤目前依然充足濕潤，不需重複澆水喔！' };
      }
      plot.wateredUntil = now + MOISTURE_DURATION_MS;
      if (plot.crop) {
        plot.crop.wateredUntil = now + MOISTURE_DURATION_MS;
      }
      addPlayScore(10);
      incrementTask('care', 1);
      saveState();
      return { ok: true, sound: 'water', msg: '💧 澆水完成！土壤濕潤保水 6 小時 (+10 積分)' };
    }

    // 3. 鐮刀
    if (tool === 'scythe') {
      if (plot.hasWeed) {
        plot.hasWeed = false;
        plot.weedGrownAt = null;
        totalWeedsCleared.value++;
        coins.value += 15;
        addPlayScore(25);
        incrementTask('care', 1);
        saveState();
        return { ok: true, sound: 'scythe', msg: '✂️ 乾淨俐落！除草獲得 15 🪙 (+25 積分)' };
      }

      if (plot.crop && plot.crop.isReady) {
        const cropType = plot.crop.type;
        const config = CROP_CONFIGS[cropType];
        inventory.value[cropType] = (inventory.value[cropType] || 0) + 1;
        totalHarvested.value++;
        exp.value += config.exp;
        addPlayScore(config.score);
        plot.crop = null;
        incrementTask('harvest', 1);
        saveState();
        return {
          ok: true,
          sound: 'harvest',
          msg: `🎉 豐收！獲得 ${config.name} ${config.icon} (+${config.exp} EXP, +${config.score} 積分)`,
          harvested: config,
        };
      }

      if (plot.crop && !plot.crop.isReady) {
        return { ok: false, msg: '作物尚未成熟，請耐心等候喔！' };
      }

      return { ok: false, msg: '這裡沒有雜草或可收成的作物' };
    }

    // 4. 種子袋 (播種不再秒出天災！)
    if (tool === 'seed') {
      if (!plot.isTilled) {
        return { ok: false, msg: '請先用鋤頭鬆土才能播種！' };
      }
      if (plot.hasWeed) {
        return { ok: false, msg: '有雜草阻礙，請先用鐮刀除草！' };
      }
      if (plot.crop) {
        return { ok: false, msg: '這裡已經種植作物了！' };
      }

      const seedType = selectedSeed.value;
      if ((seeds.value[seedType] || 0) <= 0) {
        return { ok: false, msg: `種子不足！請至農莊商店購買 ${CROP_CONFIGS[seedType].name} 種子` };
      }

      seeds.value[seedType]--;
      const isMoist = plot.wateredUntil > now;

      plot.crop = {
        type: seedType,
        plantedAt: now,
        totalDurationMs: CROP_CONFIGS[seedType].growthTimeMs,
        wateredUntil: plot.wateredUntil,
        accumulatedMs: 0,
        lastTickMs: now,
        isReady: false,
      };

      saveState();

      return {
        ok: true,
        sound: 'plant',
        msg: `🌱 播下 ${CROP_CONFIGS[seedType].name} 種子！${isMoist ? '（土壤濕潤生長中）' : '（請記得澆水喔！）'}`,
      };
    }

    // 5. QA 金肥料
    if (tool === 'fertilizer') {
      if (!plot.crop) {
        return { ok: false, msg: '田地上沒有作物可以施肥！' };
      }
      if (plot.crop.isReady) {
        return { ok: false, msg: '作物已經成熟，請用鐮刀收成！' };
      }
      if (fertilizer.value <= 0) {
        return { ok: false, msg: 'QA 金肥料已用盡！完成工作台測試單可再次獲得 ✨' };
      }

      fertilizer.value--;
      totalFertilizerUsed.value++;
      addPlayScore(50);
      plot.crop.accumulatedMs += FERTILIZER_REDUCE_MS;
      if (plot.crop.accumulatedMs >= plot.crop.totalDurationMs) {
        plot.crop.isReady = true;
        plot.crop.accumulatedMs = plot.crop.totalDurationMs;
      }
      saveState();
      return {
        ok: true,
        sound: 'sparkle',
        msg: plot.crop.isReady
          ? '✨ QA 魔法肥料發威！作物瞬間成熟了！(+50 積分)'
          : '✨ QA 金肥料施加成功！縮短 1 小時生長時間！(+50 積分)',
      };
    }

    return { ok: false, msg: '未知動作' };
  }

  function buySeed(type: CropType, count = 1) {
    const config = CROP_CONFIGS[type];
    if (level.value < config.unlockLevel) {
      return { ok: false, msg: `等級未達 Lv.${config.unlockLevel}，尚未解鎖此種子！` };
    }
    const totalCost = config.seedCost * count;
    if (coins.value < totalCost) {
      return { ok: false, msg: `金幣不足！購買需要 ${totalCost} 🪙` };
    }

    coins.value -= totalCost;
    seeds.value[type] = (seeds.value[type] || 0) + count;
    saveState();
    return { ok: true, msg: `🛒 成功購買 ${count} 包 ${config.name} 種子！` };
  }

  function sellCrop(type: CropType, count = 1) {
    const available = inventory.value[type] || 0;
    if (available < count) {
      return { ok: false, msg: '背包內沒有足夠的作物可以販售！' };
    }

    const config = CROP_CONFIGS[type];
    const earned = config.sellPrice * count;
    inventory.value[type] -= count;
    coins.value += earned;
    saveState();
    return { ok: true, msg: `💰 成功販售 ${count} 個 ${config.name}，獲得 ${earned} 🪙！` };
  }

  function sellAllCrops() {
    let totalEarned = 0;
    let totalCount = 0;
    (Object.keys(inventory.value) as CropType[]).forEach((type) => {
      const cnt = inventory.value[type];
      if (cnt > 0) {
        totalEarned += cnt * CROP_CONFIGS[type].sellPrice;
        totalCount += cnt;
        inventory.value[type] = 0;
      }
    });

    if (totalCount === 0) {
      return { ok: false, msg: '目前背包沒有任何可販售的農作物喔！' };
    }

    coins.value += totalEarned;
    saveState();
    return { ok: true, msg: `💰 全數販售 ${totalCount} 件作物，共入帳 ${totalEarned} 🪙！` };
  }

  // 完全徹底重置農場
  function resetFarm() {
    coins.value = 200;
    exp.value = 0;
    score.value = 0;
    highestScore.value = 0;
    fertilizer.value = 3;
    selectedSeed.value = 'radish';
    inventory.value = { radish: 0, wheat: 0, strawberry: 0, melon: 0 };
    seeds.value = { radish: 6, wheat: 3, strawberry: 1, melon: 1 };
    
    // 30 塊乾淨田地（徹底清空所有天災、清空所有雜草與作物）
    plots.value = createCleanPlots();
    
    // 重設天災與雜草冷卻為當前時間（至少 1 小時與 30 分鐘後才可能出現）
    lastDisasterAt.value = Date.now();
    lastWeedAt.value = Date.now();

    totalHarvested.value = 0;
    totalWeedsCleared.value = 0;
    totalDisastersResolved.value = 0;
    totalFertilizerUsed.value = 0;

    // 清理所有歷史存檔 key
    try {
      localStorage.removeItem(getStorageKey());
      localStorage.removeItem('qabox_farm_v5_default');
      localStorage.removeItem('qabox_farm_v4_default');
      localStorage.removeItem('qabox_farm_v3_default');
      localStorage.removeItem('qabox_pixel_farm_state_v2');
      localStorage.removeItem('qabox_pixel_farm_state_v1');
      localStorage.removeItem('qabox_pixel_farm_state');
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('qabox_farm_v4_') || k.startsWith('qabox_farm_v3_')) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) {
      console.warn('Failed to clear old farm storage:', e);
    }

    saveState();
  }

  return {
    isLoaded,
    coins,
    exp,
    score,
    highestScore,
    level,
    currentLevelProgress,
    fertilizer,
    activeTool,
    selectedSeed,
    inventory,
    seeds,
    plots,
    dailyTasks,
    hasAlerts,
    totalDisastersResolved,
    loadState,
    saveState,
    resetFarm,
    tickUpdate,
    interactPlot,
    unlockPlot,
    resolveDisaster,
    getLeaderboard,
    buySeed,
    sellCrop,
    sellAllCrops,
    claimTask,
    rewardOnReportCreate,
  };
});
