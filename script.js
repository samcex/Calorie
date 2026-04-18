const STORAGE_KEY = "calorie-tracker-state-v1";
const UI_STORAGE_KEY = "calorie-tracker-ui-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  athlete: 1.9,
};

const GOAL_LABELS = {
  lose: "Fat-loss target",
  maintain: "Maintenance target",
  gain: "Muscle-gain target",
};

const defaultState = {
  profile: {
    age: 30,
    sex: "female",
    heightCm: 165,
    weightKg: 70,
    activityLevel: "moderate",
    goal: "lose",
    paceKgPerWeek: 0.5,
  },
  calorieSummary: null,
  calorieEntries: [],
  weightPlan: {
    targetWeightKg: 65,
    targetDate: dateAfterDays(90),
  },
  weightEntries: [],
};

const state = loadState();
const uiState = loadUiState();

const refs = {
  sectionTabs: document.getElementById("sectionTabs"),
  tabButtons: Array.from(document.querySelectorAll(".tab-button[data-panel-target]")),
  panels: Array.from(document.querySelectorAll(".panel[data-panel]")),
  calculatorForm: document.getElementById("calculatorForm"),
  age: document.getElementById("age"),
  sex: document.getElementById("sex"),
  heightCm: document.getElementById("heightCm"),
  weightKg: document.getElementById("weightKg"),
  activityLevel: document.getElementById("activityLevel"),
  goal: document.getElementById("goal"),
  paceKgPerWeek: document.getElementById("paceKgPerWeek"),
  calorieResults: document.getElementById("calorieResults"),
  calculatorNote: document.getElementById("calculatorNote"),
  foodEntryForm: document.getElementById("foodEntryForm"),
  foodDate: document.getElementById("foodDate"),
  foodName: document.getElementById("foodName"),
  foodCalories: document.getElementById("foodCalories"),
  foodTableBody: document.getElementById("foodTableBody"),
  dayTotal: document.getElementById("dayTotal"),
  dayTarget: document.getElementById("dayTarget"),
  dayRemaining: document.getElementById("dayRemaining"),
  weightPlanForm: document.getElementById("weightPlanForm"),
  targetWeightKg: document.getElementById("targetWeightKg"),
  targetDate: document.getElementById("targetDate"),
  weightEntryForm: document.getElementById("weightEntryForm"),
  weightDate: document.getElementById("weightDate"),
  weightValueKg: document.getElementById("weightValueKg"),
  weightTableBody: document.getElementById("weightTableBody"),
  weightChart: document.getElementById("weightChart"),
  stripTargetKcal: document.getElementById("stripTargetKcal"),
  stripTodayKcal: document.getElementById("stripTodayKcal"),
  stripLatestWeight: document.getElementById("stripLatestWeight"),
};

if (!state.calorieSummary) {
  state.calorieSummary = calculateCalorieSummary(state.profile);
}

initializeView();
attachEvents();
setActivePanel(uiState.activePanel, false);
renderAll();

function initializeView() {
  refs.age.value = state.profile.age;
  refs.sex.value = state.profile.sex;
  refs.heightCm.value = state.profile.heightCm;
  refs.weightKg.value = state.profile.weightKg;
  refs.activityLevel.value = state.profile.activityLevel;
  refs.goal.value = state.profile.goal;
  refs.paceKgPerWeek.value = String(state.profile.paceKgPerWeek);

  refs.targetWeightKg.value = state.weightPlan.targetWeightKg;
  refs.targetDate.value = state.weightPlan.targetDate || dateAfterDays(90);

  const today = localDateString(new Date());
  refs.foodDate.value = today;
  refs.weightDate.value = today;
  refs.weightValueKg.value = state.profile.weightKg.toFixed(1);
}

function attachEvents() {
  refs.sectionTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-panel-target]");
    if (!button) return;
    const panelName = button.getAttribute("data-panel-target");
    setActivePanel(panelName, true);
  });

  refs.calculatorForm.addEventListener("submit", handleCalculatorSubmit);
  refs.foodEntryForm.addEventListener("submit", handleAddFoodEntry);
  refs.foodDate.addEventListener("change", renderDailyTotals);

  refs.foodTableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-delete-food]");
    if (!button) return;
    const entryId = button.getAttribute("data-delete-food");
    state.calorieEntries = state.calorieEntries.filter((entry) => entry.id !== entryId);
    saveState();
    renderFoodTable();
    renderDailyTotals();
  });

  refs.weightPlanForm.addEventListener("submit", handleSaveWeightPlan);
  refs.weightEntryForm.addEventListener("submit", handleAddWeightEntry);
  refs.weightTableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-delete-weight]");
    if (!button) return;
    const entryId = button.getAttribute("data-delete-weight");
    state.weightEntries = state.weightEntries.filter((entry) => entry.id !== entryId);
    saveState();
    renderWeightTable();
    renderWeightChart();
  });

  window.addEventListener("resize", debounce(renderWeightChart, 90));
}

function setActivePanel(panelName, shouldPersist) {
  const allowedPanels = ["calculator", "food", "weight"];
  const nextPanel = allowedPanels.includes(panelName) ? panelName : "calculator";
  uiState.activePanel = nextPanel;

  refs.tabButtons.forEach((button) => {
    const isActive = button.getAttribute("data-panel-target") === nextPanel;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  refs.panels.forEach((panel) => {
    const isActive = panel.getAttribute("data-panel") === nextPanel;
    panel.hidden = !isActive;
    panel.classList.toggle("is-active", isActive);
  });

  if (shouldPersist) {
    saveUiState();
  }

  if (nextPanel === "weight") {
    // Ensure the canvas has a final rendered width after tab activation.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(renderWeightChart);
    });
  }
}

function renderSummaryStrip() {
  if (!refs.stripTargetKcal || !refs.stripTodayKcal || !refs.stripLatestWeight) {
    return;
  }

  const today = localDateString(new Date());
  const todayCalories = state.calorieEntries
    .filter((entry) => entry.date === today)
    .reduce((sum, entry) => sum + entry.calories, 0);
  const target = state.calorieSummary ? state.calorieSummary.targetCalories : null;

  const latestWeightEntry = state.weightEntries.reduce((latest, entry) => {
    if (!latest || entry.date > latest.date) {
      return entry;
    }
    return latest;
  }, null);

  refs.stripTargetKcal.textContent = target === null ? "-" : `${target}`;
  refs.stripTodayKcal.textContent = `${todayCalories}`;
  refs.stripLatestWeight.textContent = latestWeightEntry ? `${latestWeightEntry.weightKg.toFixed(1)} kg` : "-";
}

function handleCalculatorSubmit(event) {
  event.preventDefault();

  const profile = {
    age: numericValue(refs.age.value, 10, 100),
    sex: refs.sex.value === "male" ? "male" : "female",
    heightCm: numericValue(refs.heightCm.value, 100, 250),
    weightKg: numericValue(refs.weightKg.value, 30, 300),
    activityLevel: ACTIVITY_FACTORS[refs.activityLevel.value] ? refs.activityLevel.value : "moderate",
    goal: GOAL_LABELS[refs.goal.value] ? refs.goal.value : "maintain",
    paceKgPerWeek: numericValue(refs.paceKgPerWeek.value, 0.25, 1),
  };

  if (Object.values(profile).some((value) => value === null)) {
    refs.calculatorNote.textContent = "Please fill out all calculator fields with valid values.";
    return;
  }

  state.profile = profile;
  state.calorieSummary = calculateCalorieSummary(profile);

  refs.weightValueKg.value = profile.weightKg.toFixed(1);
  if (!state.weightPlan.targetWeightKg) {
    state.weightPlan.targetWeightKg = profile.weightKg;
    refs.targetWeightKg.value = profile.weightKg.toFixed(1);
  }

  saveState();
  renderCalorieSummary();
  renderDailyTotals();
  renderWeightChart();
}

function handleAddFoodEntry(event) {
  event.preventDefault();

  const date = refs.foodDate.value;
  const name = refs.foodName.value.trim();
  const calories = numericValue(refs.foodCalories.value, 1, 5000);

  if (!date || !name || calories === null) {
    return;
  }

  state.calorieEntries.push({
    id: generateId(),
    date,
    name,
    calories,
  });

  refs.foodName.value = "";
  refs.foodCalories.value = "";

  saveState();
  renderFoodTable();
  renderDailyTotals();
}

function handleSaveWeightPlan(event) {
  event.preventDefault();

  const targetWeightKg = numericValue(refs.targetWeightKg.value, 30, 300);
  const targetDate = refs.targetDate.value;

  if (targetWeightKg === null || !targetDate) {
    return;
  }

  state.weightPlan.targetWeightKg = targetWeightKg;
  state.weightPlan.targetDate = targetDate;

  saveState();
  renderWeightChart();
}

function handleAddWeightEntry(event) {
  event.preventDefault();

  const date = refs.weightDate.value;
  const weightKg = numericValue(refs.weightValueKg.value, 30, 300);
  if (!date || weightKg === null) {
    return;
  }

  const existing = state.weightEntries.find((entry) => entry.date === date);
  if (existing) {
    existing.weightKg = weightKg;
  } else {
    state.weightEntries.push({
      id: generateId(),
      date,
      weightKg,
    });
  }

  saveState();
  renderWeightTable();
  renderWeightChart();
}

function renderAll() {
  renderCalorieSummary();
  renderFoodTable();
  renderDailyTotals();
  renderWeightTable();
  renderWeightChart();
  renderSummaryStrip();
}

function renderCalorieSummary() {
  const summary = state.calorieSummary;
  if (!summary) {
    refs.calorieResults.innerHTML = "";
    refs.calculatorNote.textContent = "";
    return;
  }

  const cards = [
    { label: "BMR", value: `${summary.bmr} kcal` },
    { label: "Maintenance", value: `${summary.maintenance} kcal` },
    { label: GOAL_LABELS[state.profile.goal], value: `${summary.targetCalories} kcal` },
    { label: "Daily adjustment", value: `${summary.adjustment >= 0 ? "+" : ""}${summary.adjustment} kcal` },
  ];

  refs.calorieResults.innerHTML = cards
    .map((card) => `<article class="result-card"><span>${card.label}</span><strong>${card.value}</strong></article>`)
    .join("");

  refs.calculatorNote.textContent = summary.note;
}

function renderFoodTable() {
  refs.foodTableBody.innerHTML = "";
  const entries = [...state.calorieEntries].sort((a, b) => {
    if (a.date === b.date) return b.id.localeCompare(a.id);
    return a.date < b.date ? 1 : -1;
  });

  if (entries.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.className = "empty-row";
    cell.textContent = "No food entries yet.";
    row.appendChild(cell);
    refs.foodTableBody.appendChild(row);
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.textContent = displayDate(entry.date);

    const nameCell = document.createElement("td");
    nameCell.textContent = entry.name;

    const calorieCell = document.createElement("td");
    calorieCell.textContent = `${entry.calories}`;

    const actionCell = document.createElement("td");
    const button = document.createElement("button");
    button.className = "row-action";
    button.type = "button";
    button.setAttribute("data-delete-food", entry.id);
    button.textContent = "Delete";
    actionCell.appendChild(button);

    row.appendChild(dateCell);
    row.appendChild(nameCell);
    row.appendChild(calorieCell);
    row.appendChild(actionCell);
    refs.foodTableBody.appendChild(row);
  });
}

function renderDailyTotals() {
  const selectedDate = refs.foodDate.value || localDateString(new Date());
  const total = state.calorieEntries
    .filter((entry) => entry.date === selectedDate)
    .reduce((sum, entry) => sum + entry.calories, 0);

  const target = state.calorieSummary ? state.calorieSummary.targetCalories : null;
  const remaining = typeof target === "number" ? target - total : null;

  refs.dayTotal.textContent = `${total}`;
  refs.dayTarget.textContent = target === null ? "-" : `${target}`;
  refs.dayRemaining.textContent = remaining === null ? "-" : `${remaining}`;
  refs.dayRemaining.classList.remove("is-positive", "is-negative", "is-neutral");

  if (remaining === null) {
    refs.dayRemaining.classList.add("is-neutral");
  } else if (remaining < 0) {
    refs.dayRemaining.classList.add("is-negative");
  } else {
    refs.dayRemaining.classList.add("is-positive");
  }

  renderSummaryStrip();
}

function renderWeightTable() {
  refs.weightTableBody.innerHTML = "";
  const entries = [...state.weightEntries].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (entries.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "empty-row";
    cell.textContent = "No weight entries yet.";
    row.appendChild(cell);
    refs.weightTableBody.appendChild(row);
    renderSummaryStrip();
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.textContent = displayDate(entry.date);

    const weightCell = document.createElement("td");
    weightCell.textContent = entry.weightKg.toFixed(1);

    const actionCell = document.createElement("td");
    const button = document.createElement("button");
    button.className = "row-action";
    button.type = "button";
    button.setAttribute("data-delete-weight", entry.id);
    button.textContent = "Delete";
    actionCell.appendChild(button);

    row.appendChild(dateCell);
    row.appendChild(weightCell);
    row.appendChild(actionCell);
    refs.weightTableBody.appendChild(row);
  });

  renderSummaryStrip();
}

function renderWeightChart() {
  const canvas = refs.weightChart;
  const { ctx, width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);

  const actual = [...state.weightEntries]
    .map((entry) => ({
      t: dateToTimestamp(entry.date),
      weight: entry.weightKg,
    }))
    .sort((a, b) => a.t - b.t);

  if (actual.length === 0) {
    drawEmptyChartMessage(ctx, width, height, "Add weight entries to view your trend line.");
    return;
  }

  const startPoint = actual[0];
  const planTargetDate = state.weightPlan.targetDate ? dateToTimestamp(state.weightPlan.targetDate) : startPoint.t + DAY_MS * 90;
  const safeTargetDate = Math.max(planTargetDate, startPoint.t + DAY_MS);
  const targetWeight = Number.isFinite(state.weightPlan.targetWeightKg) ? state.weightPlan.targetWeightKg : startPoint.weight;

  const dateTicks = uniqueSortedNumbers([
    ...actual.map((point) => point.t),
    startPoint.t,
    safeTargetDate,
  ]);

  const ideal = dateTicks.map((timestamp) => {
    const progress = clamp((timestamp - startPoint.t) / (safeTargetDate - startPoint.t), 0, 1);
    return {
      t: timestamp,
      weight: startPoint.weight + (targetWeight - startPoint.weight) * progress,
    };
  });

  const allPoints = [...actual, ...ideal];
  let xMin = Math.min(...allPoints.map((point) => point.t));
  let xMax = Math.max(...allPoints.map((point) => point.t));
  let yMin = Math.min(...allPoints.map((point) => point.weight));
  let yMax = Math.max(...allPoints.map((point) => point.weight));

  if (xMin === xMax) {
    xMin -= DAY_MS;
    xMax += DAY_MS;
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }

  const yPadding = Math.max(1, (yMax - yMin) * 0.16);
  yMin -= yPadding;
  yMax += yPadding;

  const chart = {
    left: 52,
    right: width - 16,
    top: 18,
    bottom: height - 34,
  };

  const plotWidth = chart.right - chart.left;
  const plotHeight = chart.bottom - chart.top;

  const xToPx = (value) => chart.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
  const yToPx = (value) => chart.bottom - ((value - yMin) / (yMax - yMin)) * plotHeight;

  drawGrid(ctx, chart, xMin, xMax, yMin, yMax, xToPx, yToPx);
  drawLine(ctx, ideal, xToPx, yToPx, "#7b97df", [6, 4], 2);
  drawLine(ctx, actual, xToPx, yToPx, "#2e68ff", [], 2.6);
  drawPoints(ctx, actual, xToPx, yToPx, "#214ed4");
}

function drawGrid(ctx, chart, xMin, xMax, yMin, yMax, xToPx, yToPx) {
  ctx.save();
  ctx.strokeStyle = "#d7e3ff";
  ctx.fillStyle = "#607299";
  ctx.lineWidth = 1;
  ctx.font = "12px 'Manrope', sans-serif";

  const horizontalTicks = 5;
  for (let i = 0; i <= horizontalTicks; i += 1) {
    const value = yMin + ((yMax - yMin) * i) / horizontalTicks;
    const y = yToPx(value);
    ctx.beginPath();
    ctx.moveTo(chart.left, y);
    ctx.lineTo(chart.right, y);
    ctx.stroke();
    ctx.fillText(value.toFixed(1), 8, y + 4);
  }

  const verticalTicks = 4;
  for (let i = 0; i <= verticalTicks; i += 1) {
    const value = xMin + ((xMax - xMin) * i) / verticalTicks;
    const x = xToPx(value);
    ctx.beginPath();
    ctx.moveTo(x, chart.top);
    ctx.lineTo(x, chart.bottom);
    ctx.stroke();
    const label = new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    ctx.fillText(label, x - 24, chart.bottom + 18);
  }

  ctx.restore();
}

function drawLine(ctx, points, xToPx, yToPx, color, dash, width) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xToPx(point.t);
    const y = yToPx(point.weight);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawPoints(ctx, points, xToPx, yToPx, color) {
  ctx.save();
  ctx.fillStyle = color;
  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(xToPx(point.t), yToPx(point.weight), 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawEmptyChartMessage(ctx, width, height, message) {
  ctx.save();
  ctx.fillStyle = "#607299";
  ctx.font = "14px 'Manrope', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, width / 2, height / 2);
  ctx.restore();
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 600;
  const height = rect.height || 320;
  const dpr = window.devicePixelRatio || 1;

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function calculateCalorieSummary(profile) {
  const { age, sex, heightCm, weightKg, activityLevel, goal, paceKgPerWeek } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = Math.round(base + (sex === "male" ? 5 : -161));
  const maintenance = Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);

  let adjustment = 0;
  if (goal === "lose") {
    adjustment = -Math.round(clamp((paceKgPerWeek * 7700) / 7, 150, 1100));
  } else if (goal === "gain") {
    adjustment = Math.round(clamp((paceKgPerWeek * 7700) / 7, 150, 700));
  }

  const rawTarget = maintenance + adjustment;
  const safetyFloor = sex === "male" ? 1500 : 1200;
  const targetCalories = Math.round(Math.max(rawTarget, safetyFloor));

  const noteParts = [
    `Estimated BMR and TDEE are formula-based and approximate.`,
  ];
  if (targetCalories !== rawTarget) {
    noteParts.push(`A safety floor of ${safetyFloor} kcal/day was applied.`);
  }

  return {
    bmr,
    maintenance,
    adjustment,
    targetCalories,
    note: noteParts.join(" "),
  };
}

function loadState() {
  const clone = {
    profile: { ...defaultState.profile },
    calorieSummary: null,
    calorieEntries: [],
    weightPlan: { ...defaultState.weightPlan },
    weightEntries: [],
  };

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return clone;

  try {
    const parsed = JSON.parse(stored);

    clone.profile = {
      ...clone.profile,
      ...(parsed.profile || {}),
    };

    if (parsed.calorieSummary && typeof parsed.calorieSummary === "object") {
      clone.calorieSummary = parsed.calorieSummary;
    }

    if (Array.isArray(parsed.calorieEntries)) {
      clone.calorieEntries = parsed.calorieEntries
        .filter((entry) => entry && typeof entry.date === "string" && typeof entry.name === "string")
        .map((entry) => ({
          id: typeof entry.id === "string" ? entry.id : generateId(),
          date: entry.date,
          name: entry.name,
          calories: Number(entry.calories) || 0,
        }));
    }

    clone.weightPlan = {
      ...clone.weightPlan,
      ...(parsed.weightPlan || {}),
    };

    if (Array.isArray(parsed.weightEntries)) {
      clone.weightEntries = parsed.weightEntries
        .filter((entry) => entry && typeof entry.date === "string")
        .map((entry) => ({
          id: typeof entry.id === "string" ? entry.id : generateId(),
          date: entry.date,
          weightKg: Number(entry.weightKg) || 0,
        }))
        .filter((entry) => entry.weightKg > 0);
    }
  } catch (error) {
    console.error("Failed to parse saved state:", error);
  }

  return clone;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadUiState() {
  const defaults = { activePanel: "calculator" };
  const stored = localStorage.getItem(UI_STORAGE_KEY);
  if (!stored) return defaults;

  try {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed.activePanel === "string") {
      return {
        activePanel: parsed.activePanel,
      };
    }
  } catch (error) {
    console.error("Failed to parse UI state:", error);
  }

  return defaults;
}

function saveUiState() {
  localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(uiState));
}

function numericValue(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}

function uniqueSortedNumbers(list) {
  return [...new Set(list)].sort((a, b) => a - b);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function displayDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function dateToTimestamp(dateString) {
  return new Date(`${dateString}T00:00:00`).getTime();
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateAfterDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function debounce(callback, waitMs) {
  let timeoutId = null;
  return (...args) => {
    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), waitMs);
  };
}
