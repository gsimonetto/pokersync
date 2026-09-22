"use client";

import { FocusTimerCard } from "./focus-timer-card";
import { WeeklyHabitsCard } from "./weekly-habits-card";
import { HandsReviewCard } from "./hands-review-card";
import { SessionsCalendarCard } from "./sessions-calendar-card";
import { QuickNotesCard } from "./quick-notes-card";
import { BottomDock } from "./bottom-dock";

export function Dashboard() {
  return (
    <div className="min-h-screen pb-32">
      {/* Main grid */}
      <div className="w-full px-4 py-6 md:px-6 md:py-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5 max-w-7xl mx-auto">
          {/* Timer - large, tall */}
          <div className="md:col-span-1 lg:col-span-1 lg:row-span-2">
            <FocusTimerCard />
          </div>

          {/* Habits - medium */}
          <div className="md:col-span-1 lg:col-span-1">
            <WeeklyHabitsCard />
          </div>

          {/* Sessions - medium */}
          <div className="md:col-span-1 lg:col-span-1">
            <SessionsCalendarCard />
          </div>

          {/* Hands - medium, tall */}
          <div className="md:col-span-1 lg:col-span-1 lg:row-span-2">
            <HandsReviewCard />
          </div>

          {/* Notes - medium, tall */}
          <div className="md:col-span-1 lg:col-span-1 lg:row-span-2">
            <QuickNotesCard />
          </div>
        </div>
      </div>

      {/* Bottom dock */}
      <BottomDock />
    </div>
  );
}

export * from "./focus-timer-card";
export * from "./weekly-habits-card";
export * from "./hands-review-card";
export * from "./sessions-calendar-card";
export * from "./quick-notes-card";
export * from "./bottom-dock";
