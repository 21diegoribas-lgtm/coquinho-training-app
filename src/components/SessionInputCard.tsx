import React, { useState, useEffect } from 'react';
import { Users, Clock, Target, Play, RotateCw, AlertCircle, Shield } from 'lucide-react';
import { GameFormat, SessionDuration } from '../types/session';

interface SessionInputCardProps {
  onGenerate: (topic: string, players: number, duration: SessionDuration, gameFormat: GameFormat) => void;
  isGenerating?: boolean;
  errorMessage?: string | null;
  onClearError?: () => void;
  initialGameFormat?: GameFormat;
}

export const GAME_FORMAT_OPTIONS: GameFormat[] = ['Futsal 5v5', '7v7', '9v9', '11v11'];

const TOPIC_PRESETS = [
  'Nhận bóng với tư thế mở & Quan sát',
  'Phòng ngự 1v1, kìm hãm & tắc bóng',
  'Pressing tầm cao & Cự ly đội hình',
  'Phối hợp chuyền bóng & Chạy chỗ người thứ 3',
  'Chuyển trạng thái tấn công nhanh khi đoạt bóng',
  'Tạt cánh & Dứt điểm trong vòng cấm',
];

export const SessionInputCard: React.FC<SessionInputCardProps> = ({
  onGenerate,
  isGenerating = false,
  errorMessage = null,
  onClearError,
  initialGameFormat = '7v7',
}) => {
  const [topic, setTopic] = useState('Nhận bóng với tư thế mở & Quan sát');
  const [playerCount, setPlayerCount] = useState<number>(16);
  const [gameFormat, setGameFormat] = useState<GameFormat>(initialGameFormat);
  const [duration, setDuration] = useState<SessionDuration>(90);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (initialGameFormat) {
      setGameFormat(initialGameFormat);
    }
  }, [initialGameFormat]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (onClearError) onClearError();

    const cleanTopic = topic.trim();
    if (!cleanTopic) {
      setValidationError('Nội dung tập luyện không được để trống.');
      return;
    }

    if (isNaN(playerCount) || playerCount < 4) {
      setValidationError('Cần tối thiểu 4 cầu thủ để xây dựng giáo án.');
      return;
    }

    if (playerCount > 50) {
      setValidationError('Số lượng cầu thủ tối đa là 50 để đảm bảo chất lượng bài tập.');
      return;
    }

    if (![60, 75, 90].includes(duration)) {
      setValidationError('Thời lượng buổi tập phải là 60, 75 hoặc 90 phút.');
      return;
    }

    setValidationError(null);
    onGenerate(cleanTopic, playerCount, duration, gameFormat);
  };

  const handlePlayerChange = (val: number) => {
    const clamped = Math.max(4, Math.min(50, isNaN(val) ? 4 : val));
    setPlayerCount(clamped);
    if (validationError) setValidationError(null);
    if (errorMessage && onClearError) onClearError();
  };

  const handleTopicChange = (val: string) => {
    setTopic(val);
    if (validationError) setValidationError(null);
    if (errorMessage && onClearError) onClearError();
  };

  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs">
      <div className="mb-6 border-b border-stone-100 pb-4">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
          Tạo giáo án buổi tập
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Nhập số lượng cầu thủ và nội dung tập luyện để tự động tạo giáo án theo tiến trình phù hợp với mục tiêu buổi tập.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-12">
          {/* 1. Số lượng cầu thủ */}
          <div className="sm:col-span-1 lg:col-span-4">
            <label
              htmlFor="players-input"
              className="block text-xs font-bold uppercase tracking-wider text-stone-700"
            >
              1. Số lượng cầu thủ <span className="text-red-500">*</span>
            </label>
            <div className="mt-2 relative flex items-center">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-400">
                <Users className="h-4 w-4" />
              </div>
              <input
                id="players-input"
                type="number"
                min={4}
                max={50}
                value={playerCount}
                disabled={isGenerating}
                onChange={(e) => handlePlayerChange(parseInt(e.target.value, 10))}
                className="block w-full rounded-md border border-stone-300 bg-white py-2.5 pl-10 pr-16 text-base font-semibold text-stone-900 shadow-2xs focus:border-[#164336] focus:ring-1 focus:ring-[#164336] focus:outline-hidden tabular-nums disabled:bg-stone-50 disabled:text-stone-400"
                placeholder="16"
                required
              />
              <div className="absolute inset-y-0 right-1 flex items-center gap-1 pr-1.5">
                <button
                  type="button"
                  onClick={() => handlePlayerChange(playerCount - 1)}
                  disabled={isGenerating || playerCount <= 4}
                  className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30 font-bold"
                  aria-label="Giảm cầu thủ"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => handlePlayerChange(playerCount + 1)}
                  disabled={isGenerating || playerCount >= 50}
                  className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30 font-bold"
                  aria-label="Tăng cầu thủ"
                >
                  +
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-stone-500">Tối thiểu 4 cầu thủ, tối đa 50 (ví dụ: 16)</p>
          </div>

          {/* 2. Loại hình thi đấu */}
          <div className="sm:col-span-1 lg:col-span-8">
            <label
              className="block text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1"
            >
              <Shield className="h-3.5 w-3.5 text-stone-400" />
              2. Loại hình thi đấu
            </label>
            <div className="mt-2 inline-flex w-full rounded-lg border border-stone-200 bg-stone-100 p-0.5" role="group">
              {GAME_FORMAT_OPTIONS.map((fmt) => {
                const isSelected = gameFormat === fmt;
                return (
                  <button
                    key={fmt}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => {
                      setGameFormat(fmt);
                      if (onClearError) onClearError();
                    }}
                    className={`flex-1 rounded-md py-2.5 px-2 text-center text-xs font-bold transition-all disabled:opacity-50 ${
                      isSelected
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {fmt}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-stone-500">Mặc định: 7v7</p>
          </div>

          {/* 3. Nội dung tập luyện */}
          <div className="sm:col-span-2 lg:col-span-12">
            <label
              htmlFor="topic-input"
              className="block text-xs font-bold uppercase tracking-wider text-stone-700"
            >
              3. Nội dung tập luyện <span className="text-red-500">*</span>
            </label>
            <div className="mt-2 relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-400">
                <Target className="h-4 w-4" />
              </div>
              <input
                id="topic-input"
                type="text"
                value={topic}
                disabled={isGenerating}
                onChange={(e) => handleTopicChange(e.target.value)}
                className="block w-full rounded-md border border-stone-300 bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-stone-900 shadow-2xs focus:border-[#164336] focus:ring-1 focus:ring-[#164336] focus:outline-hidden disabled:bg-stone-50 disabled:text-stone-400"
                placeholder="Ví dụ: Nhận bóng với tư thế mở"
                required
              />
            </div>

            {/* Các chủ đề mẫu */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-stone-400 mr-1">Chủ đề gợi ý:</span>
              {TOPIC_PRESETS.map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => handleTopicChange(item)}
                  className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                    topic.toLowerCase() === item.toLowerCase()
                      ? 'border-[#164336] bg-[#164336] text-white'
                      : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Thời lượng buổi tập & Nút tạo giáo án */}
        <div className="flex flex-col gap-4 pt-3 sm:flex-row sm:items-center sm:justify-between border-t border-stone-100">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-stone-400" />
              4. Thời lượng buổi tập:
            </span>
            <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5" role="group">
              {([60, 75, 90] as SessionDuration[]).map((d) => {
                const isSelected = duration === d;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => {
                      setDuration(d);
                      if (onClearError) onClearError();
                    }}
                    className={`rounded-md px-3.5 py-1.5 font-mono text-xs font-bold transition-all tabular-nums disabled:opacity-50 ${
                      isSelected
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {d} phút {d === 90 && <span className="font-normal text-stone-400">(Mặc định)</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#164336] px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#10352a] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Đang xây dựng giáo án...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-white" />
                <span>Tạo giáo án</span>
              </>
            )}
          </button>
        </div>

        {/* Trạng thái đang tải */}
        {isGenerating && (
          <div className="flex items-center gap-2.5 rounded-lg border border-[#164336]/20 bg-[#164336]/5 p-3.5 text-xs text-[#164336] font-medium">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#164336] border-t-transparent" />
            <span>Đang xây dựng giáo án... Vui lòng đợi trong giây lát.</span>
          </div>
        )}

        {/* Lỗi xác thực phía client */}
        {validationError && (
          <div className="rounded-md bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Lỗi từ Gemini API kèm nút "Thử lại" */}
        {errorMessage && (
          <div className="rounded-lg bg-red-50 p-4 border border-red-200 text-xs font-medium text-red-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors shrink-0"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
