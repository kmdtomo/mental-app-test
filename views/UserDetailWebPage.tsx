'use client';

import { WebSidebar } from '@/components/navigation/WebSidebar';
import { Mail, Calendar, Camera, BookOpen, Mic, CalendarDays, TrendingUp } from 'lucide-react';

export function UserDetailWebPage() {
  return (
    <div className="flex w-[1440px] h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
      {/* Sidebar */}
      <WebSidebar activeItem="settings" />

      {/* Main Content */}
      <main className="overflow-x-hidden overflow-y-auto grow shrink bg-[#FBF7F3] h-full">
        <div className="py-8 px-12">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl mb-2 font-semibold text-[#3D3632]">ユーザー詳細</h1>
            <p className="text-lg text-[#6B5F58]">アカウント情報と設定を管理できます</p>
          </div>

          {/* Profile Card */}
          <div className="mb-8 p-8 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
            <div className="flex items-center gap-6">
              <img
                src="https://static.paraflowcontent.com/public/resource/image/87c564b8-b201-432c-9ae9-ae2c061c3b1d.jpeg"
                alt="Large profile"
                className="w-20 h-20 object-cover rounded-full shadow-[0_2px_8px_rgba(193,123,104,0.15)]"
              />
              <div className="grow shrink">
                <h2 className="text-2xl mb-2 font-semibold text-[#3D3632]">田中 太郎</h2>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Mail className="text-base text-[#6B5F58]" size={20} />
                    <span className="text-lg text-[#6B5F58]">tanaka.taro@example.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="text-base text-[#6B5F58]" size={20} />
                    <span className="text-lg text-[#6B5F58]">登録日: 2023年8月15日</span>
                  </div>
                </div>
              </div>
              <button className="flex justify-center items-center gap-2 py-3 px-6 rounded-full bg-white/70 text-[#C17B68] shadow-[0_2px_6px_rgba(193,123,104,0.12)] hover:shadow-[0_4px_12px_rgba(193,123,104,0.35)] transition-shadow">
                <Camera className="text-lg" size={18} />
                <span className="text-lg whitespace-nowrap font-semibold">写真を変更</span>
              </button>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-3 gap-8">
            {/* Left Column - 2/3 width */}
            <div className="col-span-2 flex flex-col gap-8">
              {/* Usage Statistics */}
              <div className="p-8 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
                <h3 className="text-2xl mb-6 font-semibold text-[#3D3632]">利用統計</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center gap-4">
                    <div className="flex justify-center items-center w-12 h-12 rounded-full bg-[#C17B68]/20">
                      <BookOpen className="text-xl text-[#C17B68]" size={20} />
                    </div>
                    <div>
                      <div className="text-2xl font-semibold text-[#3D3632]">85</div>
                      <div className="text-base text-[#6B5F58]">総日記数</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex justify-center items-center w-12 h-12 rounded-full bg-[#B8CAB0]/20">
                      <Mic className="text-xl text-[#B8CAB0]" size={20} />
                    </div>
                    <div>
                      <div className="text-2xl font-semibold text-[#3D3632]">42</div>
                      <div className="text-base text-[#6B5F58]">総録音回数</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex justify-center items-center w-12 h-12 rounded-full bg-[#A8B89F]/20">
                      <CalendarDays className="text-xl text-[#A8B89F]" size={20} />
                    </div>
                    <div>
                      <div className="text-2xl font-semibold text-[#3D3632]">153</div>
                      <div className="text-base text-[#6B5F58]">利用開始日からの日数</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex justify-center items-center w-12 h-12 rounded-full bg-[#D49B8E]/20">
                      <TrendingUp className="text-xl text-[#D49B8E]" size={20} />
                    </div>
                    <div>
                      <div className="text-2xl font-semibold text-[#3D3632]">5</div>
                      <div className="text-base text-[#6B5F58]">連続記録日数</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - 1/3 width */}
            <div className="col-span-1 flex flex-col gap-8">
              {/* Emotion Trend Chart */}
              <div className="p-6 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-[#3D3632]">感情推移</h3>
                  <div className="flex items-center gap-2">
                    <button className="py-1 px-3 rounded-full text-[#C17B68] text-base font-semibold hover:bg-[#C17B68]/8">
                      週次
                    </button>
                    <button className="py-1 px-3 rounded-full text-[#6B5F58] text-base hover:bg-[#C17B68]/8">
                      月次
                    </button>
                  </div>
                </div>

                <div className="flex justify-center items-center h-64">
                  <div className="w-[300px] h-[240px] bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-500">
                    感情推移グラフ
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
