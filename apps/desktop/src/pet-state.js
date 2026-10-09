export const PET_STATE_VERSION = 1;

const FULLNESS_DECAY_PER_HOUR = 2;
const HAPPINESS_DECAY_PER_HOUR = 0.75;
const MAX_JOURNAL_ENTRIES = 5;

const clamp = (value, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));

const validTimestamp = (value, fallback) => {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
};

export function createPetState(now = new Date()) {
  const timestamp = now.toISOString();
  return {
    version: PET_STATE_VERSION,
    name: "Kern",
    fullness: 62,
    happiness: 74,
    bond: 0,
    careCount: 0,
    lastUpdatedAt: timestamp,
    lastFedAt: null,
    journal: [],
  };
}

export function normalizePetState(candidate, now = new Date()) {
  const fallback = createPetState(now);
  if (!candidate || typeof candidate !== "object") return fallback;

  const journal = Array.isArray(candidate.journal)
    ? candidate.journal
        .filter((entry) => entry && typeof entry.message === "string")
        .slice(0, MAX_JOURNAL_ENTRIES)
        .map((entry, index) => ({
          id: typeof entry.id === "string" ? entry.id : `restored-${index}`,
          message: entry.message,
          at: validTimestamp(entry.at, fallback.lastUpdatedAt),
        }))
    : [];

  return {
    version: PET_STATE_VERSION,
    name: "Kern",
    fullness: clamp(Number(candidate.fullness) || 0),
    happiness: clamp(Number(candidate.happiness) || 0),
    bond: Math.max(0, Math.floor(Number(candidate.bond) || 0)),
    careCount: Math.max(0, Math.floor(Number(candidate.careCount) || 0)),
    lastUpdatedAt: validTimestamp(candidate.lastUpdatedAt, fallback.lastUpdatedAt),
    lastFedAt: candidate.lastFedAt
      ? validTimestamp(candidate.lastFedAt, fallback.lastUpdatedAt)
      : null,
    journal,
  };
}

export function advancePetState(state, now = new Date()) {
  const normalized = normalizePetState(state, now);
  const currentTime = now.getTime();
  const previousTime = Date.parse(normalized.lastUpdatedAt);
  const elapsedHours = Math.max(0, currentTime - previousTime) / 3_600_000;

  if (elapsedHours === 0) return normalized;

  const fullness = clamp(normalized.fullness - elapsedHours * FULLNESS_DECAY_PER_HOUR);
  const lowFullnessPenalty = fullness < 30 ? 0.9 : 0;
  const happiness = clamp(
    normalized.happiness - elapsedHours * (HAPPINESS_DECAY_PER_HOUR + lowFullnessPenalty),
  );

  return {
    ...normalized,
    fullness: Number(fullness.toFixed(2)),
    happiness: Number(happiness.toFixed(2)),
    lastUpdatedAt: now.toISOString(),
  };
}

export function shareSnack(state, now = new Date()) {
  const current = advancePetState(state, now);
  const nextCareCount = current.careCount + 1;
  const message =
    nextCareCount === 1
      ? "You shared your first snack. Kern is beginning to trust you."
      : "Kern caught the snack and circled back for a happy wave.";

  return {
    ...current,
    fullness: clamp(current.fullness + 24),
    happiness: clamp(current.happiness + 9),
    bond: current.bond + 1,
    careCount: nextCareCount,
    lastFedAt: now.toISOString(),
    lastUpdatedAt: now.toISOString(),
    journal: [
      {
        id: `${now.getTime()}-${nextCareCount}`,
        message,
        at: now.toISOString(),
      },
      ...current.journal,
    ].slice(0, MAX_JOURNAL_ENTRIES),
  };
}

export function moodFor(state) {
  if (state.fullness < 25) {
    return {
      label: "getting hungry",
      message: "Kern is watching the surface and hoping you brought something tasty.",
    };
  }

  if (state.happiness >= 88 && state.fullness >= 82) {
    return {
      label: "making waves",
      message: "Full belly, bright mood. Kern is ready to explore the reef.",
    };
  }

  if (state.careCount === 0) {
    return {
      label: "curious about you",
      message: "A small snack is a good way to introduce yourself.",
    };
  }

  return {
    label: "happy to see you",
    message: "Kern remembers your last visit. Another check-in will strengthen your bond.",
  };
}

export function bondLabel(bond) {
  if (bond >= 12) return "Trusted navigator";
  if (bond >= 6) return "Reef companions";
  if (bond >= 2) return "Getting acquainted";
  if (bond >= 1) return "First connection";
  return "New friends";
}
