'use client';

export function EmotionChart() {
  return (
    <section className="mb-4 px-4">
      <div className="bg-[#FFFDFB] p-5 rounded-2xl shadow-[0_4px_12px_rgba(61,51,48,0.08)]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold text-[#3D3330]">今日の感情推移</h3>
          <span className="text-sm text-[#6B5F5A]">12月25日</span>
        </div>

        <div className="relative">
          {/* Placeholder for chart - can be replaced with actual chart library */}
          <div className="w-full h-[180px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
            <span className="text-sm text-gray-500">感情推移グラフ</span>
          </div>

          <div className="absolute top-0 left-0 flex flex-col justify-between h-full pt-6 pb-6">
            <span className="text-xs text-[#9A8D88] -rotate-90 origin-center">POSITIVE</span>
            <span className="text-xs text-[#9A8D88] -rotate-90 origin-center">NEGATIVE</span>
          </div>
        </div>
      </div>
    </section>
  );
}
