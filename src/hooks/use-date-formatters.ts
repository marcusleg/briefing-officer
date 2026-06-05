import { useMemo } from "react";

export function useDateFormatters(): {
  short: Intl.DateTimeFormat;
  long: Intl.DateTimeFormat;
} {
  return useMemo(
    () => ({
      short: new Intl.DateTimeFormat(navigator.language, {
        day: "2-digit",
        month: "short",
      }),
      long: new Intl.DateTimeFormat(navigator.language, {
        dateStyle: "full",
      }),
    }),
    [],
  );
}
