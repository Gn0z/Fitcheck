import test from "node:test";
import assert from "node:assert/strict";

import { prepareScheduleChanges } from "../js/scheduling.js";

const existingSchedule = {
  id: "schedule-existing",
  planId: "plan-core-awakening",
  date: "2026-07-24",
  createdAt: "2026-07-24T00:00:00.000Z"
};

test("allows saving a staged deletion without requiring a new date", () => {
  const result = prepareScheduleChanges({
    planId: "plan-core-awakening",
    selectedDates: [],
    schedules: [existingSchedule],
    deletedScheduleIds: [existingSchedule.id],
    createdAt: "2026-07-24T01:00:00.000Z",
    createScheduleId: () => "schedule-new"
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.deletedScheduleIds, [existingSchedule.id]);
  assert.deepEqual(result.newSchedules, []);
});

test("rejects an unchanged empty schedule form", () => {
  const result = prepareScheduleChanges({
    planId: "plan-core-awakening",
    selectedDates: [],
    schedules: [],
    deletedScheduleIds: [],
    createdAt: "2026-07-24T01:00:00.000Z",
    createScheduleId: () => "schedule-new"
  });

  assert.equal(result.error, "date_required");
});

test("adds selected dates that are not already scheduled", () => {
  const result = prepareScheduleChanges({
    planId: "plan-core-awakening",
    selectedDates: ["2026-07-24", "2026-07-25"],
    schedules: [existingSchedule],
    deletedScheduleIds: [],
    createdAt: "2026-07-24T01:00:00.000Z",
    createScheduleId: () => "schedule-new"
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.newDates, ["2026-07-25"]);
  assert.deepEqual(result.newSchedules, [{
    id: "schedule-new",
    planId: "plan-core-awakening",
    date: "2026-07-25",
    createdAt: "2026-07-24T01:00:00.000Z"
  }]);
});

test("does not delete schedules that belong to another plan", () => {
  const otherPlanSchedule = {
    ...existingSchedule,
    id: "schedule-other-plan",
    planId: "plan-other"
  };
  const result = prepareScheduleChanges({
    planId: "plan-core-awakening",
    selectedDates: ["2026-07-25"],
    schedules: [existingSchedule, otherPlanSchedule],
    deletedScheduleIds: [otherPlanSchedule.id],
    createdAt: "2026-07-24T01:00:00.000Z",
    createScheduleId: () => "schedule-new"
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.deletedScheduleIds, []);
  assert.deepEqual(result.newDates, ["2026-07-25"]);
});
