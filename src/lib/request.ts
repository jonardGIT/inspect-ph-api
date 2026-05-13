const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface PaginationQuery {
  limit: number;
  page: number;
  skip: number;
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function parsePaginationQuery(
  query: Record<string, unknown>,
): PaginationQuery {
  const page = parsePositiveInteger(query.page, DEFAULT_PAGE);
  const rawLimit = parsePositiveInteger(query.limit, DEFAULT_LIMIT);
  const limit = Math.min(rawLimit, MAX_LIMIT);

  return {
    limit,
    page,
    skip: (page - 1) * limit,
  };
}

export function createListMeta(total: number, page: number, limit: number) {
  return {
    limit,
    page,
    total,
  };
}
