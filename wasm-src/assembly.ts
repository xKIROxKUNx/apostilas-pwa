export function hasAccess(userLevel: i32, requiredLevel: i32): i32 {
  return userLevel >= requiredLevel ? 1 : 0;
}

function mix(seed: i32): i32 {
  let h = seed;
  h ^= h >>> 16;
  h *= 0x85ebca6b;
  h ^= h >>> 13;
  h *= 0xc2b2ae35;
  h ^= h >>> 16;
  return h;
}

export function deviceHashesMatch(currentHash: i32, savedHash: i32): i32 {
  return mix(currentHash) == mix(savedHash) ? 1 : 0;
}

export function canOpenApostila(
  userLevel: i32,
  requiredLevel: i32,
  currentHash: i32,
  savedHash: i32,
): i32 {
  const levelOk = hasAccess(userLevel, requiredLevel);
  if (levelOk == 0) return 0;
  if (savedHash == 0) return 1;
  return deviceHashesMatch(currentHash, savedHash);
}
