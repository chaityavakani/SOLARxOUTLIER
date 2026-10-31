export function parsePaging(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function rangeFromQuery(range = 'month', from, to) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === 'today') return { start, end };
  if (range === 'week') {
    start.setDate(start.getDate() - 6);
    return { start, end };
  }
  if (range === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end };
  }
  if (range === 'custom' && from) {
    const s = new Date(from);
    const e = to ? new Date(to) : end;
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }
  start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end };
}
