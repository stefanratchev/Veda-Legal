import { useState, useEffect } from "react";
import { formatDateISO } from "@/lib/date-utils";

/**
 * Returns the current date, automatically updating when the calendar date changes.
 * Checks every minute to handle overnight sessions where users leave the tab open.
 */
export function useCurrentDate(): Date {
  const [date, setDate] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setDate((prev) => {
        const now = new Date();
        return formatDateISO(now) !== formatDateISO(prev) ? now : prev;
      });
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  return date;
}
