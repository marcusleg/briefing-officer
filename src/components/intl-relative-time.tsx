"use client";

import IntlDateTime from "@/components/intl-date-time";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useState } from "react";

const formatter = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
});

interface IntlRelativeTimeProps {
  date: Date;
}

const IntlRelativeTime = ({ date }: IntlRelativeTimeProps) => {
  const [currentDateTime, setCurrentDateTime] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(Date.now());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const diff = date.getTime() - currentDateTime;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let relativeTime;
  if (Math.abs(days) > 1) {
    relativeTime = formatter.format(days, "day");
  } else if (Math.abs(hours) > 1) {
    relativeTime = formatter.format(hours, "hour");
  } else if (Math.abs(minutes) > 1) {
    relativeTime = formatter.format(minutes, "minute");
  } else {
    relativeTime = "less than a minute ago";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="cursor-auto">{relativeTime}</TooltipTrigger>
        <TooltipContent>
          <IntlDateTime date={date} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default IntlRelativeTime;
