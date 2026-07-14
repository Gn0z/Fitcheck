function buildTrainingSteps(plan) {
  return plan.exercises.flatMap((exercise, exerciseIndex) => {
    const totalSets = Math.max(1, Number(exercise.sets) || 1);
    return Array.from({ length: totalSets }, (_, setIndex) => ({
      exercise,
      exerciseIndex,
      setIndex,
      totalSets
    }));
  });
}

function formatCountdown(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = String(seconds % 60).padStart(2, "0");
  return `${String(minutesPart).padStart(2, "0")}:${secondsPart}`;
}

export function createTrainingController({ getPlan, getScheduleId, setScreen, onComplete }) {
  let session = null;

  function clearTimer() {
    if (session?.timerId) {
      cancelAnimationFrame(session.timerId);
      session.timerId = null;
    }
  }

  function stop() {
    clearTimer();
    session = null;
  }

  function getUpcomingStep() {
    return session?.steps[session.index + 1] || null;
  }

  function renderUpcomingStep() {
    const upcoming = getUpcomingStep();
    const label = document.querySelector("#checkin-next-label");
    const title = document.querySelector("#checkin-next");
    const note = document.querySelector("#checkin-next-note");

    if (!upcoming) {
      label.textContent = "下一步";
      title.textContent = "完成训练并打卡";
      note.textContent = "这是本次训练的最后一组";
      return;
    }

    label.textContent = upcoming.exerciseIndex === session.steps[session.index].exerciseIndex ? "下一组" : "下一个动作";
    title.textContent = `${upcoming.exercise.name} · 第 ${upcoming.setIndex + 1}/${upcoming.totalSets} 组`;
    note.textContent = upcoming.exercise.mode === "duration"
      ? `计时 ${upcoming.exercise.durationSeconds} 秒`
      : `完成 ${upcoming.exercise.reps} 次`;
  }

  function updateTimerVisual() {
    if (!session) return;
    const progress = session.durationMs > 0
      ? Math.max(0, Math.min(100, session.remainingMs / session.durationMs * 100))
      : 0;
    document.querySelector("#training-ring").style.setProperty("--progress", `${progress}%`);
    document.querySelector("#training-display").textContent = formatCountdown(session.remainingMs);
  }

  function finishRestPhase() {
    if (!session) return;
    clearTimer();
    session.index += 1;
    renderExercisePhase();
  }

  function tickTimer() {
    if (session) session.timerId = null;
    if (!session || session.paused || !session.endAt) return;
    session.remainingMs = Math.max(0, session.endAt - Date.now());
    updateTimerVisual();
    if (session.remainingMs > 0) {
      session.timerId = requestAnimationFrame(tickTimer);
      return;
    }

    const phase = session.phase;
    clearTimer();
    if (phase === "rest") {
      finishRestPhase();
    } else {
      finishStep();
    }
  }

  function startTimer(seconds) {
    clearTimer();
    session.durationMs = Math.max(1, Number(seconds)) * 1000;
    session.remainingMs = session.durationMs;
    session.endAt = Date.now() + session.remainingMs;
    session.paused = false;
    document.querySelector("#training-pause").textContent = "暂停倒计时";
    document.querySelector("#training-pause").hidden = false;
    updateTimerVisual();
    session.timerId = requestAnimationFrame(tickTimer);
  }

  function renderExercisePhase() {
    if (!session) return;
    clearTimer();
    session.phase = "exercise";
    const plan = getPlan(session.planId);
    if (!plan) {
      stop();
      return;
    }
    const step = session.steps[session.index];
    const exercise = step.exercise;
    const isFinalStep = session.index === session.steps.length - 1;
    const ring = document.querySelector("#training-ring");
    const primary = document.querySelector("#training-primary");
    const pause = document.querySelector("#training-pause");

    document.querySelector("#checkin-title").textContent = plan.name || "训练中";
    document.querySelector("#training-phase").textContent = `动作 ${step.exerciseIndex + 1}/${plan.exercises.length} · 第 ${step.setIndex + 1}/${step.totalSets} 组`;
    document.querySelector("#checkin-current").textContent = exercise.name;
    document.querySelector("#checkin-current-note").textContent = exercise.note || "保持稳定节奏，按计划完成本组";
    ring.classList.remove("rest-mode", "reps-mode");
    renderUpcomingStep();

    if (exercise.mode === "duration") {
      primary.textContent = isFinalStep ? "提前完成并打卡" : "提前完成本组";
      startTimer(exercise.durationSeconds);
    } else {
      ring.classList.add("reps-mode");
      ring.style.setProperty("--progress", "100%");
      document.querySelector("#training-display").textContent = `${exercise.reps} 次`;
      pause.hidden = true;
      primary.textContent = isFinalStep ? "完成训练并打卡" : "完成本组";
      session.durationMs = 0;
      session.remainingMs = 0;
      session.endAt = null;
      session.paused = false;
    }
  }

  function startRestPhase(seconds) {
    if (!session) return;
    session.phase = "rest";
    const current = session.steps[session.index];
    const upcoming = getUpcomingStep();
    const ring = document.querySelector("#training-ring");
    ring.classList.remove("reps-mode");
    ring.classList.add("rest-mode");
    document.querySelector("#training-phase").textContent = "组间休息";
    document.querySelector("#checkin-current").textContent = "休息";
    document.querySelector("#checkin-current-note").textContent = `${current.exercise.name}已完成，准备下一组`;
    document.querySelector("#checkin-next-label").textContent = upcoming?.exerciseIndex === current.exerciseIndex ? "休息后继续" : "休息后进入";
    document.querySelector("#checkin-next").textContent = upcoming
      ? `${upcoming.exercise.name} · 第 ${upcoming.setIndex + 1}/${upcoming.totalSets} 组`
      : "完成训练";
    document.querySelector("#checkin-next-note").textContent = upcoming?.exercise.mode === "duration"
      ? `计时 ${upcoming.exercise.durationSeconds} 秒`
      : `完成 ${upcoming?.exercise.reps || 0} 次`;
    document.querySelector("#training-primary").textContent = "跳过休息";
    startTimer(seconds);
  }

  function start() {
    const plan = getPlan();
    if (!plan || !plan.exercises.length) return false;
    stop();
    session = {
      planId: plan.id,
      scheduleId: getScheduleId(),
      steps: buildTrainingSteps(plan),
      index: 0,
      phase: "exercise",
      durationMs: 0,
      remainingMs: 0,
      endAt: null,
      paused: false,
      timerId: null
    };
    setScreen("checkin");
    renderExercisePhase();
    return true;
  }

  function finishStep() {
    if (!session) return;
    if (session.phase === "rest") {
      finishRestPhase();
      return;
    }

    clearTimer();
    const isFinalStep = session.index === session.steps.length - 1;
    if (isFinalStep) {
      const plan = getPlan(session.planId);
      const scheduleId = session.scheduleId;
      session = null;
      if (plan) onComplete({ plan, scheduleId });
      return;
    }

    const step = session.steps[session.index];
    const restSeconds = Number(step.exercise.restSeconds) || 0;
    if (restSeconds > 0) {
      startRestPhase(restSeconds);
    } else {
      session.index += 1;
      renderExercisePhase();
    }
  }

  function togglePause() {
    if (!session || !session.durationMs) return;
    const button = document.querySelector("#training-pause");
    if (session.paused) {
      session.paused = false;
      session.endAt = Date.now() + session.remainingMs;
      button.textContent = "暂停倒计时";
      tickTimer();
    } else {
      session.remainingMs = Math.max(0, session.endAt - Date.now());
      session.paused = true;
      session.endAt = null;
      clearTimer();
      updateTimerVisual();
      button.textContent = "继续倒计时";
    }
  }

  function syncVisibleTimer() {
    if (document.hidden || !session || session.paused || !session.endAt) return;
    clearTimer();
    tickTimer();
  }

  return Object.freeze({
    start,
    finishStep,
    togglePause,
    stop,
    hasActiveSession: () => Boolean(session),
    syncVisibleTimer
  });
}
