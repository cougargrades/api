export function integer(
  value: any,
  defaultValue = 0,
  minimum = Number.MIN_SAFE_INTEGER,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  if (isNaN(parseInt(`${value}`))) return defaultValue;
  if (parseInt(value) < minimum) return minimum;
  if (parseInt(value) > maximum) return maximum;
  return parseInt(`${value}`);
}
