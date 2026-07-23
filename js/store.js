import { DataValidationError, normalizeState } from "./data-validation.js?v=28";

const STATE_STORAGE_KEY = "fitcheck:v1:state";
const PLAN_STORAGE_KEY = "fitcheck:v1:plans";
const SCHEDULE_STORAGE_KEY = "fitcheck:v1:schedules";
const COMPLETION_STORAGE_KEY = "fitcheck:v1:completions";
const BADGE_UNLOCK_STORAGE_KEY = "fitcheck:v1:badge-unlocks";
const PROFILE_STORAGE_KEY = "fitcheck:v1:profile";
const DEFAULT_PROFILE = Object.freeze({ nickname: "训练者" });

const defaultPlans = [
  {
    id: "plan-core-awakening",
    name: "核心唤醒",
    goal: "增强核心稳定、建立训练习惯",
    estimatedMinutes: 8,
    tag: "新手友好",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
    exercises: [
      { id: "ex-plank", name: "平板支撑", sets: 2, mode: "duration", reps: null, durationSeconds: 30, restSeconds: 20, note: "保持身体成一直线" },
      { id: "ex-dead-bug", name: "死虫式", sets: 2, mode: "reps", reps: 12, durationSeconds: null, restSeconds: 20, note: "下背贴地" },
      { id: "ex-crunch", name: "卷腹", sets: 3, mode: "reps", reps: 15, durationSeconds: null, restSeconds: 30, note: "避免拉扯颈部" },
      { id: "ex-climber", name: "登山跑", sets: 2, mode: "duration", reps: null, durationSeconds: 30, restSeconds: 20, note: "保持均匀呼吸" },
      { id: "ex-bridge", name: "臀桥", sets: 3, mode: "reps", reps: 15, durationSeconds: null, restSeconds: 30, note: "顶峰收紧臀部" },
      { id: "ex-stretch", name: "站姿拉伸", sets: 1, mode: "duration", reps: null, durationSeconds: 60, restSeconds: 0, note: "缓慢完成" }
    ]
  }
];

function clone(value) {
  return structuredClone(value);
}

function defaultState() {
  return {
    plans: clone(defaultPlans),
    schedules: [],
    completions: [],
    badgeUnlocks: [],
    profile: { ...DEFAULT_PROFILE }
  };
}

function parseStoredJson(key, fallback) {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : JSON.parse(raw);
}

function loadInitialState() {
  const combinedRaw = localStorage.getItem(STATE_STORAGE_KEY);
  if (combinedRaw !== null) {
    try {
      return { state: normalizeState(JSON.parse(combinedRaw)), issue: null };
    } catch (error) {
      return {
        state: defaultState(),
        issue: {
          code: error instanceof DataValidationError ? error.code : "invalid_json",
          message: "检测到本地数据异常，FitCheck 已使用安全数据启动。请从有效备份恢复。"
        }
      };
    }
  }

  try {
    const hasLegacyData = [
      PLAN_STORAGE_KEY,
      SCHEDULE_STORAGE_KEY,
      COMPLETION_STORAGE_KEY,
      BADGE_UNLOCK_STORAGE_KEY,
      PROFILE_STORAGE_KEY
    ].some((key) => localStorage.getItem(key) !== null);
    const candidate = hasLegacyData
      ? {
          plans: parseStoredJson(PLAN_STORAGE_KEY, clone(defaultPlans)),
          schedules: parseStoredJson(SCHEDULE_STORAGE_KEY, []),
          completions: parseStoredJson(COMPLETION_STORAGE_KEY, []),
          badgeUnlocks: parseStoredJson(BADGE_UNLOCK_STORAGE_KEY, []),
          profile: parseStoredJson(PROFILE_STORAGE_KEY, { ...DEFAULT_PROFILE })
        }
      : defaultState();
    const state = normalizeState(candidate);
    try {
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
      return { state, issue: null };
    } catch {
      return {
        state,
        issue: {
          code: "storage_write_failed",
          message: "本地数据可以读取，但暂时无法保存。请导出备份并检查浏览器存储空间。"
        }
      };
    }
  } catch (error) {
    return {
      state: defaultState(),
      issue: {
        code: error instanceof DataValidationError ? error.code : "invalid_json",
        message: "检测到旧版本地数据异常，FitCheck 已使用安全数据启动。请从有效备份恢复。"
      }
    };
  }
}

let { state, issue: loadIssue } = loadInitialState();

function commit(candidate) {
  const normalized = normalizeState(candidate);
  const serialized = JSON.stringify(normalized);
  localStorage.setItem(STATE_STORAGE_KEY, serialized);
  state = normalized;
  loadIssue = null;
}

function updateState(changes) {
  commit({ ...state, ...changes });
}

export const store = Object.freeze({
  getPlans() {
    return clone(state.plans);
  },

  getSchedules() {
    return clone(state.schedules);
  },

  getCompletions() {
    return clone(state.completions);
  },

  getBadgeUnlocks() {
    return clone(state.badgeUnlocks);
  },

  getProfile() {
    return clone(state.profile);
  },

  getLoadIssue() {
    return loadIssue ? { ...loadIssue } : null;
  },

  updateNickname(nickname) {
    updateState({ profile: { nickname } });
  },

  findPlan(id, useFallback = true) {
    const plan = state.plans.find((item) => item.id === id) || (useFallback ? state.plans[0] : null) || null;
    return plan ? clone(plan) : null;
  },

  savePlan(plan) {
    const nextPlan = clone(plan);
    const exists = state.plans.some((item) => item.id === nextPlan.id);
    const plans = exists
      ? state.plans.map((item) => item.id === nextPlan.id ? nextPlan : item)
      : [nextPlan, ...state.plans];
    updateState({ plans });
  },

  deletePlan(planId) {
    updateState({
      plans: state.plans.filter((item) => item.id !== planId),
      schedules: state.schedules.filter((schedule) => schedule.planId !== planId)
    });
  },

  addSchedules(items) {
    updateState({ schedules: [...state.schedules, ...clone(items)] });
  },

  deleteSchedule(scheduleId) {
    const schedules = state.schedules.filter((schedule) => schedule.id !== scheduleId);
    if (schedules.length === state.schedules.length) return false;
    updateState({ schedules });
    return true;
  },

  addCompletion(completion) {
    updateState({ completions: [clone(completion), ...state.completions] });
  },

  addBadgeUnlocks(items) {
    const existingIds = new Set(state.badgeUnlocks.map((unlock) => unlock.badgeId));
    const newUnlocks = clone(items).filter((unlock) => {
      if (existingIds.has(unlock.badgeId)) return false;
      existingIds.add(unlock.badgeId);
      return true;
    });
    if (!newUnlocks.length) return;
    updateState({ badgeUnlocks: [...state.badgeUnlocks, ...newUnlocks] });
  },

  restore(data) {
    const profileField = Object.hasOwn(data, "profile") ? "profile" : "settings";
    const normalized = normalizeState(data, { profileField });
    commit(normalized);
  },

  snapshot() {
    return {
      plans: clone(state.plans),
      schedules: clone(state.schedules),
      completions: clone(state.completions),
      badgeUnlocks: clone(state.badgeUnlocks),
      settings: clone(state.profile)
    };
  }
});
