'use client';

interface RecordingLimitIndicatorProps {
  remaining?: number;
  total?: number;
}

export function RecordingLimitIndicator({ remaining = 3, total = 5 }: RecordingLimitIndicatorProps) {
  return (
    <div className="mt-3 p-3 rounded-xl bg-[#C4856B]/8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#C4856B]"></div>
          <span className="text-sm text-[#6B5F5A]">録音残り回数</span>
        </div>
        <span className="text-sm font-semibold text-[#3D3330]">{remaining}回</span>
      </div>
    </div>
  );
}
