export function parseLimit(value: unknown, defaultLimit = 50, maxLimit = 100) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultLimit;
    return Math.min(Math.floor(parsed), maxLimit);
}
