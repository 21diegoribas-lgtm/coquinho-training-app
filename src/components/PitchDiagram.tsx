import React from 'react';
import { PitchDiagramData, PitchPlayer } from '../types/session';

interface PitchDiagramProps {
  data?: PitchDiagramData;
  className?: string;
  isSimulating?: boolean;
  highlightPlayerId?: string;
}

export const PitchDiagram: React.FC<PitchDiagramProps> = ({
  data,
  className = '',
  isSimulating = false,
  highlightPlayerId,
}) => {
  if (!data) return null;

  const { players = [], cones = [], goals = [], arrows = [], ball, coachingCueOverlay } = data;

  // Chuyển đổi tọa độ phần trăm (0..100) sang hệ tọa độ logic chuẩn 1600 x 1000 (tỷ lệ chuẩn sân 16:10)
  const toX = (pct: number) => (pct / 100) * 1600;
  const toY = (pct: number) => (pct / 100) * 1000;

  const getPlayerFill = (role: PitchPlayer['role']) => {
    switch (role) {
      case 'teamA':
        return '#ffffff'; // Đội A - Áo trắng
      case 'teamB':
        return '#0f172a'; // Đội B - Áo xanh đen/navy
      case 'neutral':
        return '#f59e0b'; // Cầu thủ tự do/trung gian - Vàng hổ phách
      case 'gk':
        return '#10b981'; // Thủ môn - Xanh lá sáng
      default:
        return '#f1f5f9';
    }
  };

  const getPlayerStroke = (role: PitchPlayer['role']) => {
    switch (role) {
      case 'teamA':
        return '#0f172a';
      case 'teamB':
        return '#ffffff';
      case 'neutral':
        return '#78350f';
      case 'gk':
        return '#064e3b';
      default:
        return '#334155';
    }
  };

  const getPlayerTextColor = (role: PitchPlayer['role']) => {
    switch (role) {
      case 'teamA':
        return '#0f172a';
      case 'teamB':
        return '#ffffff';
      case 'neutral':
        return '#451a03';
      case 'gk':
        return '#ffffff';
      default:
        return '#000000';
    }
  };

  const getConeFill = (color?: string) => {
    switch (color) {
      case 'yellow':
        return '#fbbf24';
      case 'white':
        return '#ffffff';
      case 'blue':
        return '#38bdf8';
      case 'orange':
      default:
        return '#ea580c';
    }
  };

  return (
    <div className={`drill-board-wrapper w-full max-w-full ${className}`}>
      {/* Khung sơ đồ với aspect-ratio 16:10 chuẩn tỷ lệ sân bóng tự nhiên, không méo hay bẹt trên mọi kích thước */}
      <div className="drill-board relative w-full aspect-[16/10] overflow-hidden rounded-lg border border-stone-300 bg-[#164336] shadow-sm select-none">
        <svg
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          aria-label="Sơ đồ chiến thuật sân bóng đá"
        >
          <defs>
            {/* Vân cỏ tự nhiên sọc ngang sân bóng */}
            <pattern id="turf-stripes-1610" width="1600" height="200" patternUnits="userSpaceOnUse">
              <rect width="1600" height="100" fill="#143d31" />
              <rect y="100" width="1600" height="100" fill="#18483a" />
            </pattern>

            {/* Mũi tên chuyền bóng (vàng) */}
            <marker
              id="tac-arrow-pass"
              viewBox="0 0 12 12"
              refX="8"
              refY="6"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 10 6 L 0 10.5 z" fill="#fde047" />
            </marker>

            {/* Mũi tên chạy chỗ không bóng (xanh dương đứt đoạn) */}
            <marker
              id="tac-arrow-run"
              viewBox="0 0 12 12"
              refX="8"
              refY="6"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 10 6 L 0 10.5 z" fill="#38bdf8" />
            </marker>

            {/* Mũi tên dẫn bóng (cam) */}
            <marker
              id="tac-arrow-dribble"
              viewBox="0 0 12 12"
              refX="8"
              refY="6"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 10 6 L 0 10.5 z" fill="#fb923c" />
            </marker>
          </defs>

          {/* LỚP 1: MẶT CỎ SÂN BÓNG */}
          <rect width="1600" height="1000" fill="url(#turf-stripes-1610)" />

          {/* Đường biên sân (canh lề đều 60px ngang, 40px dọc) */}
          <rect
            x="60"
            y="40"
            width="1480"
            height="920"
            fill="none"
            stroke="#ffffff"
            strokeWidth="5"
            strokeOpacity="0.55"
            rx="4"
          />

          {/* Đường giữa sân */}
          <line
            x1="60"
            y1="500"
            x2="1540"
            y2="500"
            stroke="#ffffff"
            strokeWidth="4"
            strokeOpacity="0.5"
          />

          {/* Vòng tròn trung tâm & điểm phát bóng */}
          <circle
            cx="800"
            cy="500"
            r="140"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeOpacity="0.5"
          />
          <circle cx="800" cy="500" r="7" fill="#ffffff" fillOpacity="0.8" />

          {/* Vòng cấm địa phía trên (Cầu môn trên) */}
          <rect
            x="460"
            y="40"
            width="680"
            height="180"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeOpacity="0.45"
          />
          {/* Khu vực 5m50 phía trên */}
          <rect
            x="610"
            y="40"
            width="380"
            height="65"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeOpacity="0.4"
          />
          <circle cx="800" cy="150" r="6" fill="#ffffff" fillOpacity="0.75" />

          {/* Vòng cấm địa phía dưới (Cầu môn dưới) */}
          <rect
            x="460"
            y="780"
            width="680"
            height="180"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeOpacity="0.45"
          />
          {/* Khu vực 5m50 phía dưới */}
          <rect
            x="610"
            y="895"
            width="380"
            height="65"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeOpacity="0.4"
          />
          <circle cx="800" cy="850" r="6" fill="#ffffff" fillOpacity="0.75" />

          {/* Cầu môn chính 2 đầu sân */}
          <rect
            x="670"
            y="24"
            width="260"
            height="16"
            fill="none"
            stroke="#ffffff"
            strokeWidth="5"
          />
          <rect
            x="670"
            y="960"
            width="260"
            height="16"
            fill="none"
            stroke="#ffffff"
            strokeWidth="5"
          />

          {/* Cầu môn mini hoặc mục tiêu bổ sung */}
          {goals.map((goal, idx) => {
            const gx = toX(goal.x);
            const gy = toY(goal.y);
            const gw = (goal.width || 18) * 16;
            return (
              <rect
                key={`goal-${idx}`}
                x={gx - gw / 2}
                y={gy - 10}
                width={gw}
                height="20"
                fill="none"
                stroke="#ffffff"
                strokeWidth="5"
                strokeDasharray={goal.isMini ? '8,6' : undefined}
              />
            );
          })}

          {/* LỚP 2: NÓN TẬP (CONES) */}
          {cones.map((c, idx) => {
            const cx = toX(c.x);
            const cy = toY(c.y);
            return (
              <polygon
                key={`cone-${idx}`}
                points={`${cx},${cy - 20} ${cx - 16},${cy + 16} ${cx + 16},${cy + 16}`}
                fill={getConeFill(c.color)}
                stroke="#1c1917"
                strokeWidth="2.5"
              />
            );
          })}

          {/* LỚP 3: ĐƯỜNG CHUYỀN & ĐƯỜNG CHẠY CHIẾN THUẬT */}
          {arrows.map((arr, idx) => {
            const x1 = toX(arr.from[0]);
            const y1 = toY(arr.from[1]);
            const x2 = toX(arr.to[0]);
            const y2 = toY(arr.to[1]);
            const strokeColor =
              arr.type === 'pass' ? '#fde047' : arr.type === 'run' ? '#38bdf8' : '#fb923c';
            const isDashed = arr.type === 'run';
            const markerEnd = `url(#tac-arrow-${arr.type})`;

            return (
              <line
                key={`arrow-${idx}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={strokeColor}
                strokeWidth="6"
                strokeDasharray={isDashed ? '12,9' : undefined}
                markerEnd={markerEnd}
                opacity="0.95"
                className={isSimulating ? 'animate-pulse' : ''}
              />
            );
          })}

          {/* LỚP 4: CẦU THỦ (ICON RÕ RÀNG, DỄ NHÌN, TỶ LỆ CHUẨN) */}
          {players.map((p, idx) => {
            const currentX = toX(isSimulating && p.targetX ? p.targetX : p.x);
            const currentY = toY(isSimulating && p.targetY ? p.targetY : p.y);
            const isHighlighted = p.highlight || highlightPlayerId === `p-${idx}`;

            return (
              <g
                key={`player-${idx}`}
                transform={`translate(${currentX}, ${currentY}) rotate(${p.rotation || 0})`}
                className="transition-all duration-1000 ease-in-out cursor-pointer"
              >
                {/* Vòng sáng nổi bật khi cần nhấn mạnh vị trí */}
                {isHighlighted && (
                  <circle
                    r="48"
                    fill="none"
                    stroke="#fde047"
                    strokeWidth="5"
                    strokeDasharray="10,6"
                    className="animate-spin"
                    style={{ animationDuration: '4s' }}
                  />
                )}

                {/* Vòng tròn thân cầu thủ */}
                <circle
                  r="34"
                  fill={getPlayerFill(p.role)}
                  stroke={getPlayerStroke(p.role)}
                  strokeWidth="5"
                  filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                />

                {/* Số áo / Ký hiệu vai trò */}
                {p.label && (
                  <text
                    textAnchor="middle"
                    dy="11"
                    fill={getPlayerTextColor(p.role)}
                    fontSize="26"
                    fontWeight="800"
                    fontFamily="Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
                  >
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* LỚP 5: QUẢ BÓNG */}
          {ball && (
            <g
              transform={`translate(${toX(ball.x)}, ${toY(ball.y)})`}
              className={`transition-all duration-700 ease-out ${
                isSimulating ? 'translate-x-12 -translate-y-8' : ''
              }`}
            >
              <circle
                r="18"
                fill="#ffffff"
                stroke="#0f172a"
                strokeWidth="4"
                filter="drop-shadow(0 3px 5px rgba(0,0,0,0.5))"
              />
              <circle r="7" fill="#0f172a" />
            </g>
          )}

          {/* LỚP 6: DÒNG NHẮC HUẤN LUYỆN TRÊN SÂN */}
          {coachingCueOverlay && (
            <g transform="translate(800, 920)">
              <rect
                x="-350"
                y="-25"
                width="700"
                height="50"
                rx="10"
                fill="#000000"
                fillOpacity="0.8"
              />
              <text
                textAnchor="middle"
                dy="8"
                fill="#ffffff"
                fontSize="22"
                fontWeight="600"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                {coachingCueOverlay}
              </text>
            </g>
          )}
        </svg>

        {/* Chú thích màu sắc đội hình tiếng Việt */}
        <div className="absolute bottom-2.5 right-3 flex items-center gap-2.5 rounded bg-black/80 px-2.5 py-1 text-xs text-white/95 backdrop-blur-xs font-medium">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-stone-800 bg-white" />
            <span>Đội A</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-slate-900" />
            <span>Đội B</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span>Tự do</span>
          </span>
        </div>
      </div>
    </div>
  );
};
