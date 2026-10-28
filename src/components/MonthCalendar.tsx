"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ka, enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CalendarEvent = {
  id: string;
  date: string; // ISO date
  title: string;
  href: string;
  kind: "task" | "deal" | "leave";
};

export function MonthCalendar({
  locale,
  events,
}: {
  locale: string;
  events: CalendarEvent[];
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const dfLocale = locale === "ka" ? ka : enUS;

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = ev.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const weekdays =
    locale === "ka"
      ? ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვი"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="month-cal">
      <div className="month-cal-toolbar">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setCursor((d) => addMonths(d, -1))}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <strong style={{ color: "var(--ink)", fontSize: "1.05rem" }}>
          {format(cursor, "LLLL yyyy", { locale: dfLocale })}
        </strong>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setCursor((d) => addMonths(d, 1))}
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setCursor(startOfMonth(new Date()))}
        >
          {locale === "ka" ? "დღეს" : "Today"}
        </button>
      </div>

      <div className="month-cal-grid">
        {weekdays.map((d) => (
          <div key={d} className="month-cal-dow">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const today = isSameDay(day, new Date());
          return (
            <div
              key={key}
              className={`month-cal-cell${inMonth ? "" : " is-outside"}${today ? " is-today" : ""}`}
            >
              <div className="month-cal-daynum">{format(day, "d")}</div>
              <ul className="month-cal-events">
                {dayEvents.slice(0, 3).map((ev) => (
                  <li key={ev.id}>
                    <Link href={ev.href} className={`month-cal-ev month-cal-ev-${ev.kind}`}>
                      {ev.title}
                    </Link>
                  </li>
                ))}
                {dayEvents.length > 3 ? (
                  <li className="muted" style={{ fontSize: "0.68rem" }}>
                    +{dayEvents.length - 3}
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="month-cal-legend muted">
        <span>
          <i className="month-cal-dot task" /> {locale === "ka" ? "დავალება" : "Task"}
        </span>
        <span>
          <i className="month-cal-dot deal" /> {locale === "ka" ? "გარიგება" : "Deal close"}
        </span>
        <span>
          <i className="month-cal-dot leave" /> {locale === "ka" ? "შვებულება" : "Leave"}
        </span>
      </div>
    </div>
  );
}
