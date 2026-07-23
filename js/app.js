import { calculateStreak as calculateCompletionStreak, renderProfile as renderProfileView, renderRecord as renderRecordView } from "./records.js?v=28";
import { achievementMarkMarkup, evaluateNewBadgeUnlocks, formatBadgeUnlockDate, getBadgeById, getNextStreakBadgeHint, renderBadgeCollection } from "./badges.js?v=28";
import { BACKUP_MAX_BYTES, DataValidationError, normalizeBackup } from "./data-validation.js?v=28";
import { store } from "./store.js?v=28";
import { createTrainingController } from "./training.js?v=28";
import { createId, dateKey, escapeHtml, formatDate } from "./utils.js?v=28";

const appShell = document.querySelector(".app-shell");
const appSplash = document.querySelector("#app-splash");
const dataRecoveryBanner = document.querySelector("#data-recovery-banner");
const dataRecoveryMessage = document.querySelector("#data-recovery-message");
const screens = [...document.querySelectorAll(".screen")];
const navItems = [...document.querySelectorAll("[data-nav-target]")];
const rootScreens = new Set(["home", "record", "profile"]);
const bottomNav = document.querySelector(".bottom-nav");
const planList = document.querySelector("#plan-list");
const planForm = document.querySelector("#plan-form");
const exerciseEditorList = document.querySelector("#exercise-editor-list");
const formError = document.querySelector("#plan-form-error");
const scheduleForm = document.querySelector("#schedule-form");
const scheduleFormError = document.querySelector("#schedule-form-error");
const scheduleDateInput = document.querySelector("#schedule-date");
const scheduleDatePrimary = document.querySelector("#schedule-date-primary");
const scheduleDateSecondary = document.querySelector("#schedule-date-secondary");
const selectedDateList = document.querySelector("#selected-date-list");
const existingScheduleDateList = document.querySelector("#existing-schedule-date-list");
const detailScheduleDateList = document.querySelector("#detail-schedule-date-list");
const backupFileInput = document.querySelector("#backup-file-input");
const badgeUnlockDialog = document.querySelector("#badge-unlock-dialog");
const badgeDialogCoin = document.querySelector("#badge-dialog-coin");
const badgeDialogTitle = document.querySelector("#badge-dialog-title");
const badgeDialogCondition = document.querySelector("#badge-dialog-condition");
const badgeDialogStatus = document.querySelector("#badge-dialog-status");
const badgeDialogProgress = document.querySelector("#badge-dialog-progress");
const badgeDialogNext = document.querySelector("#badge-dialog-next");
const badgeCollection = document.querySelector(".badge-collection");
const badgeCollectionToggle = document.querySelector("#badge-collection-toggle");
const badgeDetailDialog = document.querySelector("#badge-detail-dialog");
const badgeDetailCoin = document.querySelector("#badge-detail-coin");
const badgeDetailTier = document.querySelector("#badge-detail-tier");
const badgeDetailTitle = document.querySelector("#badge-detail-title");
const badgeDetailCondition = document.querySelector("#badge-detail-condition");
const badgeDetailStatus = document.querySelector("#badge-detail-status");
const nicknameDialog = document.querySelector("#nickname-dialog");
const nicknameForm = document.querySelector("#nickname-form");
const nicknameInput = document.querySelector("#nickname-input");
const nicknameError = document.querySelector("#nickname-error");
let currentPlanId = store.getPlans()[0]?.id || null;
let currentScheduleId = null;
let editingPlanId = null;
let activeScreen = "home";
let editorSnapshot = "";
let restoringHistory = false;
let edgeGesture = null;
let skipNextLeaveGuard = false;
let restoringRootGuard = false;
let ignoreNextPopstate = false;
let rootTouchStart = null;
let selectedScheduleDates = new Set();
let pendingBadgeUnlocks = [];
let activeBadgeUnlockIndex = 0;

const training = createTrainingController({
  getPlan,
  getScheduleId: () => currentScheduleId,
  setScreen,
  onComplete: completeCurrentPlan
});

function dismissAppSplash() {
  appShell.setAttribute("aria-busy", "false");
  requestAnimationFrame(() => appSplash.classList.add("is-hiding"));
}

function renderDataRecoveryIssue(overrideMessage = "") {
  const issue = store.getLoadIssue();
  const message = overrideMessage || issue?.message || "";
  dataRecoveryBanner.hidden = !message;
  dataRecoveryMessage.textContent = message;
}

function getCompletions() {
  return store.getCompletions();
}

function calculateStreak() {
  return calculateCompletionStreak(getCompletions());
}

function renderRecord() {
  renderRecordView(getCompletions());
}

function renderProfile() {
  renderProfileView(getCompletions(), store.getProfile());
  renderBadgeCollection(store.getBadgeUnlocks());
}

function openNicknameEditor() {
  nicknameInput.value = store.getProfile().nickname;
  nicknameError.textContent = "";
  nicknameError.classList.remove("visible");
  nicknameDialog.showModal();
  nicknameInput.focus();
  nicknameInput.select();
}

function showNicknameError(message) {
  nicknameError.textContent = message;
  nicknameError.classList.add("visible");
}

function unlockEligibleBadges() {
  const newUnlocks = evaluateNewBadgeUnlocks(getCompletions(), store.getBadgeUnlocks());
  store.addBadgeUnlocks(newUnlocks);
  return newUnlocks;
}

function renderBadgeUnlockDialog() {
  const unlock = pendingBadgeUnlocks[activeBadgeUnlockIndex];
  const badge = getBadgeById(unlock?.badgeId);
  if (!unlock || !badge) return;
  badgeDialogCoin.innerHTML = achievementMarkMarkup(badge, unlock);
  badgeDialogTitle.textContent = badge.title;
  badgeDialogCondition.textContent = badge.condition;
  badgeDialogStatus.textContent = `解锁于 ${formatBadgeUnlockDate(unlock.unlockedAt)}`;
  badgeDialogProgress.textContent = pendingBadgeUnlocks.length > 1
    ? `${activeBadgeUnlockIndex + 1} / ${pendingBadgeUnlocks.length}`
    : "新成就";
  badgeDialogNext.textContent = activeBadgeUnlockIndex < pendingBadgeUnlocks.length - 1 ? "下一项" : "收下成就";
}

function showBadgeUnlockDialog(unlocks) {
  if (!unlocks.length) return;
  pendingBadgeUnlocks = unlocks;
  activeBadgeUnlockIndex = 0;
  renderBadgeUnlockDialog();
  badgeUnlockDialog.showModal();
}

function advanceBadgeUnlockDialog() {
  if (activeBadgeUnlockIndex < pendingBadgeUnlocks.length - 1) {
    activeBadgeUnlockIndex += 1;
    renderBadgeUnlockDialog();
    return;
  }
  badgeUnlockDialog.close();
  pendingBadgeUnlocks = [];
  activeBadgeUnlockIndex = 0;
}

function toggleBadgeCollection() {
  const expanded = !badgeCollection.classList.contains("is-expanded");
  badgeCollection.classList.toggle("is-expanded", expanded);
  badgeCollectionToggle.setAttribute("aria-expanded", String(expanded));
  badgeCollectionToggle.querySelector(".badge-collection-toggle-label").textContent = expanded
    ? "收起成就"
    : "展开全部成就";
}

function showBadgeDetailDialog(badgeId) {
  const badge = getBadgeById(badgeId);
  if (!badge) return;
  const unlock = store.getBadgeUnlocks().find((item) => item.badgeId === badge.id) || null;
  badgeDetailCoin.innerHTML = achievementMarkMarkup(badge, unlock);
  badgeDetailTier.textContent = badge.tier === 4 ? "大师级" : `第 ${badge.tier} 级`;
  badgeDetailTitle.textContent = badge.title;
  badgeDetailCondition.textContent = badge.condition;
  badgeDetailStatus.textContent = unlock
    ? `已解锁 · ${formatBadgeUnlockDate(unlock.unlockedAt)}`
    : "尚未解锁";
  badgeDetailStatus.classList.toggle("is-unlocked", Boolean(unlock));
  badgeDetailDialog.showModal();
}

function updateScheduleDateDisplay() {
  if (!scheduleDateInput.value) {
    scheduleDatePrimary.textContent = selectedScheduleDates.size ? "继续添加日期" : "选择日期";
    scheduleDateSecondary.textContent = selectedScheduleDates.size
      ? `已选择 ${selectedScheduleDates.size} 天`
      : "点击打开日期选择器";
    return;
  }

  const [year, month, day] = scheduleDateInput.value.split("-").map(Number);
  const weekday = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const date = new Date(year, month - 1, day);
  scheduleDatePrimary.textContent = `${month}月${day}日`;
  scheduleDateSecondary.textContent = `${year}年 · ${weekday[date.getDay()]}`;
}

function renderSelectedScheduleDates() {
  selectedDateList.innerHTML = [...selectedScheduleDates]
    .sort()
    .map((date) => `
      <button class="selected-date-chip" type="button" data-action="remove-schedule-date" data-date="${escapeHtml(date)}" aria-label="移除 ${escapeHtml(formatDate(date))}">
        ${escapeHtml(formatDate(date))} ×
      </button>`)
    .join("");
  updateScheduleDateDisplay();
}

function addSelectedScheduleDate() {
  if (!scheduleDateInput.value) return;
  selectedScheduleDates.add(scheduleDateInput.value);
  scheduleDateInput.value = "";
  renderSelectedScheduleDates();
  scheduleFormError.textContent = "";
  scheduleFormError.classList.remove("visible");
}

function getScheduledEntries(planId) {
  return store.getSchedules()
    .filter((schedule) => schedule.planId === planId && /^\d{4}-\d{2}-\d{2}$/.test(schedule.date))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function getScheduledDates(planId) {
  return [...new Set(getScheduledEntries(planId).map((schedule) => schedule.date))];
}

function formatScheduledDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return year === new Date().getFullYear()
    ? `${month}月${day}日`
    : `${year}年${month}月${day}日`;
}

function scheduledDateListMarkup(dates, emptyMessage = "") {
  if (!dates.length) {
    return emptyMessage ? `<p class="scheduled-date-empty">${escapeHtml(emptyMessage)}</p>` : "";
  }
  return dates.map((date) => `
    <time class="scheduled-date-chip" datetime="${escapeHtml(date)}">${escapeHtml(formatScheduledDate(date))}</time>`).join("");
}

function renderExistingScheduleDates() {
  const planId = scheduleForm.elements.planId.value;
  const schedules = getScheduledEntries(planId);
  existingScheduleDateList.innerHTML = schedules.length
    ? schedules.map((schedule) => `
      <button class="scheduled-date-chip scheduled-date-remove" type="button" data-action="delete-existing-schedule" data-schedule-id="${escapeHtml(schedule.id)}" aria-label="删除 ${escapeHtml(formatScheduledDate(schedule.date))} 的训练排期">
        <time datetime="${escapeHtml(schedule.date)}">${escapeHtml(formatScheduledDate(schedule.date))}</time>
        <span aria-hidden="true">×</span>
      </button>`).join("")
    : `<p class="scheduled-date-empty">暂未安排训练日期</p>`;
}

function getPlan(id = currentPlanId, useFallback = true) {
  return store.findPlan(id, useFallback);
}

function renderPlans() {
  const plans = store.getPlans();
  if (!plans.length) {
    planList.innerHTML = `
      <div class="empty-card card">
        <h3>还没有训练计划</h3>
        <p>点击右上角加号，创建你的第一个训练计划。</p>
      </div>`;
    return;
  }

  planList.innerHTML = plans.map((plan) => {
    const scheduledDates = getScheduledDates(plan.id);
    return `
      <article class="plan-item card">
        <button class="plan-item-main" type="button" data-action="open-plan" data-plan-id="${escapeHtml(plan.id)}">
          <span>
            <h3>${escapeHtml(plan.name)}</h3>
            <p class="plan-meta">${escapeHtml(plan.exercises.length)} 个动作 · ${escapeHtml(Number(plan.estimatedMinutes) || 0)} 分钟</p>
            ${scheduledDates.length ? `
              <span class="plan-schedule-summary">
                <span class="schedule-summary-label">已安排日期</span>
                <span class="scheduled-date-list">${scheduledDateListMarkup(scheduledDates)}</span>
              </span>` : ""}
            ${plan.goal ? `<p class="plan-goal">${escapeHtml(plan.goal)}</p>` : ""}
          </span>
          <span class="chevron" aria-hidden="true">›</span>
        </button>
        <div class="plan-actions">
          <button class="text-button" type="button" data-action="schedule-plan" data-plan-id="${escapeHtml(plan.id)}">安排日期</button>
          <button class="text-button" type="button" data-action="edit-plan" data-plan-id="${escapeHtml(plan.id)}">编辑</button>
          <button class="text-button danger" type="button" data-action="delete-plan" data-plan-id="${escapeHtml(plan.id)}">删除</button>
        </div>
      </article>`;
  }).join("");
}

function renderDetail(planId, scheduleId = null) {
  const plan = getPlan(planId);
  if (!plan) return false;

  currentPlanId = plan.id;
  currentScheduleId = scheduleId;
  document.querySelector("#detail-title").textContent = plan.name;
  document.querySelector("#detail-subtitle").textContent = `${plan.exercises.length} 个动作 · 预计 ${plan.estimatedMinutes} 分钟`;
  document.querySelector("#detail-card-title").textContent = `${plan.name}训练`;
  document.querySelector("#detail-goal").textContent = plan.goal ? `训练目标：${plan.goal}` : "按自己的节奏完成训练";
  document.querySelector("#detail-tag").textContent = plan.tag || "自定义计划";
  detailScheduleDateList.innerHTML = scheduledDateListMarkup(getScheduledDates(plan.id), "暂未安排训练日期");
  document.querySelector("#detail-exercises").innerHTML = `
    <h3>训练内容</h3>
    ${plan.exercises.map((exercise, index) => {
      const amount = exercise.mode === "duration"
        ? `${exercise.sets} 组 × ${exercise.durationSeconds} 秒`
        : `${exercise.sets} 组 × ${exercise.reps} 次`;
      const rest = Number(exercise.restSeconds) > 0 ? ` · 休息 ${exercise.restSeconds} 秒` : "";
      return `<div class="exercise-row"><span class="number-dot">${escapeHtml(index + 1)}</span><span>${escapeHtml(exercise.name)} · ${escapeHtml(amount)}${escapeHtml(rest)}</span></div>`;
    }).join("")}`;
  return true;
}

function getScheduleCompletionCount(scheduleId) {
  return getCompletions().filter((completion) => completion.scheduleId === scheduleId).length;
}

function renderHome() {
  const today = dateKey();
  const schedules = store.getSchedules();
  const todaySchedules = schedules.filter((schedule) => schedule.date === today);
  const list = document.querySelector("#today-plan-list");
  const streak = calculateStreak();
  document.querySelector("#home-streak").textContent = `连续打卡 ${streak} 天`;
  document.querySelector("#home-badge-hint").textContent = getNextStreakBadgeHint(streak, store.getBadgeUnlocks());

  if (!todaySchedules.length) {
    list.innerHTML = `
      <div class="empty-card card">
        <h3>今天还没有训练安排</h3>
        <p>进入训练计划，为今天安排一个计划。</p>
        <div class="action-stack">
          <button class="secondary-button" type="button" data-screen-target="plans">去安排训练</button>
        </div>
      </div>`;
    return;
  }

  list.innerHTML = todaySchedules.map((schedule, index) => {
    const plan = getPlan(schedule.planId, false);
    if (!plan) return "";
    const completionCount = getScheduleCompletionCount(schedule.id);
    const completed = completionCount > 0;
    const accent = index % 3 === 0 ? "var(--primary)" : index % 3 === 1 ? "var(--primary-2)" : "var(--mid)";
    return `
      <button class="workout-card ${completed ? "completed" : ""}" type="button" style="--accent: ${accent}" data-action="open-scheduled-plan" data-plan-id="${escapeHtml(plan.id)}" data-schedule-id="${escapeHtml(schedule.id)}">
        <span class="workout-icon"></span>
        <h3>${escapeHtml(plan.name)}</h3>
        <p>${escapeHtml(plan.exercises.length)} 个动作 · ${escapeHtml(plan.estimatedMinutes)} 分钟</p>
        <span class="tag">${completed ? `已完成 ${escapeHtml(completionCount)} 次` : escapeHtml(plan.tag || "今日计划")}</span>
        <span class="chevron">›</span>
      </button>`;
  }).join("");
}

function renderBackup() {
  const { plans, schedules, completions, badgeUnlocks } = store.snapshot();
  document.querySelector("#backup-plan-count").textContent = plans.length;
  document.querySelector("#backup-schedule-count").textContent = schedules.length;
  document.querySelector("#backup-completion-count").textContent = completions.length;
  document.querySelector("#backup-badge-count").textContent = badgeUnlocks.length;
}

function showBackupStatus(message) {
  const status = document.querySelector("#backup-status");
  status.textContent = message;
  status.classList.add("visible");
}

function exportBackup() {
  const { plans, schedules, completions, badgeUnlocks, settings } = store.snapshot();
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    plans,
    schedules,
    completions,
    badgeUnlocks,
    settings
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fitcheck-backup-${dateKey()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showBackupStatus("备份文件已导出。请把文件保存在安全的位置。");
}

async function importBackup(file) {
  if (file.size > BACKUP_MAX_BYTES) {
    showBackupStatus("导入失败：备份文件不能超过 5 MB。");
    backupFileInput.value = "";
    return;
  }

  try {
    const data = normalizeBackup(JSON.parse(await file.text()));
    if (!window.confirm("导入将覆盖当前设备上的全部 FitCheck 数据，确定继续吗？")) return;

    const importedUnlocks = evaluateNewBadgeUnlocks(data.completions, data.badgeUnlocks);
    store.restore({
      ...data,
      badgeUnlocks: [...data.badgeUnlocks, ...importedUnlocks]
    });
    const { plans, schedules, completions } = store.snapshot();
    currentPlanId = plans[0]?.id || null;
    currentScheduleId = null;
    renderPlans();
    renderDetail(currentPlanId);
    renderHome();
    renderRecord();
    renderProfile();
    renderBackup();
    renderDataRecoveryIssue();
    showBackupStatus(`恢复完成：${plans.length} 个计划、${schedules.length} 个日期安排、${completions.length} 条完成记录。`);
  } catch (error) {
    if (error instanceof SyntaxError) {
      showBackupStatus("导入失败：无法解析这个 JSON 文件。");
    } else if (error instanceof DataValidationError) {
      showBackupStatus(`导入失败：${error.message}。`);
    } else {
      showBackupStatus("导入失败：保存未完成，导入前的数据保持不变。请检查浏览器存储空间后重试。");
    }
  } finally {
    backupFileInput.value = "";
  }
}

async function setupPWA() {
  const status = document.querySelector("#pwa-status");
  if (!("serviceWorker" in navigator)) {
    status.textContent = "当前浏览器不支持 Service Worker，无法启用离线安装。";
    return;
  }
  if (!window.isSecureContext) {
    status.textContent = "PWA 安装需要 HTTPS 地址；本地开发可通过 localhost 测试。";
    return;
  }

  try {
    await navigator.serviceWorker.register("./service-worker.js");
    status.textContent = "PWA 离线服务已启用。部署到 HTTPS 后即可添加到手机主屏幕。";
  } catch {
    status.textContent = "PWA 离线服务注册失败，请通过本地服务器或 HTTPS 地址打开。";
  }
}

function emptyExercise() {
  return {
    id: createId("exercise"),
    name: "",
    sets: 3,
    mode: "reps",
    reps: 12,
    durationSeconds: null,
    restSeconds: 30,
    note: ""
  };
}

function exerciseEditorTemplate(exercise, index) {
  const value = exercise.mode === "duration" ? exercise.durationSeconds : exercise.reps;
  return `
    <section class="exercise-editor" data-exercise-id="${escapeHtml(exercise.id || createId("exercise"))}">
      <div class="exercise-editor-header">
        <strong>动作 ${escapeHtml(index + 1)}</strong>
        <button class="remove-exercise" type="button" data-action="remove-exercise">删除动作</button>
      </div>
      <div class="field">
        <label>动作名称</label>
        <input data-field="name" type="text" maxlength="40" value="${escapeHtml(exercise.name)}" placeholder="例如：哑铃卧推" required />
      </div>
      <div class="field-row">
        <div class="field">
          <label>组数</label>
          <input data-field="sets" type="number" min="1" max="99" value="${escapeHtml(Number(exercise.sets) || 1)}" required />
        </div>
        <div class="field">
          <label>计量方式</label>
          <select data-field="mode">
            <option value="reps" ${exercise.mode !== "duration" ? "selected" : ""}>次数</option>
            <option value="duration" ${exercise.mode === "duration" ? "selected" : ""}>时长</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label data-value-label>${exercise.mode === "duration" ? "每组秒数" : "每组次数"}</label>
          <input data-field="value" type="number" min="1" max="9999" value="${escapeHtml(Number(value) || 1)}" required />
        </div>
        <div class="field">
          <label>休息秒数</label>
          <input data-field="restSeconds" type="number" min="0" max="3600" value="${escapeHtml(Number(exercise.restSeconds) || 0)}" required />
        </div>
      </div>
      <div class="field">
        <label>动作备注</label>
        <input data-field="note" type="text" maxlength="100" value="${escapeHtml(exercise.note)}" placeholder="可选" />
      </div>
    </section>`;
}

function renderExerciseEditors(exercises) {
  exerciseEditorList.innerHTML = exercises.map(exerciseEditorTemplate).join("");
  updateExerciseNumbers();
}

function updateExerciseNumbers() {
  [...exerciseEditorList.querySelectorAll(".exercise-editor")].forEach((editor, index) => {
    editor.querySelector(".exercise-editor-header strong").textContent = `动作 ${index + 1}`;
  });
}

function openEditor(planId = null) {
  const plan = planId ? getPlan(planId) : null;
  editingPlanId = plan?.id || null;
  document.querySelector("#editor-title").textContent = plan ? "编辑训练计划" : "添加训练计划";
  planForm.elements.name.value = plan?.name || "";
  planForm.elements.estimatedMinutes.value = plan?.estimatedMinutes || 30;
  planForm.elements.tag.value = plan?.tag || "";
  planForm.elements.goal.value = plan?.goal || "";
  formError.textContent = "";
  formError.classList.remove("visible");
  renderExerciseEditors(plan?.exercises?.length ? plan.exercises : [emptyExercise()]);
  editorSnapshot = getEditorSnapshot();
  setScreen("plan-editor");
}

function openScheduleEditor(planId = null) {
  const plans = store.getPlans();
  if (!plans.length) return;
  const select = scheduleForm.elements.planId;
  select.innerHTML = plans.map((plan) => `
    <option value="${escapeHtml(plan.id)}" ${plan.id === planId ? "selected" : ""}>${escapeHtml(plan.name)}</option>`).join("");
  selectedScheduleDates = new Set([dateKey()]);
  scheduleForm.elements.date.value = "";
  renderSelectedScheduleDates();
  renderExistingScheduleDates();
  scheduleFormError.textContent = "";
  scheduleFormError.classList.remove("visible");
  editorSnapshot = getScheduleSnapshot();
  setScreen("schedule-editor");
}

function collectExercises() {
  return [...exerciseEditorList.querySelectorAll(".exercise-editor")].map((editor) => {
    const mode = editor.querySelector('[data-field="mode"]').value;
    const value = Number(editor.querySelector('[data-field="value"]').value);
    return {
      id: editor.dataset.exerciseId || createId("exercise"),
      name: editor.querySelector('[data-field="name"]').value.trim(),
      sets: Number(editor.querySelector('[data-field="sets"]').value),
      mode,
      reps: mode === "reps" ? value : null,
      durationSeconds: mode === "duration" ? value : null,
      restSeconds: Number(editor.querySelector('[data-field="restSeconds"]').value),
      note: editor.querySelector('[data-field="note"]').value.trim()
    };
  });
}

function getEditorSnapshot() {
  return JSON.stringify({
    name: planForm.elements.name.value,
    estimatedMinutes: planForm.elements.estimatedMinutes.value,
    tag: planForm.elements.tag.value,
    goal: planForm.elements.goal.value,
    exercises: collectExercises()
  });
}

function getScheduleSnapshot() {
  return JSON.stringify({
    planId: scheduleForm.elements.planId.value,
    dates: [...selectedScheduleDates].sort()
  });
}

function removeDateFromScheduleBaseline(date) {
  const baseline = JSON.parse(editorSnapshot || "{}");
  if (baseline.planId !== scheduleForm.elements.planId.value || !Array.isArray(baseline.dates)) return;
  baseline.dates = baseline.dates.filter((item) => item !== date);
  editorSnapshot = JSON.stringify(baseline);
}

function hasUnsavedChanges() {
  if (activeScreen === "plan-editor") return getEditorSnapshot() !== editorSnapshot;
  if (activeScreen === "schedule-editor") return getScheduleSnapshot() !== editorSnapshot;
  return false;
}

function canLeaveCurrentScreen() {
  if (hasUnsavedChanges()) return window.confirm("当前修改尚未保存，确定离开吗？");
  if (activeScreen === "checkin" && training.hasActiveSession()) {
    return window.confirm("训练仍在进行，确定退出并丢失当前进度吗？");
  }
  return true;
}

function routeState(name) {
  return { fitcheck: true, screen: name, planId: currentPlanId, scheduleId: currentScheduleId, editingPlanId };
}

function restoreRoute(state) {
  if (!state?.fitcheck) {
    setScreen("home", { historyMode: "replace" });
    return;
  }
  restoringHistory = true;
  if (state.screen === "checkin" && !training.hasActiveSession()) {
    const fallbackScreen = renderDetail(state.planId, state.scheduleId) ? "detail" : "home";
    setScreen(fallbackScreen, { historyMode: "none" });
    history.replaceState(routeState(fallbackScreen), "", `#${fallbackScreen}`);
    restoringHistory = false;
    return;
  }
  if (state.screen === "detail") renderDetail(state.planId, state.scheduleId);
  if (state.screen === "plan-editor") {
    openEditor(state.editingPlanId);
    restoringHistory = false;
    return;
  }
  if (state.screen === "schedule-editor") {
    openScheduleEditor(state.planId);
    restoringHistory = false;
    return;
  }
  currentPlanId = state.planId || currentPlanId;
  currentScheduleId = state.scheduleId || null;
  setScreen(state.screen, { historyMode: "none" });
  restoringHistory = false;
}

function navigateBack() {
  if (!canLeaveCurrentScreen()) return;
  if (activeScreen === "checkin") training.stop();
  skipNextLeaveGuard = true;
  history.back();
}

function showFormError(message) {
  formError.textContent = message;
  formError.classList.add("visible");
  formError.scrollIntoView({ block: "center", behavior: "smooth" });
}

function showScheduleError(message) {
  scheduleFormError.textContent = message;
  scheduleFormError.classList.add("visible");
}

function completeCurrentPlan({ plan, scheduleId }) {
  const today = dateKey();
  store.addCompletion({
    id: createId("completion"),
    planId: plan.id,
    scheduleId,
    planName: plan.name,
    date: today,
    completedAt: new Date().toISOString(),
    minutes: Number(plan.estimatedMinutes) || 0
  });

  const completions = getCompletions();
  const newBadgeUnlocks = unlockEligibleBadges();
  const streak = calculateStreak();
  const todayCount = completions.filter((completion) => completion.planId === plan.id && completion.date === today).length;
  document.querySelector("#success-message").textContent = `${plan.name}已完成${todayCount > 1 ? `，今天第 ${todayCount} 次` : ""}，当前连续打卡 ${streak} 天。`;
  renderHome();
  renderRecord();
  renderProfile();
  setScreen("success", { historyMode: "replace" });
  showBadgeUnlockDialog(newBadgeUnlocks);
}

function setScreen(name, { historyMode = "auto" } = {}) {
  if (!screens.some((screen) => screen.dataset.screen === name)) name = "home";
  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === name);
  });

  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.navTarget === name);
  });

  bottomNav.classList.toggle("hidden", !rootScreens.has(name));
  if (name === "plans") renderPlans();
  if (name === "home") renderHome();
  if (name === "record") renderRecord();
  if (name === "profile") renderProfile();
  if (name === "backup") renderBackup();
  activeScreen = name;
  document.querySelector(`.screen[data-screen="${name}"]`)?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  if (!restoringHistory && historyMode !== "none") {
    const shouldReplace = historyMode === "replace" || (historyMode === "auto" && rootScreens.has(name));
    const method = shouldReplace ? "replaceState" : "pushState";
    history[method](routeState(name), "", `#${name}`);
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-screen-target], [data-nav-target]");
  if (!target) return;

  const action = target.dataset.action;
  const planId = target.dataset.planId;

  if (!rootScreens.has(activeScreen) && target.matches(".topbar [data-screen-target], .editor-actions [data-screen-target]")) {
    navigateBack();
    return;
  }

  if (action === "new-plan") {
    openEditor();
    return;
  }

  if (action === "edit-nickname") {
    openNicknameEditor();
    return;
  }

  if (action === "close-nickname-editor") {
    nicknameDialog.close();
    return;
  }

  if (action === "add-exercise") {
    exerciseEditorList.insertAdjacentHTML("beforeend", exerciseEditorTemplate(emptyExercise(), exerciseEditorList.children.length));
    updateExerciseNumbers();
    return;
  }

  if (action === "remove-schedule-date") {
    selectedScheduleDates.delete(target.dataset.date);
    renderSelectedScheduleDates();
    return;
  }

  if (action === "delete-existing-schedule") {
    const schedule = store.getSchedules().find((item) => item.id === target.dataset.scheduleId);
    if (!schedule) return;
    const plan = getPlan(schedule.planId, false);
    const label = `${formatScheduledDate(schedule.date)}${plan ? `的“${plan.name}”` : ""}训练排期`;
    if (!window.confirm(`确定删除${label}吗？既有训练完成记录不会受到影响。`)) return;
    if (!store.deleteSchedule(schedule.id)) return;
    selectedScheduleDates.delete(schedule.date);
    removeDateFromScheduleBaseline(schedule.date);
    if (currentScheduleId === schedule.id) currentScheduleId = null;
    renderSelectedScheduleDates();
    renderExistingScheduleDates();
    renderPlans();
    renderHome();
    if (currentPlanId === schedule.planId) renderDetail(currentPlanId, currentScheduleId);
    return;
  }

  if (action === "remove-exercise") {
    if (exerciseEditorList.children.length === 1) {
      showFormError("一个训练计划至少需要保留一个动作。");
      return;
    }
    target.closest(".exercise-editor").remove();
    updateExerciseNumbers();
    return;
  }

  if (action === "open-plan") {
    if (renderDetail(planId)) setScreen("detail");
    return;
  }

  if (action === "open-scheduled-plan") {
    if (renderDetail(planId, target.dataset.scheduleId)) setScreen("detail");
    return;
  }

  if (action === "schedule-plan") {
    openScheduleEditor(planId);
    return;
  }

  if (action === "edit-plan") {
    openEditor(planId);
    return;
  }

  if (action === "edit-current-plan") {
    openEditor(currentPlanId);
    return;
  }

  if (action === "start-current-plan") {
    training.start();
    return;
  }

  if (action === "finish-training-step") {
    training.finishStep();
    return;
  }

  if (action === "toggle-training-pause") {
    training.togglePause();
    return;
  }

  if (action === "toggle-badge-collection") {
    toggleBadgeCollection();
    return;
  }

  if (action === "open-badge-detail") {
    showBadgeDetailDialog(target.dataset.badgeId);
    return;
  }

  if (action === "close-badge-detail") {
    badgeDetailDialog.close();
    return;
  }

  if (action === "advance-badge-dialog") {
    advanceBadgeUnlockDialog();
    return;
  }

  if (action === "export-backup") {
    exportBackup();
    return;
  }

  if (action === "exit-training") {
    navigateBack();
    return;
  }

  if (action === "exit-training-to-detail") {
    navigateBack();
    return;
  }

  if (action === "delete-plan") {
    const plan = getPlan(planId);
    if (!plan || !window.confirm(`确定删除“${plan.name}”吗？`)) return;
    store.deletePlan(planId);
    if (currentPlanId === planId) currentPlanId = store.getPlans()[0]?.id || null;
    renderPlans();
    renderHome();
    return;
  }

  const next = target.dataset.screenTarget || target.dataset.navTarget;
  if (next === "detail") renderDetail(currentPlanId, currentScheduleId);
  setScreen(next);
});

exerciseEditorList.addEventListener("change", (event) => {
  if (event.target.dataset.field !== "mode") return;
  const editor = event.target.closest(".exercise-editor");
  editor.querySelector("[data-value-label]").textContent = event.target.value === "duration" ? "每组秒数" : "每组次数";
});

planForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = planForm.elements.name.value.trim();
  const estimatedMinutes = Number(planForm.elements.estimatedMinutes.value);
  const exercises = collectExercises();

  if (!name) return showFormError("请填写训练计划名称。");
  if (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 1 || estimatedMinutes > 600) {
    return showFormError("预计分钟数需要在 1 到 600 之间。");
  }
  if (!exercises.length || exercises.some((exercise) => !exercise.name)) {
    return showFormError("请填写每个动作的名称。");
  }
  if (exercises.some((exercise) => !Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 99)) {
    return showFormError("动作组数需要在 1 到 99 之间。");
  }
  if (exercises.some((exercise) => {
    const value = exercise.mode === "duration" ? exercise.durationSeconds : exercise.reps;
    return !Number.isFinite(value) || value < 1 || value > 9999;
  })) {
    return showFormError("每组次数或秒数需要在 1 到 9999 之间。");
  }
  if (exercises.some((exercise) => !Number.isFinite(exercise.restSeconds) || exercise.restSeconds < 0 || exercise.restSeconds > 3600)) {
    return showFormError("休息秒数需要在 0 到 3600 之间。");
  }

  const now = new Date().toISOString();
  const existing = getPlan(editingPlanId, false);
  const savedPlan = {
    id: existing?.id || createId("plan"),
    name,
    goal: planForm.elements.goal.value.trim(),
    estimatedMinutes,
    tag: planForm.elements.tag.value.trim(),
    exercises,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  store.savePlan(savedPlan);
  currentPlanId = savedPlan.id;
  editorSnapshot = getEditorSnapshot();
  renderPlans();
  skipNextLeaveGuard = true;
  history.back();
});

scheduleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const planId = scheduleForm.elements.planId.value;
  const dates = [...selectedScheduleDates].sort();
  if (!getPlan(planId, false)) return showScheduleError("请选择一个有效的训练计划。");
  if (!dates.length) return showScheduleError("请至少选择一个训练日期。");
  const schedules = store.getSchedules();
  const existingDates = new Set(
    schedules
      .filter((schedule) => schedule.planId === planId)
      .map((schedule) => schedule.date)
  );
  const newDates = dates.filter((date) => !existingDates.has(date));
  if (!newDates.length) return showScheduleError("这个计划已安排在全部所选日期，无需重复添加。");
  const createdAt = new Date().toISOString();
  const newSchedules = newDates.map((date) => ({
    id: createId("schedule"),
    planId,
    date,
    createdAt
  }));
  store.addSchedules(newSchedules);
  editorSnapshot = getScheduleSnapshot();
  renderPlans();
  renderHome();
  if (newDates.includes(dateKey())) {
    setScreen("home", { historyMode: "replace" });
  } else {
    skipNextLeaveGuard = true;
    history.back();
  }
});

scheduleDateInput.addEventListener("input", updateScheduleDateDisplay);
scheduleDateInput.addEventListener("change", addSelectedScheduleDate);
scheduleForm.elements.planId.addEventListener("change", renderExistingScheduleDates);

backupFileInput.addEventListener("change", () => {
  const [file] = backupFileInput.files;
  if (file) importBackup(file);
});

nicknameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    showNicknameError("昵称不能为空。");
    return;
  }
  if (nickname.length > 12) {
    showNicknameError("昵称最多输入 12 个字符。");
    return;
  }
  store.updateNickname(nickname);
  renderProfile();
  nicknameDialog.close();
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!rootScreens.has(activeScreen)) navigateBack();
});

window.addEventListener("popstate", (event) => {
  if (ignoreNextPopstate) {
    ignoreNextPopstate = false;
    return;
  }
  if (restoringRootGuard) {
    restoringRootGuard = false;
    return;
  }
  if (rootScreens.has(activeScreen)) {
    restoringRootGuard = true;
    history.forward();
    return;
  }
  if (skipNextLeaveGuard) {
    skipNextLeaveGuard = false;
  } else if (!canLeaveCurrentScreen()) {
    ignoreNextPopstate = true;
    history.go(1);
    return;
  }
  if (activeScreen === "checkin") training.stop();
  restoreRoute(event.state);
});

document.addEventListener("touchstart", (event) => {
  if (event.touches.length !== 1) return;
  if (rootScreens.has(activeScreen)) {
    rootTouchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    return;
  }
  if (event.touches[0].clientX > 24) return;
  edgeGesture = { x: event.touches[0].clientX, y: event.touches[0].clientY, time: performance.now() };
}, { passive: true });

document.addEventListener("touchmove", (event) => {
  if (!rootTouchStart || !rootScreens.has(activeScreen) || event.touches.length !== 1) return;
  const dx = Math.abs(event.touches[0].clientX - rootTouchStart.x);
  const dy = Math.abs(event.touches[0].clientY - rootTouchStart.y);
  if (dx > 8 && dx > dy) event.preventDefault();
}, { passive: false });

document.addEventListener("touchend", (event) => {
  if (!edgeGesture || !event.changedTouches.length) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - edgeGesture.x;
  const dy = Math.abs(touch.clientY - edgeGesture.y);
  const elapsed = performance.now() - edgeGesture.time;
  edgeGesture = null;
  if (dx >= 72 && dy <= 56 && dx > dy * 1.35 && elapsed <= 650) navigateBack();
}, { passive: true });

document.addEventListener("touchcancel", () => {
  edgeGesture = null;
  rootTouchStart = null;
}, { passive: true });

document.addEventListener("touchend", () => { rootTouchStart = null; }, { passive: true });

document.addEventListener("visibilitychange", () => {
  training.syncVisibleTimer();
});

badgeUnlockDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  advanceBadgeUnlockDialog();
});

badgeDetailDialog.addEventListener("close", () => {
  badgeDetailCoin.replaceChildren();
});

function initializeApp() {
  let startupIssue = "";
  try {
    unlockEligibleBadges();
    renderPlans();
    renderDetail(currentPlanId);
    renderHome();
    renderRecord();
    renderProfile();
    renderBackup();
    const initialRoute = history.state?.fitcheck ? history.state : routeState("home");
    history.replaceState({ fitcheckGuard: true }, "", location.href);
    history.pushState(initialRoute, "", `#${initialRoute.screen}`);
    restoreRoute(initialRoute);
  } catch {
    startupIssue = "本地数据未能完整载入。请前往备份与恢复页面导入有效备份。";
  } finally {
    renderDataRecoveryIssue(startupIssue);
    setupPWA();
    dismissAppSplash();
  }
}

initializeApp();
