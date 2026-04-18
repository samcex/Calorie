const STORAGE_KEY = "calorie-tracker-phone-v2";
const LEGACY_KEY = "calorie-tracker-state-v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const WATER_GOAL_LITERS = 3;
const STEPS_GOAL = 8000;

const MEAL_TYPES = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snacks", label: "Snacks" },
];

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  athlete: 1.9,
};

const defaultState = {
  profile: {
    age: 30,
    sex: "female",
    heightCm: 165,
    weightKg: 115,
    activityLevel: "moderate",
    goal: "lose",
    paceKgPerWeek: 0.5,
  },
  calorieSummary: null,
  calorieEntries: [],
  waterLogs: {},
  activityLogs: {},
  weightPlan: {
    targetWeightKg: 68,
    targetDate: dateAfterDays(120),
  },
  weightEntries: [],
  notes: [],
};

const state = loadState();
if (!state.calorieSummary) {
  state.calorieSummary = calculateCalorieSummary(state.profile);
}
let detailMessageTimeout = null;

const refs = {
  statusTime: document.getElementById("statusTime"),
  weekLabel: document.getElementById("weekLabel"),
  calorieRing: document.getElementById("calorieRing"),
  remainingCalories: document.getElementById("remainingCalories"),
  todayEaten: document.getElementById("todayEaten"),
  todayBurned: document.getElementById("todayBurned"),
  carbsBar: document.getElementById("carbsBar"),
  proteinBar: document.getElementById("proteinBar"),
  fatBar: document.getElementById("fatBar"),
  carbsText: document.getElementById("carbsText"),
  proteinText: document.getElementById("proteinText"),
  fatText: document.getElementById("fatText"),
  nutritionList: document.getElementById("nutritionList"),
  waterGoalText: document.getElementById("waterGoalText"),
  waterAmount: document.getElementById("waterAmount"),
  cupsRow: document.getElementById("cupsRow"),
  waterMinus: document.getElementById("waterMinus"),
  waterPlus: document.getElementById("waterPlus"),
  weightGoalLabel: document.getElementById("weightGoalLabel"),
  currentWeightLabel: document.getElementById("currentWeightLabel"),
  weightDown: document.getElementById("weightDown"),
  weightUp: document.getElementById("weightUp"),
  stepCountLabel: document.getElementById("stepCountLabel"),
  burnedKcalLabel: document.getElementById("burnedKcalLabel"),
  stepsProgress: document.getElementById("stepsProgress"),
  stepsMinus: document.getElementById("stepsMinus"),
  stepsPlus: document.getElementById("stepsPlus"),
  latestNoteText: document.getElementById("latestNoteText"),
  addNoteButton: document.getElementById("addNoteButton"),
  openDetailsButton: document.getElementById("openDetailsButton"),
  openNutritionButton: document.getElementById("openNutritionButton"),
  openWeightButton: document.getElementById("openWeightButton"),
  openActivityButton: document.getElementById("openActivityButton"),
  detailsOverlay: document.getElementById("detailsOverlay"),
  closeDetailsButton: document.getElementById("closeDetailsButton"),
  calculatorForm: document.getElementById("calculatorForm"),
  age: document.getElementById("age"),
  sex: document.getElementById("sex"),
  heightCm: document.getElementById("heightCm"),
  weightKg: document.getElementById("weightKg"),
  activityLevel: document.getElementById("activityLevel"),
  goal: document.getElementById("goal"),
  paceKgPerWeek: document.getElementById("paceKgPerWeek"),
  detailTargetCalories: document.getElementById("detailTargetCalories"),
  detailFormMessage: document.getElementById("detailFormMessage"),
  weightChart: document.getElementById("weightChart"),
};

const today = localDateString(new Date());

initializeView();
attachEvents();
renderAll();

function initializeView() {
  refs.statusTime.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  refs.weekLabel.textContent = `Week ${weekNumber(new Date())}`;
  refs.waterGoalText.textContent = WATER_GOAL_LITERS.toFixed(2);

  syncCalculatorFormFromState();
}

function attachEvents() {
  refs.nutritionList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-add-meal]");
    if (!button) return;
    const mealType = button.getAttribute("data-add-meal");
    addMealEntry(mealType);
  });

  refs.waterMinus.addEventListener("click", () => adjustWater(-0.25));
  refs.waterPlus.addEventListener("click", () => adjustWater(0.25));

  refs.weightDown.addEventListener("click", () => adjustWeight(-0.1));
  refs.weightUp.addEventListener("click", () => adjustWeight(0.1));

  refs.stepsMinus.addEventListener("click", () => adjustSteps(-500));
  refs.stepsPlus.addEventListener("click", () => adjustSteps(500));

  refs.addNoteButton.addEventListener("click", addNote);

  refs.openDetailsButton.addEventListener("click", openDetails);
  refs.openNutritionButton.addEventListener("click", openDetails);
  refs.openWeightButton.addEventListener("click", openDetails);
  refs.openActivityButton.addEventListener("click", openDetails);
  refs.closeDetailsButton.addEventListener("click", closeDetails);
  refs.detailsOverlay.addEventListener("click", (event) => {
    if (event.target === refs.detailsOverlay) closeDetails();
  });

  refs.calculatorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextProfile = {
      age: toNumber(refs.age.value, 10, 100),
      sex: refs.sex.value === "male" ? "male" : "female",
      heightCm: toNumber(refs.heightCm.value, 100, 250),
      weightKg: toNumber(refs.weightKg.value, 30, 300),
      activityLevel: ACTIVITY_FACTORS[refs.activityLevel.value] ? refs.activityLevel.value : "moderate",
      goal: ["lose", "maintain", "gain"].includes(refs.goal.value) ? refs.goal.value : "maintain",
      paceKgPerWeek: toNumber(refs.paceKgPerWeek.value, 0.25, 1),
    };
    if (Object.values(nextProfile).some((v) => v === null)) {
      setDetailMessage("Please fill all fields with valid values.", "error");
      return;
    }

    state.profile = nextProfile;
    state.calorieSummary = calculateCalorieSummary(nextProfile);
    refs.detailTargetCalories.textContent = `${state.calorieSummary.targetCalories} kcal`;
    saveState();
    renderAll();
    setDetailMessage(`Updated target to ${state.calorieSummary.targetCalories} kcal/day.`, "success");
  });

  window.addEventListener("resize", debounce(renderWeightChart, 80));
}

function renderAll() {
  renderSummary();
  renderNutrition();
  renderWater();
  renderWeight();
  renderActivities();
  renderNotes();
  renderDetails();
}

function renderSummary() {
  const eaten = totalCaloriesForDate(today);
  const target = state.calorieSummary.targetCalories;
  const burned = burnedCaloriesForDate(today);
  const remaining = target - eaten;

  refs.todayEaten.textContent = `${Math.round(eaten)}`;
  refs.todayBurned.textContent = `${Math.round(burned)}`;
  refs.remainingCalories.textContent = `${Math.round(remaining)}`;

  const ringPercent = clamp(target > 0 ? eaten / target : 0, 0, 1);
  const ringDeg = Math.round(ringPercent * 360);
  refs.calorieRing.style.background = `conic-gradient(#ffffff ${ringDeg}deg, rgba(255, 255, 255, 0.18) ${ringDeg}deg 360deg)`;

  const carbs = Math.round((eaten * 0.45) / 4);
  const protein = Math.round((eaten * 0.3) / 4);
  const fat = Math.round((eaten * 0.25) / 9);
  const goalCarbs = Math.round((target * 0.45) / 4);
  const goalProtein = Math.round((target * 0.3) / 4);
  const goalFat = Math.round((target * 0.25) / 9);

  refs.carbsText.textContent = `${carbs} / ${goalCarbs} g`;
  refs.proteinText.textContent = `${protein} / ${goalProtein} g`;
  refs.fatText.textContent = `${fat} / ${goalFat} g`;

  refs.carbsBar.style.width = `${Math.round(clamp(goalCarbs > 0 ? carbs / goalCarbs : 0, 0, 1) * 100)}%`;
  refs.proteinBar.style.width = `${Math.round(clamp(goalProtein > 0 ? protein / goalProtein : 0, 0, 1) * 100)}%`;
  refs.fatBar.style.width = `${Math.round(clamp(goalFat > 0 ? fat / goalFat : 0, 0, 1) * 100)}%`;
}

function renderNutrition() {
  refs.nutritionList.innerHTML = "";
  MEAL_TYPES.forEach((meal) => {
    const mealEntries = state.calorieEntries.filter((entry) => entry.date === today && entry.mealType === meal.key);
    const kcal = mealEntries.reduce((sum, entry) => sum + entry.calories, 0);

    const row = document.createElement("article");
    row.className = "meal-row";
    row.innerHTML = `
      <div class="meal-label">
        <strong>${meal.label}</strong>
        <small>${mealEntries.length} item${mealEntries.length === 1 ? "" : "s"}</small>
      </div>
      <span class="meal-kcal">${Math.round(kcal)} kcal</span>
      <button class="plus-btn" type="button" data-add-meal="${meal.key}">+</button>
    `;
    refs.nutritionList.appendChild(row);
  });
}

function renderWater() {
  const liters = Number(state.waterLogs[today] || 0);
  refs.waterAmount.textContent = `${liters.toFixed(2)} L`;
  refs.cupsRow.innerHTML = "";

  for (let i = 1; i <= 6; i += 1) {
    const cup = document.createElement("i");
    cup.className = "cup";
    if (liters >= i * 0.5) cup.classList.add("is-full");
    refs.cupsRow.appendChild(cup);
  }
}

function renderWeight() {
  const latest = latestWeightEntry();
  refs.currentWeightLabel.textContent = `${latest.weightKg.toFixed(1)} kg`;
  refs.weightGoalLabel.textContent = `${state.weightPlan.targetWeightKg.toFixed(1)} kg`;
}

function renderActivities() {
  const steps = Number(state.activityLogs[today] || 0);
  const burned = burnedCaloriesForDate(today);

  refs.stepCountLabel.textContent = `${Math.round(steps)} steps`;
  refs.burnedKcalLabel.textContent = `${burned.toFixed(1)} kcal`;
  refs.stepsProgress.style.width = `${Math.round(clamp(steps / STEPS_GOAL, 0, 1) * 100)}%`;
}

function renderNotes() {
  const latest = [...state.notes].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  refs.latestNoteText.textContent = latest ? latest.text : "How was your day?";
}

function renderDetails() {
  refs.detailTargetCalories.textContent = `${state.calorieSummary.targetCalories} kcal`;
  renderWeightChart();
}

function openDetails() {
  syncCalculatorFormFromState();
  setDetailMessage("", "success", true);
  refs.detailsOverlay.hidden = false;
  renderDetails();
}

function closeDetails() {
  refs.detailsOverlay.hidden = true;
}

function syncCalculatorFormFromState() {
  refs.age.value = state.profile.age;
  refs.sex.value = state.profile.sex;
  refs.heightCm.value = state.profile.heightCm;
  refs.weightKg.value = state.profile.weightKg;
  refs.activityLevel.value = state.profile.activityLevel;
  refs.goal.value = state.profile.goal;
  refs.paceKgPerWeek.value = String(state.profile.paceKgPerWeek);
}

function setDetailMessage(message, type, clearOnly = false) {
  if (!refs.detailFormMessage) return;

  refs.detailFormMessage.textContent = message;
  refs.detailFormMessage.classList.remove("is-error", "is-success");
  if (!clearOnly && message) {
    refs.detailFormMessage.classList.add(type === "error" ? "is-error" : "is-success");
  }

  if (detailMessageTimeout) {
    clearTimeout(detailMessageTimeout);
    detailMessageTimeout = null;
  }

  if (!clearOnly && message) {
    detailMessageTimeout = setTimeout(() => {
      refs.detailFormMessage.textContent = "";
      refs.detailFormMessage.classList.remove("is-error", "is-success");
      detailMessageTimeout = null;
    }, 2200);
  }
}

function addMealEntry(mealType) {
  const caloriesInput = window.prompt(`Add calories for ${capitalize(mealType)}:`, "300");
  if (caloriesInput === null) return;
  const calories = toNumber(caloriesInput, 1, 6000);
  if (calories === null) return;

  const itemInput = window.prompt("Optional meal note:", "");
  const name = (itemInput || capitalize(mealType)).trim() || capitalize(mealType);

  state.calorieEntries.push({
    id: generateId(),
    date: today,
    mealType,
    name,
    calories,
  });
  saveState();
  renderSummary();
  renderNutrition();
}

function adjustWater(delta) {
  const current = Number(state.waterLogs[today] || 0);
  const next = clamp(roundTo2(current + delta), 0, 8);
  state.waterLogs[today] = next;
  saveState();
  renderWater();
}

function adjustWeight(delta) {
  const latest = latestWeightEntry();
  const next = roundTo1(clamp(latest.weightKg + delta, 30, 300));
  upsertWeightEntry(today, next);
  refs.weightKg.value = next.toFixed(1);
  saveState();
  renderWeight();
  renderWeightChart();
}

function adjustSteps(delta) {
  const current = Number(state.activityLogs[today] || 0);
  state.activityLogs[today] = Math.max(0, current + delta);
  saveState();
  renderActivities();
  renderSummary();
}

function addNote() {
  const text = window.prompt("Add note:", "");
  if (!text) return;
  state.notes.push({
    id: generateId(),
    date: today,
    text: text.trim().slice(0, 180),
  });
  saveState();
  renderNotes();
}

function renderWeightChart() {
  const canvas = refs.weightChart;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 320;
  const height = rect.height || 220;
  const dpr = window.devicePixelRatio || 1;

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const actual = [...state.weightEntries]
    .map((entry) => ({ t: dateToTimestamp(entry.date), w: entry.weightKg }))
    .sort((a, b) => a.t - b.t);

  if (actual.length === 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "12px Manrope";
    ctx.textAlign = "center";
    ctx.fillText("No weight entries yet", width / 2, height / 2);
    return;
  }

  const start = actual[0];
  const targetDate = dateToTimestamp(state.weightPlan.targetDate || dateAfterDays(120));
  const safeTarget = Math.max(targetDate, start.t + DAY_MS);
  const targetWeight = state.weightPlan.targetWeightKg;

  const ticks = uniqueSorted([start.t, safeTarget, ...actual.map((p) => p.t)]);
  const ideal = ticks.map((t) => {
    const progress = clamp((t - start.t) / (safeTarget - start.t), 0, 1);
    return { t, w: start.w + (targetWeight - start.w) * progress };
  });

  const all = [...actual, ...ideal];
  let xMin = Math.min(...all.map((p) => p.t));
  let xMax = Math.max(...all.map((p) => p.t));
  let yMin = Math.min(...all.map((p) => p.w));
  let yMax = Math.max(...all.map((p) => p.w));

  if (xMin === xMax) {
    xMin -= DAY_MS;
    xMax += DAY_MS;
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const pad = Math.max(1, (yMax - yMin) * 0.14);
  yMin -= pad;
  yMax += pad;

  const chart = { left: 34, right: width - 12, top: 12, bottom: height - 24 };
  const plotW = chart.right - chart.left;
  const plotH = chart.bottom - chart.top;

  const xToPx = (x) => chart.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const yToPx = (y) => chart.bottom - ((y - yMin) / (yMax - yMin)) * plotH;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = chart.top + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(chart.left, y);
    ctx.lineTo(chart.right, y);
    ctx.stroke();
  }

  drawLine(ctx, ideal, xToPx, yToPx, "rgba(255, 255, 255, 0.45)", [5, 4], 1.7);
  drawLine(ctx, actual, xToPx, yToPx, "#ffffff", [], 2.3);
  drawPoints(ctx, actual, xToPx, yToPx, "#ffffff");
}

function drawLine(ctx, points, xToPx, yToPx, color, dash, width) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  points.forEach((p, index) => {
    const x = xToPx(p.t);
    const y = yToPx(p.w);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawPoints(ctx, points, xToPx, yToPx, color) {
  ctx.save();
  ctx.fillStyle = color;
  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(xToPx(p.t), yToPx(p.w), 2.8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function totalCaloriesForDate(date) {
  return state.calorieEntries
    .filter((entry) => entry.date === date)
    .reduce((sum, entry) => sum + entry.calories, 0);
}

function burnedCaloriesForDate(date) {
  const steps = Number(state.activityLogs[date] || 0);
  return steps * 0.04;
}

function latestWeightEntry() {
  if (state.weightEntries.length === 0) {
    const fallback = roundTo1(state.profile.weightKg);
    upsertWeightEntry(today, fallback);
    return { date: today, weightKg: fallback };
  }
  return [...state.weightEntries].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

function upsertWeightEntry(date, weightKg) {
  const existing = state.weightEntries.find((entry) => entry.date === date);
  if (existing) {
    existing.weightKg = weightKg;
    return;
  }
  state.weightEntries.push({
    id: generateId(),
    date,
    weightKg,
  });
}

function calculateCalorieSummary(profile) {
  const { age, sex, heightCm, weightKg, activityLevel, goal, paceKgPerWeek } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = Math.round(base + (sex === "male" ? 5 : -161));
  const maintenance = Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);

  let adjustment = 0;
  if (goal === "lose") adjustment = -Math.round(clamp((paceKgPerWeek * 7700) / 7, 150, 1100));
  if (goal === "gain") adjustment = Math.round(clamp((paceKgPerWeek * 7700) / 7, 150, 700));

  const safetyFloor = sex === "male" ? 1500 : 1200;
  const targetCalories = Math.max(Math.round(maintenance + adjustment), safetyFloor);
  return { bmr, maintenance, adjustment, targetCalories };
}

function loadState() {
  const fromNew = safeParse(localStorage.getItem(STORAGE_KEY));
  if (fromNew) return hydrate(fromNew);

  const fromLegacy = safeParse(localStorage.getItem(LEGACY_KEY));
  if (fromLegacy) {
    const migrated = hydrate({
      ...defaultState,
      ...fromLegacy,
      waterLogs: {},
      activityLogs: {},
      notes: [],
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }

  const clean = hydrate(defaultState);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  return clean;
}

function hydrate(source) {
  const safe = {
    profile: { ...defaultState.profile, ...(source.profile || {}) },
    calorieSummary: source.calorieSummary || null,
    calorieEntries: Array.isArray(source.calorieEntries) ? source.calorieEntries : [],
    waterLogs: source.waterLogs && typeof source.waterLogs === "object" ? source.waterLogs : {},
    activityLogs: source.activityLogs && typeof source.activityLogs === "object" ? source.activityLogs : {},
    weightPlan: { ...defaultState.weightPlan, ...(source.weightPlan || {}) },
    weightEntries: Array.isArray(source.weightEntries) ? source.weightEntries : [],
    notes: Array.isArray(source.notes) ? source.notes : [],
  };

  safe.calorieEntries = safe.calorieEntries
    .filter((entry) => entry && typeof entry.date === "string")
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : generateId(),
      date: entry.date,
      mealType: MEAL_TYPES.some((m) => m.key === entry.mealType) ? entry.mealType : inferMealType(entry.name),
      name: typeof entry.name === "string" ? entry.name : "Meal",
      calories: toNumber(entry.calories, 0, 6000) || 0,
    }));

  safe.weightEntries = safe.weightEntries
    .filter((entry) => entry && typeof entry.date === "string")
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : generateId(),
      date: entry.date,
      weightKg: roundTo1(toNumber(entry.weightKg, 30, 300) || defaultState.profile.weightKg),
    }));

  safe.notes = safe.notes
    .filter((note) => note && typeof note.text === "string")
    .map((note) => ({
      id: typeof note.id === "string" ? note.id : generateId(),
      date: typeof note.date === "string" ? note.date : today,
      text: note.text.slice(0, 180),
    }));

  return safe;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function inferMealType(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.includes("break")) return "breakfast";
  if (lower.includes("lunch")) return "lunch";
  if (lower.includes("dinner")) return "dinner";
  return "snacks";
}

function toNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function roundTo1(value) {
  return Math.round(value * 10) / 10;
}

function roundTo2(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function dateAfterDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateString(d);
}

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateToTimestamp(dateStr) {
  return new Date(`${dateStr}T00:00:00`).getTime();
}

function weekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / DAY_MS) + 1) / 7);
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort((a, b) => a - b);
}

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
