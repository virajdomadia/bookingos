// Utility functions placeholder
export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const getTimezoneOffset = (timezone: string): number => {
  if (timezone === "Asia/Kolkata") return 5.5;
  return 0;
};
