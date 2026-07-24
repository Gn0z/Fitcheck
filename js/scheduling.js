export function prepareScheduleChanges({
  planId,
  selectedDates,
  schedules,
  deletedScheduleIds,
  createdAt,
  createScheduleId
}) {
  const scheduleIds = new Set(
    schedules
      .filter((schedule) => schedule.planId === planId)
      .map((schedule) => schedule.id)
  );
  const effectiveDeletedIds = [...new Set(deletedScheduleIds)]
    .filter((scheduleId) => scheduleIds.has(scheduleId))
    .sort();
  const deletedIdSet = new Set(effectiveDeletedIds);
  const dates = [...new Set(selectedDates)].sort();

  if (!dates.length && !effectiveDeletedIds.length) {
    return {
      error: "date_required",
      deletedScheduleIds: [],
      newDates: [],
      newSchedules: []
    };
  }

  const existingDates = new Set(
    schedules
      .filter((schedule) => schedule.planId === planId && !deletedIdSet.has(schedule.id))
      .map((schedule) => schedule.date)
  );
  const newDates = dates.filter((date) => !existingDates.has(date));

  if (!newDates.length && !effectiveDeletedIds.length) {
    return {
      error: "dates_already_scheduled",
      deletedScheduleIds: [],
      newDates: [],
      newSchedules: []
    };
  }

  return {
    error: null,
    deletedScheduleIds: effectiveDeletedIds,
    newDates,
    newSchedules: newDates.map((date) => ({
      id: createScheduleId(),
      planId,
      date,
      createdAt
    }))
  };
}
