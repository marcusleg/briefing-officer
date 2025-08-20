"use client";

const formatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeStyle: "short",
});

interface IntlDateTimeProps {
  date: Date;
}

const IntlDateTime = ({ date }: IntlDateTimeProps) => (
  <time dateTime={date.toISOString()}>{formatter.format(date)}</time>
);

export default IntlDateTime;
