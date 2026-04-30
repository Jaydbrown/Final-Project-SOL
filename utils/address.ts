export const maskAddress = (value: string, start = 6, end = 4): string => {
  if (!value) return "";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
};
