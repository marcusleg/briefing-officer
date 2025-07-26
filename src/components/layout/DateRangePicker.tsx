"use client";

import { Calendar as CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { DateRange } from "react-day-picker";

export function DateRangePicker() {
  const [selected, setSelected] = useState<DateRange>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  const isMobile = useIsMobile();

  const dateFormatter = new Intl.DateTimeFormat(navigator.language, {
    dateStyle: isMobile ? "medium" : "long",
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!selected.from && !selected.to}
          className="w-[280px] justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
        >
          <CalendarIcon />
          {selected.from && selected.to ? (
            dateFormatter.formatRange(selected.from, selected.to)
          ) : (
            <span>Pick a date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          disabled={{ after: new Date() }}
          mode="range"
          selected={selected}
          onSelect={setSelected}
          required
        />
      </PopoverContent>
    </Popover>
  );
}
