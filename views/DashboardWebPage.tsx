'use client';

import { useState } from 'react';
import { WebSidebar } from '@/components/navigation/WebSidebar';
import { CalendarCheck, Mic, TrendingUp, Plus, Edit3, ChevronLeft, ChevronRight } from 'lucide-react';
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

  // 記録のある日をSetで管理
  const recordedDates = new Set(summaries.map(s => s.date));

  // 今日の日付文字列
  const todayStr = today.toISOString().split('T')[0];

  // 今日の日付をフォーマット
  const formatTodayDate = () => {
    return `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  };

  // 月を変更
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

  // カレンダーのデータを生成
  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: Array<{ day: number; isCurrentMonth: boolean; date: string }> = [];

    // 前月の日を追加
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const prevMonthNum = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYearNum = currentMonth === 0 ? currentYear - 1 : currentYear;
      const date = `${prevYearNum}-${String(prevMonthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, isCurrentMonth: false, date });
    }

    // 当月の日を追加
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, isCurrentMonth: true, date });
    }

    // 次月の日を追加（6行 = 42日になるまで）
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const nextMonthNum = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYearNum = currentMonth === 11 ? currentYear + 1 : currentYear;
      const date = `${nextYearNum}-${String(nextMonthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, isCurrentMonth: false, date });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  // 今月の統計を計算
  const thisMonthSummaries = summaries.filter(s => {
    const d = new Date(s.date);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });
  const recordedDaysThisMonth = thisMonthSummaries.length;

  // 連続記録日数を計算
  const calculateStreak = () => {
    let streak = 0;
    const checkDate = new Date(today);

    // 今日の記録がなければ昨日から開始
    if (!recordedDates.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (recordedDates.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const streak = calculateStreak();

  return (
    <div className="flex w-[1440px] h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
      {/* Sidebar */}
      <WebSidebar activeItem="dashboard" user={user} />

      {/* Main Content */}
      <main className="overflow-x-hidden overflow-y-auto grow shrink bg-[#FBF7F3] h-full">
        <div className="py-8 px-12">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl mb-2 font-semibold text-[#3D3632]">ダッシュボード</h1>
            <p className="text-lg text-[#6B5F58]">あなたの心の健康を記録し、振り返りましょう</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-8 mb-12">
            {/* Today's Record */}
            <div className="p-6 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex justify-center items-center w-12 h-12 rounded-full bg-[#B8CAB0]/20">
                  <CalendarCheck className="text-xl text-[#B8CAB0]" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[#3D3632]">今日の記録</h3>
                  <p className="text-base text-[#6B5F58]">{formatTodayDate()}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${recordingLimit.used > 0 ? 'bg-[#B8CAB0]' : 'bg-[#C4BCB6]'}`}></div>
                  <span className="text-lg font-semibold text-[#3D3632]">
                    {recordingLimit.used > 0 ? '記録済み' : '未記録'}
                  </span>
                </div>
                {recordingLimit.used > 0 && (
                  <Link href={`/diary-detail-web?date=${todayStr}`}>
                    <button className="px-4 py-2 rounded-full bg-[#B8CAB0] text-white text-sm font-semibold hover:bg-[#A8B89F] transition-colors shadow-[0_2px_6px_rgba(184,202,176,0.3)]">
                      詳細を見る
                    </button>
                  </Link>
                )}
              </div>
            </div>

            {/* Recording Count */}
            <div className="p-6 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex justify-center items-center w-12 h-12 rounded-full bg-[#C17B68]/20">
                  <Mic className="text-xl text-[#C17B68]" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[#3D3632]">録音回数</h3>
                  <p className="text-base text-[#6B5F58]">今日の残り</p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-semibold text-[#3D3632]">{recordingLimit.remaining}回</span>
                <span className="text-lg text-[#6B5F58]">/ {recordingLimit.total}回</span>
              </div>
              <div className="mt-3">
                <div className="h-2 rounded-full bg-[#C17B68]/15">
                  <div
                    className="h-full rounded-full bg-[#C17B68] shadow-[0_1px_3px_rgba(193,123,104,0.3)]"
                    style={{ width: `${(recordingLimit.used / recordingLimit.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Streak Record */}
            <div className="p-6 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex justify-center items-center w-12 h-12 rounded-full bg-[#A8B89F]/20">
                  <TrendingUp className="text-xl text-[#A8B89F]" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[#3D3632]">継続記録</h3>
                  <p className="text-base text-[#6B5F58]">連続日数</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-[#3D3632]">{streak}日</span>
                <span className="text-lg text-[#6B5F58]">連続</span>
              </div>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-3 gap-8">
            {/* Left Column - Calendar (2/3 width) */}
            <div className="col-span-2">
              <div className="p-8 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
                {/* Calendar Header */}
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-semibold text-[#3D3632]">日記カレンダー</h2>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={prevMonth}
                      className="flex justify-center items-center w-10 h-10 rounded-full bg-white/70 shadow-[0_2px_6px_rgba(193,123,104,0.12)] hover:shadow-[0_4px_10px_rgba(193,123,104,0.18)] transition-shadow"
                    >
                      <ChevronLeft className="text-lg text-[#6B5F58]" size={18} />
                    </button>
                    <span className="text-xl text-center min-w-[120px] font-semibold text-[#3D3632]">
                      {currentYear}年{currentMonth + 1}月
                    </span>
                    <button
                      onClick={nextMonth}
                      className="flex justify-center items-center w-10 h-10 rounded-full bg-white/70 shadow-[0_2px_6px_rgba(193,123,104,0.12)] hover:shadow-[0_4px_10px_rgba(193,123,104,0.18)] transition-shadow"
                    >
                      <ChevronRight className="text-lg text-[#6B5F58]" size={18} />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Day Headers */}
                  {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                    <div key={day} className="text-base text-center pt-3 pb-3 font-semibold text-[#6B5F58]">{day}</div>
                  ))}

                  {/* Calendar Days */}
                  {calendarDays.map((dayInfo, index) => {
                    const isToday = dayInfo.date === todayStr;
                    const hasRecord = recordedDates.has(dayInfo.date);

                    if (!dayInfo.isCurrentMonth) {
                      return (
                        <div key={index} className="text-base text-center pt-3 pb-3 text-[#C4BCB6]">
                          {dayInfo.day}
                        </div>
                      );
                    }

                    if (isToday) {
                      return (
                        <div
                          key={index}
                          className="text-center pt-3 pb-3 rounded-full bg-[#C17B68] text-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.25)]"
                        >
                          <span className="text-base font-semibold">{dayInfo.day}</span>
                        </div>
                      );
                    }

                    if (hasRecord) {
                      return (
                        <Link
                          key={index}
                          href={`/diary-detail-web?date=${dayInfo.date}`}
                          className="text-center relative pt-3 pb-3 rounded-full hover:bg-[#C17B68]/8 cursor-pointer block"
                        >
                          <span className="text-base text-[#3D3632]">{dayInfo.day}</span>
                          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B8CAB0]"></div>
                        </Link>
                      );
                    }

                    return (
                      <div
                        key={index}
                        className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer"
                      >
                        {dayInfo.day}
                      </div>
                    );
                  })}
                </div>

                {/* Calendar Legend */}
                <div className="flex justify-center items-center gap-8 mt-8 pt-6 border-t border-[#C17B68]/12">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#B8CAB0]"></div>
                    <span className="text-base text-[#6B5F58]">記録済み</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#C17B68]"></div>
                    <span className="text-base text-[#6B5F58]">今日</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Sidebar Cards (1/3 width) */}
            <div className="col-span-1 flex flex-col gap-8">
              {/* Create New Diary Card */}
              <div className="p-8 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
                <div className="text-center mb-6">
                  <div className="flex justify-center items-center w-16 h-16 mb-4 mx-auto rounded-full bg-[#C17B68]/10">
                    <Plus className="text-2xl text-[#C17B68]" size={32} />
                  </div>
                  <h3 className="text-xl mb-2 font-semibold text-[#3D3632]">新しい日記を作成</h3>
                  <p className="text-base text-[#6B5F58]">今日の気持ちを記録しましょう</p>
                </div>
                <Link href="/ai-dialogue-web">
                  <button className="flex justify-center items-center gap-2 w-full py-4 px-6 rounded-full bg-[#C17B68] text-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.25)] hover:shadow-[0_4px_12px_rgba(193,123,104,0.35)] transition-shadow">
                    <Edit3 className="text-lg" size={18} />
                    <span className="text-lg whitespace-nowrap font-semibold">日記を作成</span>
                  </button>
                </Link>
              </div>

              {/* Monthly Statistics */}
              <div className="p-6 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
                <h3 className="text-xl mb-6 font-semibold text-[#3D3632]">今月の統計</h3>
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-base text-[#6B5F58]">記録日数</span>
                    <span className="text-lg font-semibold text-[#3D3632]">{recordedDaysThisMonth}日</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-base text-[#6B5F58]">総録音回数</span>
                    <span className="text-lg font-semibold text-[#3D3632]">
                      {thisMonthSummaries.reduce((sum, s) => sum + (s.total_recordings || 0), 0)}回
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-base text-[#6B5F58]">連続記録</span>
                    <span className="text-lg font-semibold text-[#3D3632]">{streak}日</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
