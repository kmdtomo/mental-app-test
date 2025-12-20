'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { WebSidebar } from '@/components/navigation/WebSidebar';
import { ChevronLeft, ChevronRight, Plus, Mic, Loader2, Calendar as CalendarIcon, ChevronDown, Activity } from 'lucide-react';
import Link from 'next/link';
import { DiaryDetailView } from '@/views/components/DiaryDetailView';
import { MobileNavBar } from '@/components/navigation/MobileNavBar';

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
    hasEmotionAnalysis: boolean;
  }>;
  hasTodayDiary: boolean;
  recordingLimit: {
    used: number;
    remaining: number;
    total: number;
  };
}

export function DashboardWebPage({ user, summaries, hasTodayDiary, recordingLimit }: DashboardWebPageProps) {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // State
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [displayedMonth, setDisplayedMonth] = useState(today.getMonth());
  const [displayedYear, setDisplayedYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [detailData, setDetailData] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  // Quick lookup map and sorted dates list
  const summariesMap = new Map(summaries.map(s => [s.date, s]));
  const recordedDates = summaries.map(s => s.date).sort();

  // Initial load: Jump to latest record if available, else today
  useEffect(() => {
    if (dateParam) {
      handleDateClick(dateParam);
    } else {
      handleDateClick(todayStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParam]);

  // Update current month when selected date changes (to keep strip in sync)
  useEffect(() => {
    const d = new Date(selectedDate);
    if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) {
      setCurrentMonth(d.getMonth());
      setCurrentYear(d.getFullYear());
    }
    // Sync displayed month/year with selected date initially or when it jumps
    setDisplayedMonth(d.getMonth());
    setDisplayedYear(d.getFullYear());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const centerX = container.scrollLeft + container.clientWidth / 2;

    // Find element closest to center
    const elements = Array.from(container.children) as HTMLElement[];
    let closestElement = null;
    let minDistance = Infinity;

    for (const el of elements) {
      const elCenter = el.offsetLeft - container.offsetLeft + el.clientWidth / 2;
      const distance = Math.abs(centerX - elCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestElement = el;
      }
    }

    if (closestElement) {
      const dateStr = closestElement.getAttribute('data-date');
      if (dateStr) {
        const d = new Date(dateStr);
        // Optimize: only update if changed
        if (d.getMonth() !== displayedMonth || d.getFullYear() !== displayedYear) {
          setDisplayedMonth(d.getMonth());
          setDisplayedYear(d.getFullYear());
        }
      }
    }
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

  const jumpToMonth = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
    setIsMonthPickerOpen(false);
  };

  const generateDaysForStrip = () => {
    const days = [];
    const start = new Date(currentYear, currentMonth - 1, 1);
    const end = new Date(currentYear, currentMonth + 2, 0); // Last day of next month

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days;
  };

  const daysInMonth = generateDaysForStrip();

  // Scroll to selected date
  useEffect(() => {
    if (scrollContainerRef.current) {
      const el = scrollContainerRef.current.querySelector<HTMLElement>(`[data-date="${selectedDate}"]`);
      if (el) {
        const container = scrollContainerRef.current;
        const scrollLeft = el.offsetLeft - (container.clientWidth / 2) + (el.clientWidth / 2);
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  }, [selectedDate, currentMonth, currentYear]);

  const handleDateClick = async (date: string) => {
    setSelectedDate(date);
    setIsLoadingDetail(true);
    setDetailData(null);

    if (new Date(date) > today && date !== todayStr) {
      setIsLoadingDetail(false);
      return;
    }

    try {
      const res = await fetch(`/api/diary-detail?date=${date}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setDetailData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleJumpToLatest = () => {
    // Find latest date with recording
    const latestDate = recordedDates.length > 0 ? recordedDates[recordedDates.length - 1] : todayStr;
    handleDateClick(latestDate);
  };

  // derived state for navigation
  const currentIndex = recordedDates.indexOf(selectedDate);
  // Note: if selectedDate is NOT in recordedDates (e.g. today with no record), we need to find insertion point
  // But strictly, hasPrevData means there is a record < selectedDate
  const hasPrevData = recordedDates.some(d => d < selectedDate);
  const hasNextData = recordedDates.some(d => d > selectedDate);

  const handlePrevData = () => {
    // Find closest date < selectedDate
    // recordedDates is sorted asc
    const prevDate = [...recordedDates].reverse().find(d => d < selectedDate);
    if (prevDate) {
      handleDateClick(prevDate);
    }
  };

  const handleNextData = () => {
    // Find closest date > selectedDate
    const nextDate = recordedDates.find(d => d > selectedDate);
    if (nextDate) {
      handleDateClick(nextDate);
    }
  };

  const getDayOfWeek = (date: Date) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[date.getDay()];
  };

  return (
    <div className="flex flex-col md:flex-row w-full h-screen font-sans bg-[#FBF7F3] text-[#3D3632] overflow-hidden">
      <WebSidebar activeItem="dashboard" user={user} />
      <MobileNavBar activeItem="dashboard" />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">

        {/* Header Section */}
        <header className="px-4 py-4 md:px-8 md:py-6 flex justify-between items-center bg-[#FBF7F3] z-10 shrink-0">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#3D3632] tracking-tight">My Diary</h1>
            <p className="text-[#6B5F58] text-xs md:text-sm">日々の記録</p>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/ai-dialogue-web">
              <button className="flex items-center gap-2 bg-[#3D3632] hover:bg-[#2A2522] text-[#FBF7F3] px-6 py-3 rounded-full transition-all shadow-md hover:shadow-lg">
                <Plus className="w-5 h-5" />
                <span className="font-semibold text-sm">日記を記録</span>
              </button>
            </Link>
          </div>
        </header>

        {/* Calendar Strip Section */}
        {/* Calendar Strip Section */}
        {/* Calendar Strip Section */}
        <div className="px-4 md:px-6 pb-2 md:pb-4 bg-[#FBF7F3] shrink-0">
          {/* Navigation Controls */}
          <div className="flex items-center justify-between px-1 md:px-2 mb-2 md:mb-4">
            <div className="relative">
              <button
                onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
                className="flex items-center gap-2 text-lg md:text-xl font-bold text-[#3D3632] hover:bg-black/5 px-2 py-1 rounded-lg transition-colors"
              >
                {displayedYear}年 {displayedMonth + 1}月
                <ChevronDown size={20} className={`transform transition-transform ${isMonthPickerOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Month Picker Dropdown */}
              {isMonthPickerOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-xl border border-[#F5EBE0] p-4 z-50 w-64 grid grid-cols-3 gap-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => jumpToMonth(currentYear, i)}
                      className={`p-2 rounded-lg text-sm font-medium transition-colors ${i === displayedMonth ? 'bg-[#C17B68] text-white' : 'hover:bg-[#FAF6F1]'}`}
                    >
                      {i + 1}月
                    </button>
                  ))}
                  <div className="col-span-3 flex justify-between mt-2 pt-2 border-t border-[#F5EBE0]">
                    <button onClick={() => setCurrentYear(currentYear - 1)} className="p-1 hover:bg-black/5 rounded"><ChevronLeft size={16} /></button>
                    <span className="text-sm font-semibold">{currentYear}</span>
                    <button onClick={() => setCurrentYear(currentYear + 1)} className="p-1 hover:bg-black/5 rounded"><ChevronRight size={16} /></button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              <button
                onClick={handlePrevData}
                disabled={!hasPrevData}
                className={`p-1.5 md:p-2 rounded-full transition-colors ${!hasPrevData ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-white text-[#6B5F58] hover:text-[#C17B68]'}`}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={handleJumpToLatest}
                className="bg-white border border-[#E8DFD6] hover:border-[#C17B68] text-[#3D3632] px-3 py-1 md:px-4 md:py-1.5 rounded-full text-xs md:text-sm font-semibold transition-all shadow-sm hover:shadow"
              >
                最新へ
              </button>
              <button
                onClick={handleNextData}
                disabled={!hasNextData}
                className={`p-1.5 md:p-2 rounded-full transition-colors ${!hasNextData ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-white text-[#6B5F58] hover:text-[#C17B68]'}`}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Strip */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto pb-2 pt-2 md:pt-4 px-1 gap-2 hide-scrollbar snap-x"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {daysInMonth.map((dateObj, i) => {
              const year = dateObj.getFullYear();
              const month = String(dateObj.getMonth() + 1).padStart(2, '0');
              const day = String(dateObj.getDate()).padStart(2, '0');
              const dateStr = `${year}-${month}-${day}`;

              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;
              const summary = summariesMap.get(dateStr);
              const hasRecord = !!summary;
              const hasEmotionAnalysis = summary?.hasEmotionAnalysis ?? false;

              return (
                <button
                  key={dateStr}
                  data-date={dateStr}
                  onClick={() => handleDateClick(dateStr)}
                  className={`flex flex-col items-center justify-center min-w-[56px] h-[80px] md:min-w-[64px] md:h-[90px] rounded-[20px] md:rounded-[24px] snap-center transition-all duration-300 border
                        ${isSelected
                      ? 'bg-[#3D3632] text-[#FBF7F3] border-[#3D3632] shadow-xl scale-105 transform z-10'
                      : hasRecord
                        ? 'bg-[#FFF9F5] text-[#3D3632] border-[#C17B68]/40 hover:border-[#C17B68] hover:bg-[#FFF0E8] shadow-sm'
                        : 'bg-white text-[#3D3632] border-transparent hover:border-[#C17B68]/30 hover:bg-[#FAF6F1]'
                    }
                      `}
                >
                  <span className={`text-[10px] md:text-[11px] font-bold mb-1 md:mb-1.5 ${isSelected ? 'text-[#FBF7F3]/70' : 'text-[#8C837C]'}`}>
                    {getDayOfWeek(dateObj)}
                  </span>
                  <span className={`text-xl md:text-2xl font-bold mb-1 md:mb-1.5 ${isSelected ? 'text-white' : isToday ? 'text-[#C17B68]' : 'text-[#3D3632]'}`}>
                    {dateObj.getDate()}
                  </span>
                  {/* 記録インジケーター: 感情分析あり=波形アイコン、なし=ドット */}
                  <div className="h-4 flex items-center justify-center">
                    {hasRecord ? (
                      hasEmotionAnalysis ? (
                        <Activity className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isSelected ? 'text-[#98AF8D]' : 'text-[#C17B68]'}`} />
                      ) : (
                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isSelected ? 'bg-[#98AF8D]' : 'bg-[#8C837C]'}`}></div>
                      )
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Detail View Section (Full Width) */}
        <div className="flex-1 overflow-y-auto bg-white rounded-t-[32px] md:rounded-t-[48px] shadow-[0_-8px_30px_rgba(0,0,0,0.04)] border-t border-[#F5EBE0] p-4 pb-20 md:p-12 md:pb-12 relative">

          {/* FULL WIDTH CONTAINER for content */}
          <div className="w-full h-full">
            {isLoadingDetail ? (
              <div className="flex h-60 items-center justify-center">
                <Loader2 className="w-10 h-10 text-[#C17B68] animate-spin" />
              </div>
            ) : selectedDate ? (
              detailData ? (
                <DiaryDetailView
                  date={selectedDate}
                  summary={detailData.summary}
                  dialogueTurns={detailData.dialogueTurns}
                  transcriptionSegments={detailData.transcriptionSegments}
                  onUpdateDiary={async (date, text) => {
                    const res = await fetch('/api/update-diary-summary', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ date, formattedText: text }),
                    });
                    if (!res.ok) throw new Error('Failed to update');
                    handleDateClick(date);
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                  <div className="w-20 h-20 rounded-full bg-[#FAF6F1] flex items-center justify-center mb-6">
                    <CalendarIcon className="w-10 h-10 text-[#C17B68]" />
                  </div>
                  <p className="text-xl font-medium">この日の記録はありません</p>
                  <p className="text-[#6B5F58] mt-2">画面右上の「日記を書く」から新しい日を始めましょう</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                <p>日付を選択してください</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
