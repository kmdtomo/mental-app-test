'use client';

export function UserProfileCard() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-[20px] bg-white/70 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
      <img
        src="https://static.paraflowcontent.com/public/resource/image/5fe13763-0225-4a8c-966e-680486fc79aa.jpeg"
        alt="User profile"
        className="w-10 h-10 object-cover rounded-full shadow-[0_2px_6px_rgba(193,123,104,0.15)]"
      />
      <div className="grow shrink">
        <div className="text-lg font-semibold text-[#3D3632]">田中 太郎</div>
        <div className="text-base text-[#6B5F58]">プレミアム会員</div>
      </div>
    </div>
  );
}
