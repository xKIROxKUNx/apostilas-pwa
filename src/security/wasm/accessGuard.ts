interface AccessGuardExports {
  hasAccess(userLevel: number, requiredLevel: number): number;
  deviceHashesMatch(currentHash: number, savedHash: number): number;
  canOpenApostila(
    userLevel: number,
    requiredLevel: number,
    currentHash: number,
    savedHash: number,
  ): number;
}

let wasmExports: AccessGuardExports | null = null;
let loadAttempted = false;

export function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

async function loadWasm(): Promise<AccessGuardExports | null> {
  if (loadAttempted) return wasmExports;
  loadAttempted = true;
  try {
    const url = `${import.meta.env.BASE_URL}wasm/access-guard.wasm`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { instance } = await WebAssembly.instantiateStreaming(response).catch(async () => {
      const buffer = await response.arrayBuffer();
      return WebAssembly.instantiate(buffer);
    });
    wasmExports = instance.exports as unknown as AccessGuardExports;
    return wasmExports;
  } catch (err) {
    console.warn(
      "[accessGuard] módulo WASM não carregou, usando fallback JS (funcionalidade preservada, só a ofuscação é reduzida):",
      err,
    );
    return null;
  }
}

const jsFallback: AccessGuardExports = {
  hasAccess: (userLevel, requiredLevel) => (userLevel >= requiredLevel ? 1 : 0),
  deviceHashesMatch: (a, b) => (a === b ? 1 : 0),
  canOpenApostila: (userLevel, requiredLevel, currentHash, savedHash) => {
    if (userLevel < requiredLevel) return 0;
    if (savedHash === 0) return 1;
    return currentHash === savedHash ? 1 : 0;
  },
};

export async function initAccessGuard(): Promise<void> {
  await loadWasm();
}

function exportsOrFallback(): AccessGuardExports {
  return wasmExports ?? jsFallback;
}

export function hasAccess(userLevel: number, requiredLevel: number): boolean {
  return exportsOrFallback().hasAccess(userLevel, requiredLevel) === 1;
}

export function deviceIdsMatch(currentId: string, savedId: string): boolean {
  return (
    exportsOrFallback().deviceHashesMatch(fnv1aHash(currentId), fnv1aHash(savedId)) === 1
  );
}

export function canOpenApostila(
  userLevel: number,
  requiredLevel: number,
  currentDeviceId: string,
  savedDeviceId: string | null,
): boolean {
  const savedHash = savedDeviceId ? fnv1aHash(savedDeviceId) : 0;
  return (
    exportsOrFallback().canOpenApostila(
      userLevel,
      requiredLevel,
      fnv1aHash(currentDeviceId),
      savedHash,
    ) === 1
  );
}

export function canOpenApostilaAnyDevice(
  userLevel: number,
  requiredLevel: number,
  currentDeviceId: string,
  savedDeviceIds: string[],
): boolean {
  if (savedDeviceIds.length === 0) {
    return canOpenApostila(userLevel, requiredLevel, currentDeviceId, null);
  }
  return savedDeviceIds.some((saved) =>
    canOpenApostila(userLevel, requiredLevel, currentDeviceId, saved),
  );
}
