'use client';

import { useState } from 'react';
import { WebSidebar } from '@/components/navigation/WebSidebar';
import { CalendarCheck, Mic, ChevronLeft, ChevronRight, Plus, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface DashboardWebPageProps {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    createdAt?: string;
  };
  summaries: Array<{
    date: string;
    total_recordings: number;
    formatted_text?: string | null;
  }>;
  hasTodayDiary: boolean;
  recordingLimit: {
    used: number;
    remaining: number;
    total: number;
  };
}

export function DashboardWebPage({ user, summaries, hasTodayDiary, recordingLimit }: DashboardWebPageProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // Create a map for quick lookup of summaries by date
  const summariesMap = new Map(summaries.map(s => [s.date, s]));

  // Today's date string
  const todayStr = today.toISOString().split('T')[0];

  const formatTodayDate = () => {
    return `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();

    const days: Array<{ day: number; isCurrentMonth: boolean; date: string }> = [];

    // Previous month filler
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const prevMonthNum = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYearNum = currentMonth === 0 ? currentYear - 1 : currentYear;
      const date = `${prevYearNum}-${String(prevMonthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, isCurrentMonth: false, date });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, isCurrentMonth: true, date });
    }

    // Next month filler
    const totalSlots = 42; // 6 rows * 7 columns
    const remainingDays = totalSlots - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const nextMonthNum = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYearNum = currentMonth === 11 ? currentYear + 1 : currentYear;
      const date = `${nextYearNum}-${String(nextMonthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, isCurrentMonth: false, date });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  // Helper to truncate text
  const truncateText = (text: string | null | undefined, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="flex w-full h-screen font-sans bg-[#FBF7F3] text-[#3D3632]">
      {/* Sidebar */}
      <WebSidebar activeItem="dashboard" user={user} />

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-10">

          {/* Header Area */}
          <header className="flex justify-between items-end mb-10">
            <div>
              <h1 className="text-4xl font-bold text-[#3D3632] tracking-tight mb-2">My Diary</h1>
              <p className="text-[#6B5F58] text-lg">日々の気持ちを振り返り、明日への活力に。</p>
            </div>

            <div className="flex items-center gap-6">
              {/* Today's Usage Pill */}
              <div className="flex items-center gap-3 bg-white/60 px-5 py-2.5 rounded-full border border-[#C17B68]/10 shadow-sm backdrop-blur-sm">
                <div className="bg-[#C17B68]/10 p-2 rounded-full">
                  <Mic className="text-[#C17B68]" size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-[#6B5F58] font-medium uppercase tracking-wider">今日の録音</span>
                  <span className="text-sm font-bold text-[#3D3632]">
                    <span className="text-[#C17B68]">{recordingLimit.remaining}</span>
                    <span className="text-[#6B5F58]/60 mx-1">/</span>
                    {recordingLimit.total}回
                  </span>
                </div>
              </div>

              <Link href="/ai-dialogue-web">
                <button className="group flex items-center gap-3 bg-[#3D3632] hover:bg-[#2A2522] text-[#FBF7F3] px-6 py-3 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
                  <span className="font-semibold tracking-wide">日記を書く</span>
                </button>
              </Link>
            </div>
          </header>

          {/* Calendar Container */}
          <div className="bg-white rounded-[32px] shadow-xl shadow-[#C17B68]/5 overflow-hidden border border-[#C17B68]/5">

            {/* Calendar Toolbar */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-[#F5EFE6]">
              <div className="flex items-center gap-4">
                <div className="bg-[#FAF6F1] p-2 rounded-2xl">
                  <BookOpen className="text-[#C17B68]" size={24} />
                </div>
                <h2 className="text-2xl font-bold text-[#3D3632] tracking-tight">
                  {currentYear}年 {currentMonth + 1}月
                </h2>
              </div>

              <div className="flex items-center gap-2 bg-[#FAF6F1] p-1 rounded-full">
                <button
                  onClick={prevMonth}
                  className="p-3 hover:bg-white rounded-full transition-all shadow-sm hover:shadow text-[#6B5F58] hover:text-[#C17B68]"
                >
                  <ChevronLeft size={20} strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => {
                    setCurrentMonth(today.getMonth());
                    setCurrentYear(today.getFullYear());
                  }}
                  className="px-4 py-2 text-sm font-bold text-[#6B5F58] hover:text-[#C17B68] transition-colors"
                >
                  今月
                </button>
                <button
                  onClick={nextMonth}
                  className="p-3 hover:bg-white rounded-full transition-all shadow-sm hover:shadow text-[#6B5F58] hover:text-[#C17B68]"
                >
                  <ChevronRight size={20} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Calendar Grid Header */}
            <div className="grid grid-cols-7 border-b border-[#F5EFE6] bg-[#FAF6F1]/50">
              {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                <div key={day} className={`text-center py-4 text-sm font-bold ${i === 0 ? 'text-[#C17B68]' : i === 6 ? 'text-[#5C8D89]' : 'text-[#8C837C]'}`}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 bg-[#F5EFE6] gap-[1px] border-b border-[#F5EFE6]">
              {calendarDays.map((dayInfo, index) => {
                const isToday = dayInfo.date === todayStr;
                const summary = summariesMap.get(dayInfo.date);
                const hasRecord = !!summary;

                // Styling classes
                const cellBgClass = !dayInfo.isCurrentMonth
                  ? "bg-[#FAF8F5]/50 text-[#D0C9C3]"
                  : isToday
                    ? "bg-white relative z-10 ring-2 ring-inset ring-[#C17B68]"
                    : "bg-white hover:bg-[#FAF8F5] transition-colors";

                const dateColorClass = isToday
                  ? "bg-[#C17B68] text-white shadow-md"
                  : hasRecord
                    ? "text-[#3D3632] font-semibold"
                    : "text-[#8C837C]";

                return (
                  <div key={index} className={`relative min-h-36 p-3 group flex flex-col items-stretch ${cellBgClass}`}>
                    {/* Date Number */}
                    <div className="flex justify-between items-start mb-2">
                      <span className={`flex justify-center items-center w-8 h-8 rounded-full text-sm font-medium transition-transform group-hover:scale-110 ${dateColorClass}`}>
                        {dayInfo.day}
                      </span>
                      {hasRecord && (
                        <div className="w-2 h-2 rounded-full bg-[#B8CAB0] mt-3 mr-1"></div>
                      )}
                    </div>

                    {/* Content Preview */}
                    {hasRecord ? (
                      <Link href={`/diary-detail-web?date=${dayInfo.date}`} className="flex-1 block mt-1">
                        <div className="h-full p-3 rounded-xl bg-[#FAF6F1] border border-[#E8DFD6] hover:border-[#C17B68]/30 hover:shadow-md transition-all group-hover:-translate-y-0.5">
                          <p className="text-xs text-[#6B5F58] font-medium leading-relaxed line-clamp-3">
                            {truncateText(summary.formatted_text, 60) || '記録あり'}
                          </p>
                          {summary.total_recordings > 0 && (
                            <div className="mt-2 flex items-center justify-end gap-1">
                              <Mic size={10} className="text-[#C17B68]" />
                              <span className="text-[10px] text-[#C17B68] font-medium">{summary.total_recordings}</span>
                            </div>
                          )}
                        </div>
                      </Link>
                    ) : (
                      // Empty state for current month days can be clicked to create
                      dayInfo.isCurrentMonth && !isToday && new Date(dayInfo.date) < today && (
                        <div className="flex-1 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[#D0C9C3] text-xs font-medium">No Entry</span>
                        </div>
                      )
                    )}

                    {/* Today badge if no record yet */}
                    {isToday && !hasRecord && (
                      <Link href="/ai-dialogue-web" className="flex-1 flex flex-col justify-center items-center mt-1 cursor-pointer rounded-xl hover:bg-[#C17B68]/5 transition-colors border-2 border-dashed border-[#C17B68]/20 hover:border-[#C17B68]">
                        <span className="text-xs font-bold text-[#C17B68] mb-1">今日</span>
                        <Plus className="text-[#C17B68]" size={16} />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer / Legend */}
          <div className="mt-6 flex justify-end items-center gap-6 text-sm text-[#8C837C] font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#B8CAB0]"></span>
              <span>日記あり</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#C17B68]"></span>
              <span>今日</span>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
