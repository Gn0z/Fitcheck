import { dateKey, escapeHtml, formatDate, shiftDate } from "./utils.js";

export function calculateStreak(completions) {
  const completedDates = new Set(completions.map((completion) => completion.date));
  if (!completedDates.size) return 0;

  const today = dateKey();
  let cursor = completedDates.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

function getHeatmapLevel(minutes) {
  if (minutes <= 0) return 0;
  if (minutes <= 8) return 1;
  if (minutes <= 16) return 2;
  if (minutes <= 24) return 3;
  return 4;
}

function renderTrainingHeatmap(completions) {
  const heatmap = document.querySelector("#training-heatmap");
  const today = dateKey();
  const [year, month, day] = today.split("-").map(Number);
  const daysFromMonday = (new Date(year, month - 1, day).getDay() + 6) % 7;
  const startDate = shiftDate(today, -(13 * 7 + daysFromMonday));
  const minutesByDate = completions.reduce((result, completion) => {
    result[completion.date] = (result[completion.date] || 0) + Number(completion.minutes || 0);
    return result;
  }, {});

  heatmap.innerHTML = Array.from({ length: 14 * 7 }, (_, index) => {
    const date = shiftDate(startDate, index);
    const isFuture = date > today;
    const level = isFuture ? 0 : getHeatmapLevel(minutesByDate[date] || 0);
    return `<i class="heatmap-cell level-${level}${isFuture ? " future" : ""}" aria-hidden="true"></i>`;
  }).join("");
}

export function renderRecord(completions) {
  document.querySelector("#record-streak").textContent = `${calculateStreak(completions)} 天`;
  renderTrainingHeatmap(completions);
  const list = document.querySelector("#record-list");
  const sorted = [...completions].sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  if (!sorted.length) {
    list.innerHTML = `<div class="record-empty">还没有打卡记录，完成一次训练后会显示在这里。</div>`;
    return;
  }

  list.innerHTML = sorted.map((completion) => `
    <div class="record-row">
      <i class="record-status"></i>
      <span class="record-name">${escapeHtml(completion.planName)} · ${completion.minutes} 分钟</span>
      <span class="record-date">${formatDate(completion.date)}</span>
    </div>`).join("");
}

export function renderProfile(completions) {
  const uniqueDays = new Set(completions.map((completion) => completion.date)).size;
  const totalMinutes = completions.reduce((sum, completion) => sum + Number(completion.minutes || 0), 0);
  document.querySelector("#profile-summary").textContent = `已打卡 ${uniqueDays} 天 · 数据保存在本机`;
  document.querySelector("#stat-days").textContent = `${uniqueDays}天`;
  document.querySelector("#stat-minutes").textContent = `${totalMinutes}分`;
  document.querySelector("#stat-completions").textContent = `${completions.length}个`;
}
