export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;

const LIMITS = Object.freeze({
  plans: 100,
  exercisesPerPlan: 200,
  exercisesTotal: 10000,
  schedules: 10000,
  completions: 20000,
  badgeUnlocks: 14
});

const BADGE_IDS = new Set([
  "streak-3",
  "streak-7",
  "streak-14",
  "streak-30",
  "days-1",
  "days-7",
  "days-30",
  "days-100",
  "completions-10",
  "completions-50",
  "completions-100",
  "minutes-60",
  "minutes-300",
  "minutes-1000"
]);

const DEFAULT_PROFILE = Object.freeze({ nickname: "训练者" });
const ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const HTML_PATTERN = /<\s*\/?\s*[a-z!][^>]*>/i;

export class DataValidationError extends Error {
  constructor(message, code = "invalid_data") {
    super(message);
    this.name = "DataValidationError";
    this.code = code;
  }
}

function fail(path, message, code) {
  throw new DataValidationError(`${path}${message}`, code);
}

function requireObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "必须是对象");
  }
  return value;
}

function requireArray(value, path, maximum) {
  if (!Array.isArray(value)) fail(path, "必须是数组");
  if (value.length > maximum) fail(path, `数量不能超过 ${maximum}`, "limit_exceeded");
  return value;
}

function requireText(value, path, { minimum = 0, maximum, allowHtml = false } = {}) {
  if (typeof value !== "string") fail(path, "必须是文本");
  const normalized = value.trim();
  if (!allowHtml && HTML_PATTERN.test(normalized)) fail(path, "不能包含 HTML 标记", "unsafe_html");
  if (normalized.length < minimum) fail(path, "不能为空");
  if (normalized.length > maximum) fail(path, `长度不能超过 ${maximum}`);
  return normalized;
}

function optionalText(value, path, maximum) {
  if (value === undefined || value === null) return "";
  return requireText(value, path, { maximum });
}

function requireId(value, path) {
  const id = requireText(value, path, { minimum: 1, maximum: 120, allowHtml: true });
  if (!ID_PATTERN.test(id)) fail(path, "包含不允许的字符");
  return id;
}

function requireNumber(value, path, { minimum, maximum, integer = false }) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "必须是有限数字");
  if (integer && !Number.isInteger(value)) fail(path, "必须是整数");
  if (value < minimum || value > maximum) fail(path, `必须在 ${minimum} 到 ${maximum} 之间`);
  return value;
}

function requireDate(value, path) {
  if (typeof value !== "string") fail(path, "必须是日期文本");
  const match = value.match(DATE_PATTERN);
  if (!match) fail(path, "必须使用 YYYY-MM-DD 格式");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 2000
    || year > 2100
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    fail(path, "不是有效日期");
  }
  return value;
}

function requireTimestamp(value, path) {
  if (typeof value !== "string" || !ISO_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    fail(path, "必须是有效的 ISO 时间");
  }
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2100) fail(path, "年份必须在 2000 到 2100 之间");
  return new Date(value).toISOString();
}

function assertUnique(items, getId, path) {
  const ids = new Set();
  items.forEach((item, index) => {
    const id = getId(item);
    if (ids.has(id)) fail(`${path}[${index}].id`, "不能重复", "duplicate_id");
    ids.add(id);
  });
}

function normalizeExercise(value, path) {
  const exercise = requireObject(value, path);
  const mode = requireText(exercise.mode, `${path}.mode`, { minimum: 1, maximum: 16, allowHtml: true });
  if (mode !== "reps" && mode !== "duration") fail(`${path}.mode`, "只能是 reps 或 duration");
  return {
    id: requireId(exercise.id, `${path}.id`),
    name: requireText(exercise.name, `${path}.name`, { minimum: 1, maximum: 40 }),
    sets: requireNumber(exercise.sets, `${path}.sets`, { minimum: 1, maximum: 99, integer: true }),
    mode,
    reps: mode === "reps"
      ? requireNumber(exercise.reps, `${path}.reps`, { minimum: 1, maximum: 9999, integer: true })
      : null,
    durationSeconds: mode === "duration"
      ? requireNumber(exercise.durationSeconds, `${path}.durationSeconds`, { minimum: 1, maximum: 9999, integer: true })
      : null,
    restSeconds: requireNumber(exercise.restSeconds, `${path}.restSeconds`, { minimum: 0, maximum: 3600, integer: true }),
    note: optionalText(exercise.note, `${path}.note`, 100)
  };
}

function normalizePlan(value, path) {
  const plan = requireObject(value, path);
  const exercises = requireArray(plan.exercises, `${path}.exercises`, LIMITS.exercisesPerPlan)
    .map((exercise, index) => normalizeExercise(exercise, `${path}.exercises[${index}]`));
  if (!exercises.length) fail(`${path}.exercises`, "至少需要一个动作");
  assertUnique(exercises, (exercise) => exercise.id, `${path}.exercises`);
  return {
    id: requireId(plan.id, `${path}.id`),
    name: requireText(plan.name, `${path}.name`, { minimum: 1, maximum: 40 }),
    goal: optionalText(plan.goal, `${path}.goal`, 200),
    estimatedMinutes: requireNumber(plan.estimatedMinutes, `${path}.estimatedMinutes`, { minimum: 1, maximum: 600 }),
    tag: optionalText(plan.tag, `${path}.tag`, 12),
    createdAt: requireTimestamp(plan.createdAt, `${path}.createdAt`),
    updatedAt: requireTimestamp(plan.updatedAt, `${path}.updatedAt`),
    exercises
  };
}

function normalizeSchedule(value, path) {
  const schedule = requireObject(value, path);
  return {
    id: requireId(schedule.id, `${path}.id`),
    planId: requireId(schedule.planId, `${path}.planId`),
    date: requireDate(schedule.date, `${path}.date`),
    createdAt: requireTimestamp(schedule.createdAt, `${path}.createdAt`)
  };
}

function normalizeCompletion(value, path) {
  const completion = requireObject(value, path);
  const scheduleId = completion.scheduleId === null || completion.scheduleId === undefined
    ? null
    : requireId(completion.scheduleId, `${path}.scheduleId`);
  return {
    id: requireId(completion.id, `${path}.id`),
    planId: requireId(completion.planId, `${path}.planId`),
    scheduleId,
    planName: requireText(completion.planName, `${path}.planName`, { minimum: 1, maximum: 40 }),
    date: requireDate(completion.date, `${path}.date`),
    completedAt: requireTimestamp(completion.completedAt, `${path}.completedAt`),
    minutes: requireNumber(completion.minutes, `${path}.minutes`, { minimum: 0, maximum: 600 })
  };
}

function normalizeBadgeUnlock(value, path) {
  const unlock = requireObject(value, path);
  const badgeId = requireId(unlock.badgeId, `${path}.badgeId`);
  if (!BADGE_IDS.has(badgeId)) fail(`${path}.badgeId`, "不是已知成就 ID");
  return {
    badgeId,
    unlockedAt: requireTimestamp(unlock.unlockedAt, `${path}.unlockedAt`)
  };
}

function normalizeProfile(value, path = "settings") {
  if (value === undefined || value === null) return { ...DEFAULT_PROFILE };
  const profile = requireObject(value, path);
  if (profile.nickname === undefined) return { ...DEFAULT_PROFILE };
  return {
    nickname: requireText(profile.nickname, `${path}.nickname`, { minimum: 1, maximum: 12 })
  };
}

export function normalizeState(value, { profileField = "profile" } = {}) {
  const state = requireObject(value, "data");
  const plans = requireArray(state.plans, "plans", LIMITS.plans)
    .map((plan, index) => normalizePlan(plan, `plans[${index}]`));
  const schedules = requireArray(state.schedules, "schedules", LIMITS.schedules)
    .map((schedule, index) => normalizeSchedule(schedule, `schedules[${index}]`));
  const completions = requireArray(state.completions, "completions", LIMITS.completions)
    .map((completion, index) => normalizeCompletion(completion, `completions[${index}]`));
  const badgeUnlocks = state.badgeUnlocks === undefined
    ? []
    : requireArray(state.badgeUnlocks, "badgeUnlocks", LIMITS.badgeUnlocks)
      .map((unlock, index) => normalizeBadgeUnlock(unlock, `badgeUnlocks[${index}]`));
  const exerciseCount = plans.reduce((total, plan) => total + plan.exercises.length, 0);
  if (exerciseCount > LIMITS.exercisesTotal) {
    fail("plans", `动作总数不能超过 ${LIMITS.exercisesTotal}`, "limit_exceeded");
  }

  assertUnique(plans, (plan) => plan.id, "plans");
  assertUnique(plans.flatMap((plan) => plan.exercises), (exercise) => exercise.id, "exercises");
  assertUnique(schedules, (schedule) => schedule.id, "schedules");
  assertUnique(completions, (completion) => completion.id, "completions");
  assertUnique(badgeUnlocks, (unlock) => unlock.badgeId, "badgeUnlocks");

  const planIds = new Set(plans.map((plan) => plan.id));
  schedules.forEach((schedule, index) => {
    if (!planIds.has(schedule.planId)) {
      fail(`schedules[${index}].planId`, "必须引用现有计划", "invalid_reference");
    }
  });

  return {
    plans,
    schedules,
    completions,
    badgeUnlocks,
    profile: normalizeProfile(state[profileField], profileField)
  };
}

export function normalizeBackup(value) {
  const backup = requireObject(value, "backup");
  if (backup.version !== 1) fail("version", "必须是 1");
  requireTimestamp(backup.exportedAt, "exportedAt");
  const normalized = normalizeState(backup, { profileField: "settings" });
  return {
    version: 1,
    exportedAt: requireTimestamp(backup.exportedAt, "exportedAt"),
    plans: normalized.plans,
    schedules: normalized.schedules,
    completions: normalized.completions,
    badgeUnlocks: normalized.badgeUnlocks,
    settings: normalized.profile
  };
}
