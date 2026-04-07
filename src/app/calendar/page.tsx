"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { getSupabase } from "@/lib/supabase";
import { Organization, Post } from "@/lib/types";
import { getOrgStyle } from "@/lib/org-colors";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const [orgsRes, postsRes] = await Promise.all([
      getSupabase().from("organizations").select("*"),
      getSupabase()
        .from("posts")
        .select("*")
        .in("status", ["scheduled", "approved", "published"])
        .gte("scheduled_at", monthStart.toISOString())
        .lte("scheduled_at", monthEnd.toISOString()),
    ]);

    if (orgsRes.data) setOrgs(orgsRes.data);
    if (postsRes.data) setPosts(postsRes.data as Post[]);
  }, [currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function getOrg(orgId: string) {
    return orgs.find((o) => o.id === orgId);
  }

  function getPostsForDay(date: Date) {
    return posts.filter(
      (p) => p.scheduled_at && isSameDay(new Date(p.scheduled_at), date)
    );
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const selectedDayPosts = selectedDate ? getPostsForDay(selectedDate) : [];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Content Calendar
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {format(currentMonth, "MMMM yyyy")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="text-sm font-medium text-brand-500 hover:text-brand-600 px-3 py-1.5"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const dayPosts = getPostsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-[80px] lg:min-h-[100px] p-2 border-b border-r border-gray-50 text-left transition hover:bg-gray-50 ${
                    !isCurrentMonth ? "bg-gray-25 opacity-40" : ""
                  } ${isSelected ? "ring-2 ring-inset ring-brand-500" : ""}`}
                >
                  <span
                    className={`text-sm font-medium ${
                      isToday
                        ? "bg-brand-500 text-white w-7 h-7 rounded-full flex items-center justify-center"
                        : "text-gray-700"
                    }`}
                  >
                    {format(day, "d")}
                  </span>

                  <div className="mt-1 space-y-1">
                    {dayPosts.slice(0, 3).map((post) => {
                      const org = getOrg(post.org_id);
                      const style = org
                        ? getOrgStyle(org.color_hex)
                        : getOrgStyle("");
                      return (
                        <div
                          key={post.id}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${style.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot} flex-shrink-0`} />
                          <span className="truncate">{org?.name}</span>
                        </div>
                      );
                    })}
                    {dayPosts.length > 3 && (
                      <span className="text-[10px] text-gray-400 pl-1">
                        +{dayPosts.length - 3} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Detail */}
        {selectedDate && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </h2>

            {selectedDayPosts.length === 0 ? (
              <p className="text-sm text-gray-400">No posts scheduled for this day.</p>
            ) : (
              <div className="space-y-3">
                {selectedDayPosts.map((post) => {
                  const org = getOrg(post.org_id);
                  const style = org
                    ? getOrgStyle(org.color_hex)
                    : getOrgStyle("");
                  return (
                    <div
                      key={post.id}
                      className="border border-gray-100 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}
                        >
                          {org?.name}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">
                          {post.platform}
                        </span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ml-auto ${
                            post.status === "published"
                              ? "bg-green-100 text-green-700"
                              : post.status === "scheduled"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {post.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {post.caption}
                      </p>
                      {post.scheduled_at && (
                        <p className="text-xs text-gray-400 mt-2">
                          Scheduled: {format(new Date(post.scheduled_at), "h:mm a")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
