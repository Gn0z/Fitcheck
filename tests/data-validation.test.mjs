import test from "node:test";
import assert from "node:assert/strict";

import {
  BACKUP_MAX_BYTES,
  DataValidationError,
  normalizeBackup
} from "../js/data-validation.js";

function validBackup() {
  return {
    version: 1,
    exportedAt: "2026-07-23T08:00:00.000Z",
    plans: [
      {
        id: "plan-1",
        name: "基础训练",
        goal: "稳定完成",
        estimatedMinutes: 20,
        tag: "基础",
        createdAt: "2026-07-20T08:00:00.000Z",
        updatedAt: "2026-07-20T08:00:00.000Z",
        exercises: [
          {
            id: "exercise-1",
            name: "深蹲",
            sets: 3,
            mode: "reps",
            reps: 12,
            durationSeconds: null,
            restSeconds: 30,
            note: ""
          }
        ]
      }
    ],
    schedules: [
      {
        id: "schedule-1",
        planId: "plan-1",
        date: "2026-07-23",
        createdAt: "2026-07-22T08:00:00.000Z"
      }
    ],
    completions: [
      {
        id: "completion-1",
        planId: "plan-deleted",
        scheduleId: null,
        planName: "已删除计划",
        date: "2026-07-21",
        completedAt: "2026-07-21T08:00:00.000Z",
        minutes: 15
      }
    ],
    badgeUnlocks: [
      {
        badgeId: "days-1",
        unlockedAt: "2026-07-21T08:00:00.000Z"
      }
    ],
    settings: { nickname: "训练者" }
  };
}

function expectInvalid(mutator, code) {
  const backup = validBackup();
  mutator(backup);
  assert.throws(
    () => normalizeBackup(backup),
    (error) => error instanceof DataValidationError && (!code || error.code === code)
  );
}

test("normalizes a complete v1 backup", () => {
  const normalized = normalizeBackup(validBackup());
  assert.equal(normalized.plans[0].name, "基础训练");
  assert.equal(normalized.settings.nickname, "训练者");
});

test("accepts old v1 backups without badge and nickname fields", () => {
  const backup = validBackup();
  delete backup.badgeUnlocks;
  delete backup.settings;
  const normalized = normalizeBackup(backup);
  assert.deepEqual(normalized.badgeUnlocks, []);
  assert.deepEqual(normalized.settings, { nickname: "训练者" });
});

test("rejects missing required fields and wrong field types", () => {
  expectInvalid((backup) => delete backup.plans[0].createdAt);
  expectInvalid((backup) => { backup.plans[0].estimatedMinutes = "20"; });
});

test("rejects invalid numbers, dates and exercise modes", () => {
  expectInvalid((backup) => { backup.plans[0].exercises[0].sets = 0; });
  expectInvalid((backup) => { backup.schedules[0].date = "2026-02-30"; });
  expectInvalid((backup) => { backup.plans[0].exercises[0].mode = "weight"; });
});

test("rejects duplicate IDs, including exercise IDs across plans", () => {
  expectInvalid((backup) => {
    backup.plans.push(structuredClone(backup.plans[0]));
  }, "duplicate_id");
  expectInvalid((backup) => {
    const second = structuredClone(backup.plans[0]);
    second.id = "plan-2";
    backup.plans.push(second);
  }, "duplicate_id");
});

test("rejects schedules that reference a missing plan", () => {
  expectInvalid((backup) => {
    backup.schedules[0].planId = "plan-missing";
  }, "invalid_reference");
});

test("rejects malicious HTML in every user-facing text field", () => {
  for (const mutate of [
    (backup) => { backup.plans[0].name = '<img src=x onerror="alert(1)">'; },
    (backup) => { backup.plans[0].exercises[0].note = "<script>alert(1)</script>"; },
    (backup) => { backup.completions[0].planName = "<b>伪造计划</b>"; },
    (backup) => { backup.settings.nickname = "<svg onload=alert(1)>"; }
  ]) {
    expectInvalid(mutate, "unsafe_html");
  }
});

test("rejects collections and files above their limits", () => {
  expectInvalid((backup) => {
    backup.plans = Array.from({ length: 101 }, () => backup.plans[0]);
  }, "limit_exceeded");
  assert.equal(BACKUP_MAX_BYTES, 5 * 1024 * 1024);
});
