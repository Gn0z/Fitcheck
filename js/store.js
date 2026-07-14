const PLAN_STORAGE_KEY = "fitcheck:v1:plans";
const SCHEDULE_STORAGE_KEY = "fitcheck:v1:schedules";
const COMPLETION_STORAGE_KEY = "fitcheck:v1:completions";

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

function loadPlans() {
  const raw = localStorage.getItem(PLAN_STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(defaultPlans));
    return structuredClone(defaultPlans);
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : structuredClone(defaultPlans);
  } catch {
    return structuredClone(defaultPlans);
  }
}

function loadCollection(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clone(value) {
  return structuredClone(value);
}

let plans = loadPlans();
let schedules = loadCollection(SCHEDULE_STORAGE_KEY);
let completions = loadCollection(COMPLETION_STORAGE_KEY);

function persist() {
  localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
  localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedules));
  localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(completions));
}

export const store = Object.freeze({
  getPlans() {
    return clone(plans);
  },

  getSchedules() {
    return clone(schedules);
  },

  getCompletions() {
    return clone(completions);
  },

  findPlan(id, useFallback = true) {
    const plan = plans.find((item) => item.id === id) || (useFallback ? plans[0] : null) || null;
    return plan ? clone(plan) : null;
  },

  savePlan(plan) {
    const nextPlan = clone(plan);
    const exists = plans.some((item) => item.id === nextPlan.id);
    plans = exists
      ? plans.map((item) => item.id === nextPlan.id ? nextPlan : item)
      : [nextPlan, ...plans];
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
  },

  deletePlan(planId) {
    plans = plans.filter((item) => item.id !== planId);
    schedules = schedules.filter((schedule) => schedule.planId !== planId);
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedules));
  },

  addSchedules(items) {
    schedules = [...schedules, ...clone(items)];
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedules));
  },

  addCompletion(completion) {
    completions = [clone(completion), ...completions];
    localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(completions));
  },

  restore(data) {
    plans = clone(data.plans);
    schedules = clone(data.schedules);
    completions = clone(data.completions);
    persist();
  },

  snapshot() {
    return {
      plans: clone(plans),
      schedules: clone(schedules),
      completions: clone(completions)
    };
  }
});
