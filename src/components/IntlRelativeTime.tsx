"use client";

import { useEffect, useState } from "react";

const formatter = new Intl.RelativeTimeFormat(navigator.language, {
  numeric: "auto",
});

interface IntlRelativeTimeProps {
  date: Date;
}

const IntlRelativeTime = ({ date }: IntlRelativeTimeProps) => {
  const [currentDateTime, setCurrentDateTime] = useState(Date.now());

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

  if (Math.abs(days) > 1) {
    return <>{formatter.format(days, "day")}</>;
  }

  if (Math.abs(hours) > 1) {
    return <>{formatter.format(hours, "hour")}</>;
  }

  if (Math.abs(minutes) > 1) {
    return <>{formatter.format(minutes, "minute")}</>;
  }

  return <>less than a minute ago</>;
};

export default IntlRelativeTime;
