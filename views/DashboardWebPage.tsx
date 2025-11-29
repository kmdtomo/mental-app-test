'use client';

import { WebSidebar } from '@/components/navigation/WebSidebar';
import { CalendarCheck, Mic, TrendingUp, Plus, Edit3, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export function DashboardWebPage() {
  return (
    <div className="flex w-[1440px] h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
      {/* Sidebar */}
      <WebSidebar activeItem="dashboard" />

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
                  <p className="text-base text-[#6B5F58]">2024年1月15日</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#B8CAB0]"></div>
                <span className="text-lg font-semibold text-[#3D3632]">記録済み</span>
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
                  <p className="text-base text-[#6B5F58]">今月の残り</p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-semibold text-[#3D3632]">3回</span>
                <span className="text-lg text-[#6B5F58]">/ 5回</span>
              </div>
              <div className="mt-3">
                <div className="h-2 rounded-full bg-[#C17B68]/15">
                  <div className="h-full rounded-full bg-[#C17B68] w-[60%] shadow-[0_1px_3px_rgba(193,123,104,0.3)]"></div>
                </div>
              </div>
            </div>

            {/* This Week's Record */}
            <div className="p-6 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex justify-center items-center w-12 h-12 rounded-full bg-[#A8B89F]/20">
                  <TrendingUp className="text-xl text-[#A8B89F]" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[#3D3632]">今週の記録</h3>
                  <p className="text-base text-[#6B5F58]">継続日数</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-[#3D3632]">5日</span>
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
                    <button className="flex justify-center items-center w-10 h-10 rounded-full bg-white/70 shadow-[0_2px_6px_rgba(193,123,104,0.12)] hover:shadow-[0_4px_10px_rgba(193,123,104,0.18)] transition-shadow">
                      <ChevronLeft className="text-lg text-[#6B5F58]" size={18} />
                    </button>
                    <span className="text-xl text-center min-w-[120px] font-semibold text-[#3D3632]">2024年1月</span>
                    <button className="flex justify-center items-center w-10 h-10 rounded-full bg-white/70 shadow-[0_2px_6px_rgba(193,123,104,0.12)] hover:shadow-[0_4px_10px_rgba(193,123,104,0.18)] transition-shadow">
                      <ChevronRight className="text-lg text-[#6B5F58]" size={18} />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Day Headers */}
                  <div className="text-base text-center pt-3 pb-3 font-semibold text-[#6B5F58]">日</div>
                  <div className="text-base text-center pt-3 pb-3 font-semibold text-[#6B5F58]">月</div>
                  <div className="text-base text-center pt-3 pb-3 font-semibold text-[#6B5F58]">火</div>
                  <div className="text-base text-center pt-3 pb-3 font-semibold text-[#6B5F58]">水</div>
                  <div className="text-base text-center pt-3 pb-3 font-semibold text-[#6B5F58]">木</div>
                  <div className="text-base text-center pt-3 pb-3 font-semibold text-[#6B5F58]">金</div>
                  <div className="text-base text-center pt-3 pb-3 font-semibold text-[#6B5F58]">土</div>

                  {/* Week 1 */}
                  <div className="text-base text-center pt-3 pb-3 text-[#C4BCB6]">31</div>
                  <Link href="/diary-detail-web" className="text-center relative pt-3 pb-3 rounded-full hover:bg-[#C17B68]/8 cursor-pointer block">
                    <span className="text-base text-[#3D3632]">1</span>
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B8CAB0]"></div>
                  </Link>
                  <Link href="/diary-detail-web" className="text-center relative pt-3 pb-3 rounded-full hover:bg-[#C17B68]/8 cursor-pointer block">
                    <span className="text-base text-[#3D3632]">2</span>
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B8CAB0]"></div>
                  </Link>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">3</div>
                  <Link href="/diary-detail-web" className="text-center relative pt-3 pb-3 rounded-full hover:bg-[#C17B68]/8 cursor-pointer block">
                    <span className="text-base text-[#3D3632]">4</span>
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B8CAB0]"></div>
                  </Link>
                  <Link href="/diary-detail-web" className="text-center relative pt-3 pb-3 rounded-full hover:bg-[#C17B68]/8 cursor-pointer block">
                    <span className="text-base text-[#3D3632]">5</span>
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B8CAB0]"></div>
                  </Link>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">6</div>

                  {/* Week 2 */}
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">7</div>
                  <Link href="/diary-detail-web" className="text-center relative pt-3 pb-3 rounded-full hover:bg-[#C17B68]/8 cursor-pointer block">
                    <span className="text-base text-[#3D3632]">8</span>
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B8CAB0]"></div>
                  </Link>
                  <Link href="/diary-detail-web" className="text-center relative pt-3 pb-3 rounded-full hover:bg-[#C17B68]/8 cursor-pointer block">
                    <span className="text-base text-[#3D3632]">9</span>
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B8CAB0]"></div>
                  </Link>
                  <Link href="/diary-detail-web" className="text-center relative pt-3 pb-3 rounded-full hover:bg-[#C17B68]/8 cursor-pointer block">
                    <span className="text-base text-[#3D3632]">10</span>
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B8CAB0]"></div>
                  </Link>
                  <Link href="/diary-detail-web" className="text-center relative pt-3 pb-3 rounded-full hover:bg-[#C17B68]/8 cursor-pointer block">
                    <span className="text-base text-[#3D3632]">11</span>
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B8CAB0]"></div>
                  </Link>
                  <Link href="/diary-detail-web" className="text-center relative pt-3 pb-3 rounded-full hover:bg-[#C17B68]/8 cursor-pointer block">
                    <span className="text-base text-[#3D3632]">12</span>
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B8CAB0]"></div>
                  </Link>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">13</div>

                  {/* Week 3 - Current Week */}
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">14</div>
                  <div className="text-center pt-3 pb-3 rounded-full bg-[#C17B68] text-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.25)]">
                    <span className="text-base font-semibold">15</span>
                  </div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">16</div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">17</div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">18</div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">19</div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">20</div>

                  {/* Week 4 */}
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">21</div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">22</div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">23</div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">24</div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">25</div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">26</div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">27</div>

                  {/* Week 5 */}
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">28</div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">29</div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">30</div>
                  <div className="text-base text-center pt-3 pb-3 rounded-full text-[#3D3632] hover:bg-[#C17B68]/8 cursor-pointer">31</div>
                  <div className="text-base text-center pt-3 pb-3 text-[#C4BCB6]">1</div>
                  <div className="text-base text-center pt-3 pb-3 text-[#C4BCB6]">2</div>
                  <div className="text-base text-center pt-3 pb-3 text-[#C4BCB6]">3</div>
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
                <button className="flex justify-center items-center gap-2 w-full py-4 px-6 rounded-full bg-[#C17B68] text-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.25)] hover:shadow-[0_4px_12px_rgba(193,123,104,0.35)] transition-shadow">
                  <Edit3 className="text-lg" size={18} />
                  <span className="text-lg whitespace-nowrap font-semibold">日記を作成</span>
                </button>
              </div>

              {/* Monthly Statistics */}
              <div className="p-6 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
                <h3 className="text-xl mb-6 font-semibold text-[#3D3632]">今月の統計</h3>
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-base text-[#6B5F58]">記録日数</span>
                    <span className="text-lg font-semibold text-[#3D3632]">12日</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-base text-[#6B5F58]">平均感情スコア</span>
                    <span className="text-lg font-semibold text-[#3D3632]">7.2</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-base text-[#6B5F58]">最長継続</span>
                    <span className="text-lg font-semibold text-[#3D3632]">5日</span>
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
