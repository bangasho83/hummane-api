export function parseLimit(value: unknown, defaultLimit = 50, maxLimit = 100) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultLimit;
    return Math.min(Math.floor(parsed), maxLimit);
}

export function parsePage(value: unknown, defaultPage = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultPage;
    return Math.floor(parsed);
}

export function getOffset(page: number, limit: number) {
    return (page - 1) * limit;
}
