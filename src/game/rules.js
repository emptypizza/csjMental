import { PROFILES } from "../data/profiles.js";

export const SLOT_WORDS = {
  weight: ["무거움", "날카로움", "잔잔함", "섞임"],
  place: ["기분", "몸", "사람들", "고르게"],
  today: ["쉬기", "움직이기", "말하기", "적기"],
};

const VOTE_WEIGHTS = ["무거움", "날카로움", "잔잔함"];
const VOTE_PLACES = ["기분", "몸", "사람들", "고르게"];

export function isCrisis(choice) {
  return Boolean(choice?.crisis);
}

export function slotOf(word) {
  for (const [slot, words] of Object.entries(SLOT_WORDS)) {
    if (words.includes(word)) return slot;
  }
  return null;
}

export function majority(values, tieValue) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  if (counts.size === 0) return tieValue;

  let best = 0;
  let top = [];
  for (const [value, count] of counts) {
    if (count > best) {
      best = count;
      top = [value];
    } else if (count === best) {
      top.push(value);
    }
  }
  if (top.length !== 1) return tieValue;
  return top[0];
}

function matchProfile(weight, place) {
  if (weight === "잔잔함" && place === "고르게") return PROFILES.calm;
  if (place === "사람들") return PROFILES.crowd;
  if (weight === "날카로움" && place === "몸") return PROFILES.siren;
  if (weight === "무거움" && place === "기분") return PROFILES.cloudy;
  return PROFILES.mixed;
}

export function resolve(tokens) {
  const weight = majority(
    tokens.map((token) => token.tags?.weight),
    "섞임",
  );
  const place = majority(
    tokens.map((token) => token.tags?.place),
    "고르게",
  );
  const profile = matchProfile(weight, place);
  return {
    weight,
    place,
    today: profile.today,
    profileId: profile.id,
  };
}

export function grade(tokens, slots) {
  const expected = resolve(tokens);
  const misses = [];
  if (slots.weight !== expected.weight) misses.push("weight");
  if (slots.place !== expected.place) misses.push("place");
  if (slots.today !== expected.today) misses.push("today");
  return { ok: misses.length === 0, misses, expected };
}

export function validateContent(scenes) {
  const errors = [];
  if (scenes.length !== 4) errors.push("상황 4개가 아닙니다.");

  let crisisCount = 0;
  for (const scene of scenes) {
    if (scene.choices.length !== 3) {
      errors.push(`${scene.id}: 문장이 3개가 아닙니다.`);
    }
    for (const choice of scene.choices) {
      if (choice.crisis) {
        crisisCount += 1;
        if (choice.label || choice.tags) {
          errors.push(`${choice.id}: 위기 문장에 프로필 표가 있습니다.`);
        }
        continue;
      }
      if (!choice.label || choice.encyclopedia?.length !== 2) {
        errors.push(`${choice.id}: 백과 두 문장이 없습니다.`);
      }
      const weight = choice.tags?.weight;
      const place = choice.tags?.place;
      if (!weight && !place) errors.push(`${choice.id}: 표가 없습니다.`);
      if (weight && !VOTE_WEIGHTS.includes(weight)) {
        errors.push(`${choice.id}: 알 수 없는 무게입니다.`);
      }
      if (place && !VOTE_PLACES.includes(place)) {
        errors.push(`${choice.id}: 알 수 없는 자리입니다.`);
      }
    }
  }
  if (crisisCount !== 1) errors.push("위기 문장은 하나여야 합니다.");

  const ids = ["cloudy", "siren", "crowd", "calm", "mixed"];
  for (const id of ids) {
    const profile = PROFILES[id];
    if (!profile?.name || profile.lines?.length !== 2) {
      errors.push(`${id}: 프로필 문장이 부족합니다.`);
    }
    if (!SLOT_WORDS.today.includes(profile?.today)) {
      errors.push(`${id}: 오늘 짝이 없습니다.`);
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
}
