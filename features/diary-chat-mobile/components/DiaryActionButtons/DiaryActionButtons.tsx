'use client';

import { BookText, History } from 'lucide-react';

export function DiaryActionButtons() {
  return (
    <div>
      <button className="flex justify-center items-center w-full mb-3 pt-4 pb-4 rounded-xl bg-[#C4856B] text-white/92 shadow-[0_4px_12px_rgba(61,51,48,0.08)] hover:bg-[#A86B53] transition-colors">
        <div className="flex items-center gap-2">
          <BookText className="text-xl" size={20} />
          <span className="text-base whitespace-nowrap font-semibold">日記を生成する</span>
        </div>
      </button>

      <button className="flex justify-center items-center w-full pt-4 pb-4 rounded-xl bg-[#FFF9F5] text-[#C4856B] shadow-[0_2px_8px_rgba(61,51,48,0.06)] hover:bg-[#FFFDFB] transition-colors">
        <div className="flex items-center gap-2">
          <History className="text-xl" size={20} />
          <span className="text-base whitespace-nowrap font-semibold">会話履歴を見る</span>
        </div>
      </button>
    </div>
  );
}
