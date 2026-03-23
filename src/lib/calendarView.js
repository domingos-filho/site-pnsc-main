const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
});

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

export const padNumber = (value) => String(value).padStart(2, '0');

export const toDate = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const startOfDay = (value) => {
  const date = toDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export const endOfDay = (value) => {
  const dayStart = startOfDay(value);
  if (!dayStart) return null;
  return addDays(dayStart, 1);
};

export const addDays = (value, amount) => {
  const date = toDate(value);
  if (!date) return null;
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

export const formatDateKey = (value) => {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
};

export const formatMonthKey = (value) => {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`;
};

export const parseMonthKey = (monthKey) => {
  const [year, month] = String(monthKey || '')
    .split('-')
    .map(Number);

  if (!year || !month) return null;
  return new Date(year, month - 1, 1);
};

export const formatMonthLabel = (monthKey) => {
  const date = parseMonthKey(monthKey);
  return date ? MONTH_LABEL_FORMATTER.format(date) : '';
};

export const isSameDate = (left, right) => {
  const leftDate = toDate(left);
  const rightDate = toDate(right);

  if (!leftDate || !rightDate) return false;

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

export const getMonthGrid = (value) => {
  const date = toDate(value);
  if (!date) return [];

  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const items = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    items.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    items.push(new Date(date.getFullYear(), date.getMonth(), day));
  }

  return items;
};

export const startOfWeek = (value) => {
  const date = startOfDay(value);
  if (!date) return null;
  return addDays(date, -date.getDay());
};

export const getWeekDays = (value) => {
  const weekStart = startOfWeek(value);
  if (!weekStart) return [];

  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
};

export const formatWeekdayLabel = (value) => {
  const date = toDate(value);
  return date ? DAY_LABEL_FORMATTER.format(date) : '';
};

export const eventOccursOnDate = (event, value) => {
  const eventStart = toDate(event?.startsAt);
  const eventEnd = toDate(event?.endsAt);
  const dayStart = startOfDay(value);
  const dayEnd = endOfDay(value);

  if (!eventStart || !eventEnd || !dayStart || !dayEnd) return false;

  return eventStart < dayEnd && eventEnd > dayStart;
};
