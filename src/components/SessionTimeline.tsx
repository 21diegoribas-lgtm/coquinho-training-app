import React from 'react';
import { Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Exercise } from '../types/session';

interface SessionTimelineProps {
  blocks: Exercise[];
  totalDuration: number;
  onSelectBlock?: (blockId: string) => void;
  activeBlockId?: string;
}

const BLOCK_COLORS: Record<
  Exercise['blockType'],
  { barColor: string; name: string }
> = {
  warm_up: {
    barColor: 'bg-amber-600',
    name: 'Khởi động',
  },
  technical: {
    barColor: 'bg-blue-600',
    name: 'Kỹ thuật',
  },
  skill: {
    barColor: 'bg-indigo-600',
    name: 'Phát triển kỹ năng',
  },
  small_sided: {
    barColor: 'bg-[#164336]', // Pitch green
    name: 'Trò chơi đối kháng',
  },
  match: {
    barColor: 'bg-stone-900',
    name: 'Thi đấu',
  },
};

export const SessionTimeline: React.FC<SessionTimelineProps> = ({
  blocks,
  totalDuration,
  onSelectBlock,
  activeBlockId,
}) => {
  const currentTotal = blocks.reduce((acc, b) => acc + (Number(b.duration) || 0), 0);
  const isValidDuration = currentTotal === totalDuration;

  let cumulativeTime = 0;
  const blocksWithTime = blocks.map((b) => {
    const start = cumulativeTime;
    cumulativeTime += Number(b.duration) || 0;
    const end = cumulativeTime;
    return { ...b, startMinute: start, endMinute: end };
  });

  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#164336]" />
            <span>Tiến trình buổi tập ({totalDuration} phút)</span>
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            {blocks.length} giai đoạn huấn luyện tuần tự đảm bảo đúng cấu trúc giáo án
          </p>
        </div>

        <div className="flex items-center text-xs font-semibold">
          {isValidDuration ? (
            <span className="flex items-center gap-1.5 rounded bg-emerald-50 px-2.5 py-1 text-emerald-800 border border-emerald-200 font-mono">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>{currentTotal} / {totalDuration} phút (100% khớp)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded bg-amber-50 px-2.5 py-1 text-amber-800 border border-amber-200 font-mono">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>{currentTotal} / {totalDuration} phút ({currentTotal > totalDuration ? `thừa +${currentTotal - totalDuration}` : `thiếu -${totalDuration - currentTotal}`} phút)</span>
            </span>
          )}
        </div>
      </div>

      {/* Thanh tiến trình đa màu sắc */}
      <div className="relative mt-2">
        <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200/80">
          {blocksWithTime.map((block) => {
            const pct = ((Number(block.duration) || 0) / (currentTotal || totalDuration)) * 100;
            const style = BLOCK_COLORS[block.blockType];
            const isActive = activeBlockId === block.id;

            return (
              <button
                key={block.id}
                type="button"
                onClick={() => onSelectBlock && onSelectBlock(block.id)}
                title={`${block.blockName}: ${block.duration} phút (${block.startMinute}' - ${block.endMinute}')`}
                style={{ width: `${pct}%` }}
                className={`h-full transition-opacity hover:opacity-85 ${style.barColor} ${
                  isActive ? 'ring-2 ring-stone-900 ring-offset-1 z-10' : ''
                }`}
              />
            );
          })}
        </div>

        {/* Các mốc thời gian */}
        <div className="mt-1.5 flex justify-between font-mono text-[11px] text-stone-400 tabular-nums">
          <span>0&apos; (Bắt đầu)</span>
          {blocksWithTime.filter(block => /nghỉ|\brest\b|half[ -]?time/i.test(block.blockName)).map(block => (
            <span key={block.id}>{block.startMinute}&apos; ({block.blockName})</span>
          ))}
          <span>{currentTotal}&apos; (Kết thúc)</span>
        </div>
      </div>

      {/* Thẻ tóm tắt các giai đoạn thực tế */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {blocksWithTime.map((block, idx) => {
          const style = BLOCK_COLORS[block.blockType];
          const isActive = activeBlockId === block.id;

          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onSelectBlock && onSelectBlock(block.id)}
              className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                isActive
                  ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900 shadow-xs'
                  : 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50/50'
              }`}
            >
              <div className="flex w-full items-center justify-between font-mono text-[11px] text-stone-500 tabular-nums">
                <span className="font-semibold text-stone-700">0{idx + 1}.</span>
                <span>{block.startMinute}&apos;–{block.endMinute}&apos;</span>
              </div>
              <div className="mt-1 text-xs font-bold text-stone-900 line-clamp-1">
                {block.blockName}
              </div>
              <div className="mt-0.5 font-mono text-[11px] font-semibold text-[#164336] tabular-nums">
                {block.duration} phút
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
