export type AppSearchParams = Promise<Record<string, string | string[] | undefined>>;

export function getSearchParamValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
