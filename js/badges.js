import { escapeHtml, shiftDate } from "./utils.js?v=31";

const badgeDefinitions = [
  { id: "streak-3", category: "streak", tier: 1, threshold: 3, title: "初燃", condition: "连续训练 3 天", unit: "天" },
  { id: "streak-7", category: "streak", tier: 2, threshold: 7, title: "成焰", condition: "连续训练 7 天", unit: "天" },
  { id: "streak-14", category: "streak", tier: 3, threshold: 14, title: "恒火", condition: "连续训练 14 天", unit: "天" },
  { id: "streak-30", category: "streak", tier: 4, threshold: 30, title: "不熄", condition: "连续训练 30 天", unit: "天" },
  { id: "days-1", category: "days", tier: 1, threshold: 1, title: "落印", condition: "累计训练 1 天", unit: "天" },
  { id: "days-7", category: "days", tier: 2, threshold: 7, title: "成章", condition: "累计训练 7 天", unit: "天" },
  { id: "days-30", category: "days", tier: 3, threshold: 30, title: "成册", condition: "累计训练 30 天", unit: "天" },
  { id: "days-100", category: "days", tier: 4, threshold: 100, title: "长卷", condition: "累计训练 100 天", unit: "天" },
  { id: "completions-10", category: "completions", tier: 1, threshold: 10, title: "开锋", condition: "完成训练 10 次", unit: "次" },
  { id: "completions-50", category: "completions", tier: 2, threshold: 50, title: "砺锋", condition: "完成训练 50 次", unit: "次" },
  { id: "completions-100", category: "completions", tier: 3, threshold: 100, title: "百炼", condition: "完成训练 100 次", unit: "次" },
  { id: "minutes-60", category: "minutes", tier: 1, threshold: 60, title: "涓流", condition: "累计训练 60 分钟", unit: "分" },
  { id: "minutes-300", category: "minutes", tier: 2, threshold: 300, title: "汇流", condition: "累计训练 300 分钟", unit: "分" },
  { id: "minutes-1000", category: "minutes", tier: 3, threshold: 1000, title: "长河", condition: "累计训练 1000 分钟", unit: "分" }
];

export const BADGE_DEFINITIONS = Object.freeze(badgeDefinitions.map((badge) => Object.freeze(badge)));

function calculateLongestStreak(completions) {
  const dates = [...new Set(
    completions
      .map((completion) => completion.date)
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
  )].sort();
  let longest = 0;
  let current = 0;
  let previous = null;

  dates.forEach((date) => {
    current = previous && shiftDate(previous, 1) === date ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  });
  return longest;
}

function calculateRequiredMetrics(completions, categories) {
  const metrics = {};
  if (categories.has("streak")) metrics.streak = calculateLongestStreak(completions);
  if (categories.has("days")) metrics.days = new Set(completions.map((completion) => completion.date)).size;
  if (categories.has("completions")) metrics.completions = completions.length;
  if (categories.has("minutes")) {
    metrics.minutes = completions.reduce((total, completion) => {
      const minutes = Number(completion.minutes);
      return total + (Number.isFinite(minutes) && minutes > 0 ? minutes : 0);
    }, 0);
  }
  return metrics;
}

export function evaluateNewBadgeUnlocks(completions, unlocks, unlockedAt = new Date().toISOString()) {
  const unlockedIds = new Set(unlocks.map((unlock) => unlock.badgeId));
  const lockedBadges = BADGE_DEFINITIONS.filter((badge) => !unlockedIds.has(badge.id));
  if (!lockedBadges.length) return [];

  const requiredCategories = new Set(lockedBadges.map((badge) => badge.category));
  const metrics = calculateRequiredMetrics(completions, requiredCategories);
  return lockedBadges
    .filter((badge) => metrics[badge.category] >= badge.threshold)
    .map((badge) => ({ badgeId: badge.id, unlockedAt }));
}

export function getBadgeById(badgeId) {
  return BADGE_DEFINITIONS.find((badge) => badge.id === badgeId) || null;
}

export function getNextStreakBadgeHint(currentStreak, unlocks) {
  const unlockedIds = new Set(unlocks.map((unlock) => unlock.badgeId));
  const next = BADGE_DEFINITIONS.find((badge) => badge.category === "streak" && !unlockedIds.has(badge.id));
  if (!next) return "连续训练成就已全部解锁";
  const remaining = Math.max(1, next.threshold - currentStreak);
  return `再连续训练 ${remaining} 天解锁下一项成就`;
}

function tierLabel(tier) {
  return ["", "第一级", "第二级", "第三级", "大师级"][tier] || `第 ${tier} 级`;
}

export function formatBadgeUnlockDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日期未知";
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join(".");
}

function achievementIconMarkup(category) {
  if (category === "streak") {
    return `<svg class="achievement-icon achievement-icon-flame" viewBox="0 0 76 76" aria-hidden="true">
      <path class="achievement-icon-outline achievement-icon-core" d="M41 7c2 12-5 17-5 26 0 4 2 7 5 9-1-8 4-13 10-18 7 8 12 17 12 27 0 15-11 24-25 24S13 66 13 51c0-13 8-22 18-32 0 10 3 15 7 18-1-10 7-18 3-30Z"/>
      <path class="achievement-icon-layer" d="M38 68c-8 0-14-6-14-14 0-7 4-12 10-18 0 7 3 10 7 13-1-7 3-12 7-17 4 6 7 12 7 19 0 10-7 17-17 17Z"/>
      <path class="achievement-icon-detail" d="M38 65c-4 0-7-3-7-8 0-4 3-7 6-11 0 4 2 6 4 8 0-4 2-7 4-10 2 4 3 7 3 11 0 6-4 10-10 10Z"/>
    </svg>`;
  }

  if (category === "days") {
    return `<svg class="achievement-icon achievement-icon-calendar" viewBox="0 0 76 76" aria-hidden="true">
      <rect class="achievement-icon-outline achievement-icon-core" x="11" y="16" width="54" height="49" rx="11"/>
      <path class="achievement-icon-layer" d="M16 31h44v25a5 5 0 0 1-5 5H21a5 5 0 0 1-5-5V31Z"/>
      <path class="achievement-icon-outline" d="M25 10v13M51 10v13"/>
      <path class="achievement-icon-detail-stroke" d="M25 10v13M51 10v13"/>
      <rect class="achievement-icon-detail" x="23" y="39" width="9" height="8" rx="2"/>
      <rect class="achievement-icon-detail" x="36" y="39" width="9" height="8" rx="2"/>
      <rect class="achievement-icon-detail" x="49" y="39" width="9" height="8" rx="2"/>
      <rect class="achievement-icon-detail" x="23" y="50" width="9" height="7" rx="2"/>
      <rect class="achievement-icon-detail" x="36" y="50" width="9" height="7" rx="2"/>
    </svg>`;
  }

  if (category === "completions") {
    return `<svg class="achievement-icon achievement-icon-trophy" viewBox="0 0 76 76" aria-hidden="true">
      <path class="achievement-icon-outline achievement-icon-core" d="M20 13h36v16c0 15-7 25-18 25S20 44 20 29V13Z"/>
      <path class="achievement-icon-outline" d="M20 22H10v7c0 10 6 16 16 16M56 22h10v7c0 10-6 16-16 16"/>
      <path class="achievement-icon-detail-stroke" d="M20 22H10v7c0 10 6 16 16 16M56 22h10v7c0 10-6 16-16 16"/>
      <path class="achievement-icon-outline" d="M38 54v10"/>
      <path class="achievement-icon-detail-stroke" d="M38 54v10"/>
      <rect class="achievement-icon-outline achievement-icon-core" x="24" y="62" width="28" height="8" rx="4"/>
      <path class="achievement-icon-layer" d="M27 20h22v9c0 11-4 18-11 18s-11-7-11-18v-9Z"/>
    </svg>`;
  }

  return `<svg class="achievement-icon achievement-icon-stopwatch" viewBox="0 0 76 76" aria-hidden="true">
    <path class="achievement-icon-outline" d="M31 9h14M38 9v9M54 18l7 7"/>
    <path class="achievement-icon-detail-stroke" d="M31 9h14M38 9v9M54 18l7 7"/>
    <circle class="achievement-icon-outline achievement-icon-core" cx="38" cy="44" r="25"/>
    <circle class="achievement-icon-layer" cx="38" cy="44" r="17"/>
    <path class="achievement-icon-detail-stroke" d="M38 31v14l10 6"/>
    <circle class="achievement-icon-detail" cx="38" cy="44" r="4"/>
  </svg>`;
}

export function achievementMarkMarkup(badge, unlock, { interactive = false, action = "open-badge-detail" } = {}) {
  const tag = interactive ? "button" : "div";
  const badgeTierLabel = tierLabel(badge.tier);
  const unlockedDate = unlock ? formatBadgeUnlockDate(unlock.unlockedAt) : "尚未解锁";
  const unlockLabel = unlock ? `已解锁，解锁日期 ${unlockedDate}` : "尚未解锁";
  const label = `${badge.title}成就，${badge.condition}，${badgeTierLabel}，${unlockLabel}`;
  const attributes = interactive
    ? `type="button" data-action="${escapeHtml(action)}" data-badge-id="${escapeHtml(badge.id)}" aria-label="查看${escapeHtml(label)}详情"`
    : `role="img" aria-label="${escapeHtml(label)}"`;
  return `<${tag} class="achievement-mark achievement-tier-${escapeHtml(badge.tier)} achievement-category-${escapeHtml(badge.category)}${unlock ? "" : " is-locked"}" ${attributes}>
    <span class="achievement-mark-glow" aria-hidden="true"></span>
    ${achievementIconMarkup(badge.category)}
    <span class="achievement-milestone" aria-hidden="true"><strong>${escapeHtml(badge.threshold)}</strong><small>${escapeHtml(badge.unit)}</small></span>
  </${tag}>`;
}

export function getFeaturedBadgeIds(unlocks, limit = 3) {
  const definitionOrder = new Map(BADGE_DEFINITIONS.map((badge, index) => [badge.id, index]));
  const unlockMap = new Map(unlocks.map((unlock) => [unlock.badgeId, unlock]));
  const unlockedBadges = BADGE_DEFINITIONS
    .filter((badge) => unlockMap.has(badge.id))
    .sort((left, right) => {
      const tierDifference = right.tier - left.tier;
      if (tierDifference) return tierDifference;
      const rightTime = Date.parse(unlockMap.get(right.id).unlockedAt) || 0;
      const leftTime = Date.parse(unlockMap.get(left.id).unlockedAt) || 0;
      return rightTime - leftTime || definitionOrder.get(left.id) - definitionOrder.get(right.id);
    });
  const lockedBadges = BADGE_DEFINITIONS
    .filter((badge) => !unlockMap.has(badge.id))
    .sort((left, right) => right.tier - left.tier || definitionOrder.get(left.id) - definitionOrder.get(right.id));

  return [...unlockedBadges, ...lockedBadges]
    .slice(0, Math.max(0, limit))
    .map((badge) => badge.id);
}

export function renderBadgeCollection(unlocks) {
  const grid = document.querySelector("#badge-collection-grid");
  const count = document.querySelector("#badge-unlock-count");
  if (!grid || !count) return;
  const unlockMap = new Map(unlocks.map((unlock) => [unlock.badgeId, unlock]));
  const featuredRanks = new Map(getFeaturedBadgeIds(unlocks).map((badgeId, index) => [badgeId, index + 1]));
  count.textContent = `${unlockMap.size} / ${BADGE_DEFINITIONS.length}`;
  grid.innerHTML = BADGE_DEFINITIONS.map((badge) => {
    const unlock = unlockMap.get(badge.id);
    const featuredRank = featuredRanks.get(badge.id);
    return `<article class="badge-collection-item${unlock ? " is-unlocked" : " is-locked"}${featuredRank ? ` is-featured is-featured-rank-${escapeHtml(featuredRank)}` : ""}">
      ${achievementMarkMarkup(badge, unlock, { interactive: true })}
      <strong>${escapeHtml(badge.title)}</strong>
      <span>${unlock ? `解锁于 ${escapeHtml(formatBadgeUnlockDate(unlock.unlockedAt))}` : escapeHtml(badge.condition)}</span>
    </article>`;
  }).join("");
}
