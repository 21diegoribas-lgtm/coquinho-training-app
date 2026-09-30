import React, { useState } from 'react';
import {
  Bookmark,
  RotateCw,
  Copy,
  Check,
  Users,
  Clock,
  Target,
  Package,
} from 'lucide-react';
import { TrainingSession } from '../types/session';
import { sumBlockDurations } from '../services/durationUtils';

interface SessionSummaryHeaderProps {
  session: TrainingSession;
  onSave: () => void;
  onRegenerate: () => void;
  isSaved?: boolean;
}

export const SessionSummaryHeader: React.FC<SessionSummaryHeaderProps> = ({
  session,
  onSave,
  onRegenerate,
  isSaved = false,
}) => {
  const [copied, setCopied] = useState(false);
  const accountedDuration = sumBlockDurations(session.blocks);

  // Tổng hợp danh mục dụng cụ cần dùng cho toàn bộ buổi tập
  const allEquipment = Array.from(
    new Set(session.blocks.flatMap((b) => b.equipment))
  );

  const handleCopySummary = async () => {
    const text = `COQUINHO // Nguyễn Thanh Tú — Huấn luyện viên bóng đá
GIÁO ÁN BUỔI TẬP: ${session.title}
Chủ đề: ${session.topic}
Số lượng: ${session.playerCount} Cầu thủ
Thời lượng: ${accountedDuration} Phút

MỤC TIÊU BUỔI TẬP:
${session.objective}

CẤU TRÚC 5 GIAI ĐOẠN:
${session.blocks
  .map(
    (b, i) =>
      `GIAI ĐOẠN 0${i + 1} [${b.blockName.toUpperCase()}] — ${b.duration} phút\n` +
      `  Bài tập: ${b.exerciseName}\n` +
      `  Sân bãi & Quân số: ${b.areaSize} | ${b.playersCount}\n` +
      `  Điểm huấn luyện: ${b.coachingPoints.slice(0, 2).join('; ')}`
  )
  .join('\n\n')}

DỤNG CỤ CẦN CHUẨN BỊ:
${allEquipment.map((e) => `• ${e}`).join('\n')}
`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        {/* Tiêu đề giáo án, Thông số & Mục tiêu */}
        <div className="space-y-3 max-w-3xl">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold text-stone-500 uppercase">
            <span>GIÁO ÁN HUẤN LUYỆN</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span>Ngày tạo: {session.createdAt}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 leading-tight">
            {session.title}
          </h1>

          {/* Thông số nhanh */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-xs text-stone-600">
            <span className="flex items-center gap-1.5 font-bold text-stone-900">
              <Users className="h-4 w-4 text-stone-500" />
              {session.playerCount} CẦU THỦ
            </span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span className="flex items-center gap-1.5 font-bold text-[#164336]">
              <Clock className="h-4 w-4 text-[#164336]" />
              {accountedDuration} PHÚT TOÀN BUỔI
            </span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span className="flex items-center gap-1.5 font-sans text-stone-700">
              <Target className="h-4 w-4 text-stone-400" />
              <span className="font-medium">Chủ đề: {session.topic}</span>
            </span>
          </div>

          {/* Khối mục tiêu buổi tập */}
          <div className="mt-3 rounded-lg border-l-4 border-[#164336] bg-stone-50 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
              Mục tiêu buổi tập
            </h4>
            <p className="text-sm leading-relaxed text-stone-800 font-medium">
              {session.objective}
            </p>
          </div>
        </div>

        {/* Nút hành động */}
        <div className="flex flex-wrap items-center gap-2 self-start no-print shrink-0">
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50 transition-colors"
            title="Đổi biến thể bài tập mới cho giáo án này"
          >
            <RotateCw className="h-3.5 w-3.5 text-stone-500" />
            <span>Tạo lại</span>
          </button>

          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50 transition-colors"
            title="Sao chép toàn bộ nội dung giáo án dạng văn bản"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#164336]" />
                <span className="text-[#164336] font-semibold">Đã sao chép!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-stone-500" />
                <span>Sao chép giáo án</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onSave}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-all shadow-xs ${
              isSaved
                ? 'border border-[#164336]/40 bg-[#164336]/10 text-[#164336]'
                : 'bg-[#164336] text-white hover:bg-[#10352a]'
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-[#164336]' : ''}`} />
            <span>{isSaved ? 'Đã lưu giáo án' : 'Lưu giáo án'}</span>
          </button>
        </div>
      </div>

      {/* Danh mục dụng cụ kiểm tra nhanh */}
      <div className="mt-5 border-t border-stone-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-600">
          <Package className="h-4 w-4 text-[#164336]" />
          <span>Dụng cụ cần chuẩn bị:</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600 font-medium">
          {allEquipment.map((eq, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
              <span>{eq}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
