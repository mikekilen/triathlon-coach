import Anthropic from "@anthropic-ai/sdk";

// ── Tool Definitions ────────────────────────────────────────────────

export const tools: Anthropic.Tool[] = [
  {
    name: "calculate_training_zones",
    description:
      "Calculate heart rate, run pace, and bike power training zones based on athlete thresholds. Provide at least one of: lactate_threshold_hr, threshold_run_pace_min_per_km, or ftp_watts.",
    input_schema: {
      type: "object",
      properties: {
        lactate_threshold_hr: {
          type: "number",
          description: "Lactate threshold heart rate in bpm",
        },
        max_hr: {
          type: "number",
          description: "Maximum heart rate in bpm (optional, used for HR zones if LTHR not provided)",
        },
        threshold_run_pace_min_per_km: {
          type: "number",
          description: "Threshold run pace in minutes per kilometer (e.g., 5.5 = 5:30/km)",
        },
        ftp_watts: {
          type: "number",
          description: "Functional Threshold Power on the bike in watts",
        },
        css_per_100m_seconds: {
          type: "number",
          description: "Critical Swim Speed pace in seconds per 100m",
        },
      },
      required: [],
    },
  },
  {
    name: "generate_training_plan",
    description:
      "Generate a structured weekly training plan for a specific phase of triathlon preparation. Returns a week of swim/bike/run sessions with details.",
    input_schema: {
      type: "object",
      properties: {
        race_distance: {
          type: "string",
          enum: ["sprint", "olympic", "half_ironman", "ironman"],
          description: "Target race distance",
        },
        phase: {
          type: "string",
          enum: ["base", "build", "peak", "taper", "recovery"],
          description: "Current training phase",
        },
        weeks_to_race: {
          type: "number",
          description: "Number of weeks until race day",
        },
        weekly_hours: {
          type: "number",
          description: "Available training hours per week",
        },
        experience_level: {
          type: "string",
          enum: ["beginner", "intermediate", "advanced"],
          description: "Athlete's experience level",
        },
        limiters: {
          type: "array",
          items: { type: "string" },
          description:
            "Disciplines or skills that need extra focus (e.g., ['swim', 'run endurance'])",
        },
      },
      required: ["race_distance", "phase", "weeks_to_race", "weekly_hours", "experience_level"],
    },
  },
  {
    name: "analyze_workout",
    description:
      "Analyze a completed workout and provide coaching feedback including training stress, zone distribution, and improvement suggestions.",
    input_schema: {
      type: "object",
      properties: {
        discipline: {
          type: "string",
          enum: ["swim", "bike", "run", "brick"],
          description: "Type of workout",
        },
        duration_minutes: {
          type: "number",
          description: "Total workout duration in minutes",
        },
        distance_km: {
          type: "number",
          description: "Total distance in kilometers (or meters for swim)",
        },
        avg_hr: {
          type: "number",
          description: "Average heart rate during the workout",
        },
        max_hr: {
          type: "number",
          description: "Maximum heart rate during the workout",
        },
        avg_pace_or_power: {
          type: "number",
          description:
            "Average pace (min/km for run, sec/100m for swim) or power (watts for bike)",
        },
        perceived_effort: {
          type: "number",
          description: "Rate of perceived effort 1-10 (RPE)",
        },
        workout_description: {
          type: "string",
          description: "What the workout was supposed to be (e.g., 'easy 45min run', '8x100m swim intervals')",
        },
        notes: {
          type: "string",
          description: "Athlete's notes about how it felt",
        },
      },
      required: ["discipline", "duration_minutes"],
    },
  },
  {
    name: "calculate_race_pacing",
    description:
      "Calculate target pacing strategy and split times for a triathlon race based on athlete capabilities.",
    input_schema: {
      type: "object",
      properties: {
        race_distance: {
          type: "string",
          enum: ["sprint", "olympic", "half_ironman", "ironman"],
          description: "Race distance",
        },
        swim_css_per_100m: {
          type: "number",
          description: "Critical Swim Speed in seconds per 100m",
        },
        bike_ftp_watts: {
          type: "number",
          description: "Functional Threshold Power in watts",
        },
        run_threshold_pace_min_per_km: {
          type: "number",
          description: "Threshold run pace in min/km",
        },
        athlete_weight_kg: {
          type: "number",
          description: "Athlete weight in kg (for bike power calculations)",
        },
        course_profile: {
          type: "string",
          enum: ["flat", "rolling", "hilly"],
          description: "Course terrain profile",
        },
        conditions: {
          type: "string",
          enum: ["ideal", "hot", "cold", "windy", "wetsuit_legal"],
          description: "Expected race conditions",
        },
      },
      required: ["race_distance"],
    },
  },
  {
    name: "get_nutrition_plan",
    description:
      "Generate a race-day nutrition and hydration plan based on race distance, conditions, and athlete profile.",
    input_schema: {
      type: "object",
      properties: {
        race_distance: {
          type: "string",
          enum: ["sprint", "olympic", "half_ironman", "ironman"],
          description: "Race distance",
        },
        estimated_finish_hours: {
          type: "number",
          description: "Estimated total race time in hours",
        },
        athlete_weight_kg: {
          type: "number",
          description: "Athlete weight in kg",
        },
        conditions: {
          type: "string",
          enum: ["cool", "moderate", "hot"],
          description: "Expected temperature conditions",
        },
        stomach_sensitivity: {
          type: "string",
          enum: ["normal", "sensitive"],
          description: "How sensitive the athlete's stomach is during exercise",
        },
        preferred_products: {
          type: "array",
          items: { type: "string" },
          description: "Preferred nutrition products (e.g., ['gels', 'bars', 'drink mix'])",
        },
      },
      required: ["race_distance", "estimated_finish_hours"],
    },
  },
];

// ── Tool Implementations ────────────────────────────────────────────

interface ToolInput {
  [key: string]: unknown;
}

export function executeTool(name: string, input: ToolInput): string {
  switch (name) {
    case "calculate_training_zones":
      return calculateTrainingZones(input);
    case "generate_training_plan":
      return generateTrainingPlan(input);
    case "analyze_workout":
      return analyzeWorkout(input);
    case "calculate_race_pacing":
      return calculateRacePacing(input);
    case "get_nutrition_plan":
      return getNutritionPlan(input);
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

function calculateTrainingZones(input: ToolInput): string {
  const zones: Record<string, unknown> = {};

  const lthr = input.lactate_threshold_hr as number | undefined;
  const maxHr = input.max_hr as number | undefined;

  if (lthr) {
    zones.heart_rate_zones = {
      zone1_recovery: { min: Math.round(lthr * 0.68), max: Math.round(lthr * 0.83), description: "Recovery / Easy" },
      zone2_aerobic: { min: Math.round(lthr * 0.83), max: Math.round(lthr * 0.94), description: "Aerobic Endurance" },
      zone3_tempo: { min: Math.round(lthr * 0.94), max: lthr, description: "Tempo / Sweetspot" },
      zone4_threshold: { min: lthr, max: Math.round(lthr * 1.05), description: "Lactate Threshold" },
      zone5_vo2max: { min: Math.round(lthr * 1.05), max: Math.round(lthr * 1.15), description: "VO2max" },
    };
  } else if (maxHr) {
    zones.heart_rate_zones = {
      zone1_recovery: { min: Math.round(maxHr * 0.5), max: Math.round(maxHr * 0.6), description: "Recovery / Easy" },
      zone2_aerobic: { min: Math.round(maxHr * 0.6), max: Math.round(maxHr * 0.7), description: "Aerobic Endurance" },
      zone3_tempo: { min: Math.round(maxHr * 0.7), max: Math.round(maxHr * 0.8), description: "Tempo" },
      zone4_threshold: { min: Math.round(maxHr * 0.8), max: Math.round(maxHr * 0.9), description: "Threshold" },
      zone5_vo2max: { min: Math.round(maxHr * 0.9), max: maxHr, description: "VO2max" },
    };
  }

  const thresholdPace = input.threshold_run_pace_min_per_km as number | undefined;
  if (thresholdPace) {
    zones.run_pace_zones = {
      zone1_easy: { pace_per_km: `${formatPace(thresholdPace * 1.25)}–${formatPace(thresholdPace * 1.35)}`, description: "Easy / Recovery" },
      zone2_aerobic: { pace_per_km: `${formatPace(thresholdPace * 1.1)}–${formatPace(thresholdPace * 1.25)}`, description: "Aerobic Endurance" },
      zone3_tempo: { pace_per_km: `${formatPace(thresholdPace * 1.0)}–${formatPace(thresholdPace * 1.1)}`, description: "Tempo" },
      zone4_threshold: { pace_per_km: `${formatPace(thresholdPace * 0.95)}–${formatPace(thresholdPace * 1.0)}`, description: "Threshold" },
      zone5_intervals: { pace_per_km: `${formatPace(thresholdPace * 0.85)}–${formatPace(thresholdPace * 0.95)}`, description: "VO2max Intervals" },
    };
  }

  const ftp = input.ftp_watts as number | undefined;
  if (ftp) {
    zones.bike_power_zones = {
      zone1_recovery: { min: 0, max: Math.round(ftp * 0.55), description: "Active Recovery" },
      zone2_endurance: { min: Math.round(ftp * 0.56), max: Math.round(ftp * 0.75), description: "Endurance" },
      zone3_tempo: { min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.90), description: "Tempo" },
      zone4_threshold: { min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05), description: "Threshold" },
      zone5_vo2max: { min: Math.round(ftp * 1.06), max: Math.round(ftp * 1.20), description: "VO2max" },
      zone6_anaerobic: { min: Math.round(ftp * 1.21), max: Math.round(ftp * 1.50), description: "Anaerobic" },
    };
  }

  const css = input.css_per_100m_seconds as number | undefined;
  if (css) {
    zones.swim_pace_zones = {
      zone1_easy: { per_100m: `${formatSwimPace(css * 1.2)}–${formatSwimPace(css * 1.3)}`, description: "Easy / Warm-up" },
      zone2_aerobic: { per_100m: `${formatSwimPace(css * 1.08)}–${formatSwimPace(css * 1.2)}`, description: "Aerobic / CSS" },
      zone3_threshold: { per_100m: `${formatSwimPace(css * 0.97)}–${formatSwimPace(css * 1.08)}`, description: "Threshold" },
      zone4_vo2max: { per_100m: `${formatSwimPace(css * 0.9)}–${formatSwimPace(css * 0.97)}`, description: "VO2max intervals" },
      zone5_sprint: { per_100m: `< ${formatSwimPace(css * 0.9)}`, description: "Sprint / Anaerobic" },
    };
  }

  return JSON.stringify(zones, null, 2);
}

function generateTrainingPlan(input: ToolInput): string {
  const distance = input.race_distance as string;
  const phase = input.phase as string;
  const hours = input.weekly_hours as number;
  const level = input.experience_level as string;
  const limiters = (input.limiters as string[]) || [];
  const weeksOut = input.weeks_to_race as number;

  const swimPct = limiters.includes("swim") ? 0.25 : 0.2;
  const bikePct = limiters.includes("bike") ? 0.45 : 0.4;
  const runPct = 1 - swimPct - bikePct;

  const intensityByPhase: Record<string, { easy: number; moderate: number; hard: number }> = {
    base: { easy: 0.85, moderate: 0.1, hard: 0.05 },
    build: { easy: 0.75, moderate: 0.15, hard: 0.1 },
    peak: { easy: 0.7, moderate: 0.15, hard: 0.15 },
    taper: { easy: 0.85, moderate: 0.1, hard: 0.05 },
    recovery: { easy: 0.95, moderate: 0.05, hard: 0 },
  };

  const intensity = intensityByPhase[phase] || intensityByPhase.base;
  const volumeMultiplier = phase === "taper" ? 0.5 : phase === "recovery" ? 0.6 : phase === "peak" ? 0.95 : 1.0;
  const effectiveHours = hours * volumeMultiplier;

  const swimHours = effectiveHours * swimPct;
  const bikeHours = effectiveHours * bikePct;
  const runHours = effectiveHours * runPct;

  const sessionsPerWeek = level === "beginner" ? { swim: 2, bike: 2, run: 3 } :
    level === "intermediate" ? { swim: 3, bike: 3, run: 3 } :
      { swim: 3, bike: 4, run: 4 };

  const plan = {
    summary: {
      race_distance: distance,
      phase,
      weeks_to_race: weeksOut,
      total_hours: Math.round(effectiveHours * 10) / 10,
      intensity_distribution: `${Math.round(intensity.easy * 100)}% easy / ${Math.round(intensity.moderate * 100)}% moderate / ${Math.round(intensity.hard * 100)}% hard`,
      sessions_per_week: sessionsPerWeek.swim + sessionsPerWeek.bike + sessionsPerWeek.run,
    },
    swim: {
      sessions_per_week: sessionsPerWeek.swim,
      total_hours: Math.round(swimHours * 10) / 10,
      key_sessions: getSwimSessions(phase, level, distance),
    },
    bike: {
      sessions_per_week: sessionsPerWeek.bike,
      total_hours: Math.round(bikeHours * 10) / 10,
      key_sessions: getBikeSessions(phase, level, distance),
    },
    run: {
      sessions_per_week: sessionsPerWeek.run,
      total_hours: Math.round(runHours * 10) / 10,
      key_sessions: getRunSessions(phase, level, distance),
    },
    notes: getPlanNotes(phase, weeksOut, distance),
  };

  return JSON.stringify(plan, null, 2);
}

function analyzeWorkout(input: ToolInput): string {
  const discipline = input.discipline as string;
  const duration = input.duration_minutes as number;
  const distance = input.distance_km as number | undefined;
  const avgHr = input.avg_hr as number | undefined;
  const rpe = input.perceived_effort as number | undefined;
  const description = input.workout_description as string | undefined;
  const avgPaceOrPower = input.avg_pace_or_power as number | undefined;

  const analysis: Record<string, unknown> = {
    discipline,
    duration_minutes: duration,
  };

  if (distance) {
    if (discipline === "swim") {
      const pacePerHundred = (duration * 60) / (distance / 100);
      analysis.avg_pace = `${formatSwimPace(pacePerHundred)} per 100m`;
    } else if (discipline === "run") {
      const pacePerKm = duration / distance;
      analysis.avg_pace = `${formatPace(pacePerKm)} per km`;
    } else if (discipline === "bike") {
      const speedKmh = distance / (duration / 60);
      analysis.avg_speed = `${Math.round(speedKmh * 10) / 10} km/h`;
    }
  }

  // Estimated Training Stress Score (simplified)
  if (rpe && duration) {
    const tss = Math.round((duration * rpe * rpe) / 100);
    analysis.estimated_tss = tss;
    analysis.training_load = tss < 50 ? "low" : tss < 150 ? "moderate" : tss < 300 ? "high" : "very_high";
  }

  // HR/RPE mismatch check
  if (avgHr && rpe) {
    const hrEffort = avgHr > 170 ? 9 : avgHr > 160 ? 7 : avgHr > 150 ? 6 : avgHr > 140 ? 5 : avgHr > 130 ? 4 : 3;
    if (Math.abs(hrEffort - rpe) > 2) {
      analysis.hr_rpe_mismatch = true;
      analysis.mismatch_note =
        rpe > hrEffort
          ? "RPE higher than HR suggests — possible fatigue, heat, dehydration, or stress."
          : "HR higher than RPE suggests — cardiac drift, caffeine, or insufficient warm-up.";
    }
  }

  analysis.workout_type = description || "general";
  analysis.recovery_recommendation = getRecoveryRec(discipline, duration, rpe || 5);

  return JSON.stringify(analysis, null, 2);
}

function calculateRacePacing(input: ToolInput): string {
  const distance = input.race_distance as string;
  const profile = (input.course_profile as string) || "flat";
  const conditions = (input.conditions as string) || "ideal";

  const distances: Record<string, { swim_m: number; bike_km: number; run_km: number }> = {
    sprint: { swim_m: 750, bike_km: 20, run_km: 5 },
    olympic: { swim_m: 1500, bike_km: 40, run_km: 10 },
    half_ironman: { swim_m: 1900, bike_km: 90, run_km: 21.1 },
    ironman: { swim_m: 3800, bike_km: 180, run_km: 42.2 },
  };

  const d = distances[distance];
  const pacing: Record<string, unknown> = { race_distance: distance, distances: d };

  const swimCss = input.swim_css_per_100m as number | undefined;
  if (swimCss) {
    const raceSwimPace = swimCss * (distance === "ironman" ? 1.08 : 1.05);
    const swimTimeMin = (d.swim_m / 100) * raceSwimPace / 60;
    pacing.swim = {
      target_pace_per_100m: formatSwimPace(raceSwimPace),
      estimated_time: `${Math.floor(swimTimeMin)}:${String(Math.round(swimTimeMin % 1 * 60)).padStart(2, "0")}`,
      strategy: "Start conservatively. Settle into rhythm after first 200m. Draft when possible.",
    };
  }

  const ftp = input.bike_ftp_watts as number | undefined;
  if (ftp) {
    const intensityFactors: Record<string, number> = {
      sprint: 0.9, olympic: 0.82, half_ironman: 0.73, ironman: 0.68,
    };
    const profileAdjust = profile === "hilly" ? -0.03 : profile === "rolling" ? -0.01 : 0;
    const conditionAdjust = conditions === "hot" ? -0.03 : conditions === "windy" ? -0.02 : 0;
    const targetIF = (intensityFactors[distance] || 0.75) + profileAdjust + conditionAdjust;
    const targetWatts = Math.round(ftp * targetIF);

    pacing.bike = {
      target_power_watts: targetWatts,
      intensity_factor: Math.round(targetIF * 100) / 100,
      strategy: `Hold ${targetWatts}W average (normalized). Stay aero. Don't chase surges.`,
    };
  }

  const runPace = input.run_threshold_pace_min_per_km as number | undefined;
  if (runPace) {
    const raceFactors: Record<string, number> = {
      sprint: 1.02, olympic: 1.07, half_ironman: 1.15, ironman: 1.25,
    };
    const condAdj = conditions === "hot" ? 0.05 : 0;
    const racePace = runPace * ((raceFactors[distance] || 1.1) + condAdj);

    pacing.run = {
      target_pace_per_km: formatPace(racePace),
      strategy: `Start 10-15 sec/km slower than target. Build into pace after first 2km. Negative split if possible.`,
      estimated_time: `${Math.floor(d.run_km * racePace / 60)}h ${Math.round(d.run_km * racePace % 60)}min`,
    };
  }

  pacing.transitions = {
    t1_target: distance === "sprint" ? "1:00–1:30" : "2:00–3:00",
    t2_target: distance === "sprint" ? "0:30–1:00" : "1:00–2:00",
    tips: "Practice transitions. Lay out gear in order. Keep it simple.",
  };

  return JSON.stringify(pacing, null, 2);
}

function getNutritionPlan(input: ToolInput): string {
  const distance = input.race_distance as string;
  const finishHours = input.estimated_finish_hours as number;
  const weight = (input.athlete_weight_kg as number) || 70;
  const conditions = (input.conditions as string) || "moderate";
  const sensitivity = (input.stomach_sensitivity as string) || "normal";

  const carbsPerHour = sensitivity === "sensitive" ? 50 : distance === "ironman" ? 80 : 60;
  const fluidPerHour = conditions === "hot" ? 900 : conditions === "cool" ? 500 : 700;
  const sodiumPerHour = conditions === "hot" ? 800 : 500;

  const plan = {
    race_distance: distance,
    estimated_duration_hours: finishHours,
    pre_race: {
      meal_timing: "3 hours before start",
      meal: `${Math.round(weight * 2)}g carbs (e.g., oatmeal, banana, toast with jam)`,
      hydration: "500ml water with electrolytes, sipped over 2 hours",
      caffeine: `${Math.round(weight * 3)}mg caffeine 60 min before start (optional)`,
    },
    swim: {
      nutrition: "None — hydrate well before",
    },
    bike: {
      carbs_per_hour: `${carbsPerHour}g`,
      fluid_per_hour: `${fluidPerHour}ml`,
      sodium_per_hour: `${sodiumPerHour}mg`,
      timing: "Start fueling within first 15 minutes on the bike",
      strategy: distance === "ironman"
        ? "Alternate between drink mix, gels, and solid food every 20-30 min. Most calories come from the bike."
        : "Use drink mix as primary fuel. Supplement with gels every 30-45 min.",
      total_bike_carbs: `~${Math.round(carbsPerHour * finishHours * 0.55)}g`,
    },
    run: {
      carbs_per_hour: `${Math.round(carbsPerHour * 0.8)}g (reduce slightly vs. bike)`,
      fluid_per_hour: `${fluidPerHour}ml at aid stations`,
      strategy: "Gels and/or cola at aid stations. Walk through aid stations to drink properly.",
      total_run_carbs: `~${Math.round(carbsPerHour * 0.8 * finishHours * 0.35)}g`,
    },
    total_race_carbs: `~${Math.round(carbsPerHour * finishHours * 0.85)}g`,
    key_rules: [
      "Nothing new on race day — practice nutrition in training.",
      "Start fueling early; don't wait until you're hungry.",
      "If stomach issues arise, switch to water and sips of cola.",
      conditions === "hot" ? "In hot conditions, prioritize fluid and sodium over carbs." : "Stay consistent with fueling schedule.",
    ],
  };

  return JSON.stringify(plan, null, 2);
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatPace(minPerKm: number): string {
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatSwimPace(secPer100: number): string {
  const mins = Math.floor(secPer100 / 60);
  const secs = Math.round(secPer100 % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getSwimSessions(phase: string, level: string, distance: string): string[] {
  if (phase === "base") {
    return [
      "Technique: 6x50 drill/swim, focus on catch and rotation",
      `Endurance: Continuous ${level === "beginner" ? "800m" : "1500m"} at easy pace`,
    ];
  }
  if (phase === "build") {
    return [
      `Threshold: 5x200 at CSS pace, 20s rest`,
      `Endurance: ${level === "beginner" ? "1200m" : "2500m"} with pull buoy sets`,
    ];
  }
  if (phase === "peak") {
    return [
      "Race pace: 3x(400 at race pace + 100 easy)",
      "Open water simulation: continuous swim with sighting practice",
    ];
  }
  return ["Easy 30 min technique-focused swim"];
}

function getBikeSessions(phase: string, level: string, distance: string): string[] {
  const longRideHours = distance === "ironman" ? "4-5" : distance === "half_ironman" ? "2.5-3.5" : "1.5-2";
  if (phase === "base") {
    return [
      `Long ride: ${longRideHours}h at Z2 (aerobic endurance)`,
      "Easy spin: 45-60 min recovery ride",
    ];
  }
  if (phase === "build") {
    return [
      `Long ride: ${longRideHours}h with 2x20min at tempo`,
      "Intervals: 4x8min at threshold, 4min recovery",
    ];
  }
  if (phase === "peak") {
    return [
      `Race simulation: ${longRideHours}h at target race watts`,
      "Brick: 60-90 min bike + 20 min run off the bike",
    ];
  }
  return ["Easy 45 min spin"];
}

function getRunSessions(phase: string, level: string, distance: string): string[] {
  const longRunKm = distance === "ironman" ? "28-32" : distance === "half_ironman" ? "18-22" : "10-14";
  if (phase === "base") {
    return [
      `Long run: ${longRunKm}km at easy/Z2 pace`,
      "Easy: 30-40 min at conversational pace",
      level !== "beginner" ? "Strides: 6x100m after an easy run" : "Walk/run: 30 min building run time",
    ];
  }
  if (phase === "build") {
    return [
      `Long run: ${longRunKm}km with last 20 min at marathon pace`,
      "Tempo: 3x10min at tempo pace, 2min jog recovery",
      "Easy: 30-40 min recovery run",
    ];
  }
  if (phase === "peak") {
    return [
      "Race pace: 45 min with 25 min at target race pace",
      "Brick run: 15-20 min at race pace after bike session",
    ];
  }
  return ["Easy 20-30 min jog"];
}

function getPlanNotes(phase: string, weeksOut: number, distance: string): string[] {
  const notes: string[] = [];
  if (phase === "base") notes.push("Focus on building consistent volume. Keep all runs easy — you should be able to hold a conversation.");
  if (phase === "build") notes.push("Intensity is increasing. Monitor fatigue. Take an easy week every 3-4 weeks.");
  if (phase === "peak") notes.push("Highest training stress. Practice race nutrition and pacing. Include a brick workout weekly.");
  if (phase === "taper") notes.push("Volume drops 40-60% but maintain some intensity to stay sharp. Trust your fitness.");
  if (weeksOut <= 2) notes.push("Race week: prioritize sleep, hydration, and mental preparation. Lay out all gear early.");
  if (distance === "ironman") notes.push("Practice nutrition on every long session. Your gut needs training too.");
  return notes;
}

function getRecoveryRec(discipline: string, duration: number, rpe: number): string {
  const load = duration * rpe;
  if (load > 600) return "Hard session. Take tomorrow easy or rest. Prioritize protein, carbs, and sleep.";
  if (load > 300) return "Moderate session. Easy training OK tomorrow. Refuel within 30 minutes.";
  return "Light session. Normal training can resume tomorrow.";
}
