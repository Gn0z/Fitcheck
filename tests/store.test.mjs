import test from "node:test";
import assert from "node:assert/strict";

const STATE_KEY = "fitcheck:v1:state";

class LocalStorageMock {
  constructor(entries = []) {
    this.values = new Map(entries);
    this.failWrites = false;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failWrites) throw new DOMException("Quota exceeded", "QuotaExceededError");
    this.values.set(key, String(value));
  }
}

async function loadStore(storage) {
  globalThis.localStorage = storage;
  const token = `${Date.now()}-${Math.random()}`;
  return (await import(`../js/store.js?test=${token}`)).store;
}

test("restores a valid snapshot with one atomic state write", async () => {
  const storage = new LocalStorageMock();
  const store = await loadStore(storage);
  const before = store.snapshot();
  store.restore({
    ...before,
    settings: { nickname: "新昵称" }
  });
  assert.equal(store.getProfile().nickname, "新昵称");
  assert.equal(JSON.parse(storage.getItem(STATE_KEY)).profile.nickname, "新昵称");
});

test("keeps memory and persisted data unchanged when restore cannot be written", async () => {
  const storage = new LocalStorageMock();
  const store = await loadStore(storage);
  const before = store.snapshot();
  const persistedBefore = storage.getItem(STATE_KEY);
  storage.failWrites = true;

  assert.throws(() => {
    store.restore({
      ...before,
      settings: { nickname: "不应写入" }
    });
  }, /Quota exceeded/);
  assert.deepEqual(store.snapshot(), before);
  assert.equal(storage.getItem(STATE_KEY), persistedBefore);
});

test("starts with safe data and exposes a recovery issue for corrupt local state", async () => {
  const storage = new LocalStorageMock([[STATE_KEY, '{"plans":"broken"}']]);
  const store = await loadStore(storage);
  assert.ok(store.getLoadIssue());
  assert.equal(store.getPlans().length, 1);
  assert.deepEqual(store.getCompletions(), []);
});

test("loads and migrates valid legacy keys", async () => {
  const storage = new LocalStorageMock([
    ["fitcheck:v1:plans", JSON.stringify([])],
    ["fitcheck:v1:schedules", JSON.stringify([])],
    ["fitcheck:v1:completions", JSON.stringify([])]
  ]);
  const store = await loadStore(storage);
  assert.deepEqual(store.getPlans(), []);
  assert.ok(storage.getItem(STATE_KEY));
  assert.equal(store.getLoadIssue(), null);
});

test("applies schedule additions and deletions in one atomic write", async () => {
  const storage = new LocalStorageMock();
  const store = await loadStore(storage);
  const existing = {
    id: "schedule-existing",
    planId: "plan-core-awakening",
    date: "2026-07-24",
    createdAt: "2026-07-24T00:00:00.000Z"
  };
  const added = {
    id: "schedule-added",
    planId: "plan-core-awakening",
    date: "2026-07-25",
    createdAt: "2026-07-24T01:00:00.000Z"
  };
  store.applyScheduleChanges({
    deletedScheduleIds: [],
    newSchedules: [existing]
  });

  store.applyScheduleChanges({
    deletedScheduleIds: [existing.id],
    newSchedules: [added]
  });

  assert.deepEqual(store.getSchedules(), [added]);
  assert.deepEqual(JSON.parse(storage.getItem(STATE_KEY)).schedules, [added]);
});

test("does not partially apply schedule changes when persistence fails", async () => {
  const storage = new LocalStorageMock();
  const store = await loadStore(storage);
  const existing = {
    id: "schedule-existing",
    planId: "plan-core-awakening",
    date: "2026-07-24",
    createdAt: "2026-07-24T00:00:00.000Z"
  };
  const added = {
    id: "schedule-added",
    planId: "plan-core-awakening",
    date: "2026-07-25",
    createdAt: "2026-07-24T01:00:00.000Z"
  };
  store.applyScheduleChanges({
    deletedScheduleIds: [],
    newSchedules: [existing]
  });
  const before = store.snapshot();
  storage.failWrites = true;

  assert.throws(() => {
    store.applyScheduleChanges({
      deletedScheduleIds: [existing.id],
      newSchedules: [added]
    });
  }, /Quota exceeded/);
  assert.deepEqual(store.snapshot(), before);
});
