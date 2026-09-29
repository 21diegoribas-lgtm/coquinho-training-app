import React, { useState } from 'react';
import {
  Edit3,
  RotateCw,
  Eye,
  EyeOff,
  Play,
  Pause,
  CheckCircle2,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Exercise } from '../types/session';
import { PitchDiagram } from './PitchDiagram';

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
  onEdit: (exercise: Exercise) => void;
  onRegenerate: (exercise: Exercise) => void;
  isSelected?: boolean;
  onAnimateClick?: (exerciseName: string) => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  index,
  onEdit,
  onRegenerate,
  isSelected = false,
  onAnimateClick,
}) => {
  const [showPitchBoard, setShowPitchBoard] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleToggleAnimate = () => {
    const nextState = !isSimulating;
    setIsSimulating(nextState);
    if (onAnimateClick) {
      onAnimateClick(exercise.exerciseName);
    }
  };

  return (
    <article
      id={`block-${exercise.id}`}
      className={`rounded-xl border bg-white transition-all shadow-xs print-break-inside-avoid ${
        isSelected ? 'border-stone-900 ring-2 ring-stone-900/10' : 'border-stone-200'
      }`}
    >
      {/* 1. TIÊU ĐỀ GIAI ĐOẠN & THÔNG TIN BÀI TẬP */}
      <div className="flex flex-col gap-3 border-b border-stone-100 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          {/* GIAI ĐOẠN 01 · KHỞI ĐỘNG */}
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-stone-500">
            <span>GIAI ĐOẠN 0{index + 1}</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span className="font-bold text-[#164336]">{exercise.blockName.toUpperCase()}</span>
          </div>

          {/* Tên bài tập */}
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 leading-snug">
            {exercise.exerciseName}
          </h3>

          {/* Thông số nhanh: 15 phút · 16 Cầu thủ · 25 × 20 m */}
          <div className="flex flex-wrap items-center gap-x-2.5 font-mono text-xs text-stone-600">
            <span className="font-bold text-stone-900">{exercise.duration} phút</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span>{exercise.playersCount}</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span className="text-stone-700">{exercise.areaSize}</span>
          </div>
        </div>

        {/* Các nút thao tác */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center no-print shrink-0">
          <button
            type="button"
            onClick={() => setShowPitchBoard(!showPitchBoard)}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50 transition-colors"
            title={showPitchBoard ? 'Ẩn sơ đồ sân' : 'Xem sơ đồ sân'}
          >
            {showPitchBoard ? (
              <>
                <EyeOff className="h-3.5 w-3.5 text-stone-500" />
                <span>Ẩn sơ đồ</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 text-stone-500" />
                <span>Sơ đồ sân</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onRegenerate(exercise)}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50 transition-colors"
            title="Đổi bài tập khác cho giai đoạn này"
          >
            <RotateCw className="h-3.5 w-3.5 text-stone-500" />
            <span>Biến thể</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit(exercise)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#121316] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-stone-800 transition-colors shadow-2xs"
            title="Chỉnh sửa nội dung bài tập"
          >
            <Edit3 className="h-3.5 w-3.5 text-white" />
            <span>Chỉnh sửa bài tập</span>
          </button>
        </div>
      </div>

      {/* 2. BỐ CỤC NỘI DUNG BÀI TẬP: 2 CỘT TRÊN DESKTOP, 1 CỘT TRÊN MOBILE */}
      <div className="p-5 sm:p-6">
        <div
          className={`grid grid-cols-1 ${
            showPitchBoard && exercise.pitchDiagram ? 'lg:grid-cols-12' : ''
          } gap-6 lg:gap-8`}
        >
          {/* CỘT TRÁI: SƠ ĐỒ BÀI TẬP (Desktop: 5 cột / Mobile: full width) */}
          {showPitchBoard && exercise.pitchDiagram && (
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#164336]" />
                  <span>SƠ ĐỒ BÀI TẬP</span>
                </div>

                {/* Nút mô phỏng bài tập */}
                <button
                  type="button"
                  onClick={handleToggleAnimate}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all no-print ${
                    isSimulating
                      ? 'bg-[#164336] text-white shadow-xs'
                      : 'border border-stone-200 bg-stone-50 text-stone-700 hover:border-[#164336] hover:text-[#164336]'
                  }`}
                  title="Xem thử mô phỏng di chuyển cầu thủ và đường bóng 2D"
                >
                  {isSimulating ? (
                    <>
                      <Pause className="h-3.5 w-3.5 fill-white" />
                      <span>Tạm dừng</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current text-[#164336]" />
                      <span>Mô phỏng bài tập</span>
                    </>
                  )}
                </button>
              </div>

              {/* Khung sơ đồ sân: giữ đúng tỷ lệ 16:10 tự nhiên, max-width hợp lý, không bao giờ bị kéo bẹt */}
              <div className="w-full max-w-lg mx-auto">
                <PitchDiagram
                  data={exercise.pitchDiagram}
                  isSimulating={isSimulating}
                />
              </div>

              {/* Thông báo mô phỏng */}
              {isSimulating && (
                <div className="flex items-center justify-between rounded bg-stone-100 px-3 py-1.5 text-xs text-stone-600 no-print">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Mô phỏng 2D: Đang chạy quỹ đạo di chuyển & chuyền bóng.</span>
                  </span>
                </div>
              )}

              {/* DỤNG CỤ TẬP LUYỆN */}
              <div className="space-y-1.5 pt-2 border-t border-stone-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-stone-400" />
                  <span>DỤNG CỤ</span>
                </h4>
                <div className="flex flex-wrap gap-1.5 text-xs text-stone-700">
                  {exercise.equipment.map((item, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded bg-stone-100 px-2.5 py-1 font-medium"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#164336]" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CỘT PHẢI: THÔNG TIN CHI TIẾT BÀI TẬP (Desktop: 7 cột nếu có sơ đồ, hoặc 12 cột nếu ẩn sơ đồ) */}
          <div
            className={`${
              showPitchBoard && exercise.pitchDiagram ? 'lg:col-span-7' : 'max-w-4xl'
            } space-y-5`}
          >
            {/* TỔ CHỨC & BỐ TRÍ */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-[#164336]" />
                <span>TỔ CHỨC & BỐ TRÍ</span>
              </h4>
              <p className="text-sm leading-relaxed text-stone-700">
                {exercise.organization}
              </p>
            </div>

            {/* CÁCH VẬN HÀNH */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                CÁCH VẬN HÀNH
              </h4>
              <ol className="space-y-2 text-sm text-stone-700">
                {exercise.howItWorks.map((step, sIdx) => (
                  <li key={sIdx} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 font-mono text-[11px] font-bold text-stone-800 mt-0.5">
                      {sIdx + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Nếu sơ đồ bị ẩn, hiển thị dụng cụ ở đây */}
            {(!showPitchBoard || !exercise.pitchDiagram) && (
              <div className="space-y-1.5 pt-2 border-t border-stone-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-stone-400" />
                  <span>DỤNG CỤ</span>
                </h4>
                <div className="flex flex-wrap gap-1.5 text-xs text-stone-700">
                  {exercise.equipment.map((item, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded bg-stone-100 px-2.5 py-1 font-medium"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#164336]" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ĐIỂM HUẤN LUYỆN (Trọng tâm cốt lõi cho HLV cộng đồng) */}
            <div className="rounded-xl border-l-4 border-[#164336] bg-stone-50 p-4 sm:p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-stone-200/70 pb-2">
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[#164336] flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#164336]" />
                  <span>ĐIỂM HUẤN LUYỆN</span>
                </h4>
                <span className="text-[11px] font-medium text-stone-500">Trọng tâm HLV</span>
              </div>

              <ul className="space-y-2 text-sm text-stone-900">
                {exercise.coachingPoints.map((point, pIdx) => (
                  <li key={pIdx} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#164336]" />
                    <span className="leading-snug font-medium">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Gợi ý Biến thể / Phát triển bài tập */}
            <div className="rounded-lg border border-stone-200 bg-white p-3.5 text-xs text-stone-600 space-y-1">
              <div className="font-mono font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#164336]" />
                <span>PHÁT TRIỂN BÀI TẬP</span>
              </div>
              <p className="leading-relaxed">
                Điều chỉnh độ khó: giới hạn số lần chạm bóng (1-2 chạm), thu hẹp hoặc mở rộng diện tích sân, hoặc bổ sung cầu thủ phòng ngự áp sát để tăng tính thực chiến.
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
