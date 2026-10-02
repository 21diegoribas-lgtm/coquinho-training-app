import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import {
  DiagramCoachingMoment,
  DiagramGoal,
  DiagramPlayer,
  PitchDiagramData,
  PitchPlayer,
  StructuredDrillDiagram,
} from '../types/session';
import {
  buildSemanticAnimation,
  buildWavyPath,
  calculateCameraViewBox,
  DEFAULT_POLISHED_MOTION_OPTIONS,
  formatCoachingOverlayText,
  getCoachingPhaseState,
  getCoachingSequenceProgress,
  getGoalGeometry,
  getSequenceTimelineMarkers,
  getTeamStyle,
  interpolateAnimationState,
  interpolateViewBox,
  reconstructPlayerOrientation,
  resolvePathCoordinates,
  shouldTriggerCoachingMoment,
  updateSeekTriggerState,
} from '../services/structuredDiagram';

interface PitchDiagramProps {
  data?: PitchDiagramData;
  diagram?: StructuredDrillDiagram;
  className?: string;
  isSimulating?: boolean;
  highlightPlayerId?: string;
}

export const PitchDiagram: React.FC<PitchDiagramProps> = ({
  data,
  diagram,
  className = '',
  isSimulating = false,
  highlightPlayerId,
}) => {
  // Ưu tiên sử dụng structured diagram (D1/D2); nếu không có thì fallback về pitchDiagram legacy
  const hasStructuredDiagram = Boolean(
    diagram &&
    Array.isArray(diagram.players) &&
    diagram.players.length > 0
  );

  if (!hasStructuredDiagram && !data) {
    return null;
  }

  if (hasStructuredDiagram && diagram) {
    return (
      <StructuredPitchDiagramView
        diagram={diagram}
        className={className}
        highlightPlayerId={highlightPlayerId}
        isSimulating={isSimulating}
      />
    );
  }

  return (
    <LegacyPitchDiagramView
      data={data!}
      className={className}
      isSimulating={isSimulating}
      highlightPlayerId={highlightPlayerId}
    />
  );
};

// =============================================================================
// NEW STRUCTURED DIAGRAM RENDERER (D2 / D4)
// =============================================================================
interface StructuredViewProps {
  diagram: StructuredDrillDiagram;
  className?: string;
  highlightPlayerId?: string;
  isSimulating?: boolean;
}

const StructuredPitchDiagramView: React.FC<StructuredViewProps> = ({
  diagram,
  className = '',
  highlightPlayerId,
  isSimulating = false,
}) => {
  // Hệ tọa độ logic chuẩn 1000 x 600 (tỷ lệ 5:3 khớp pitch width 100 / height 60)
  const toX = (pct: number) => {
    if (typeof pct !== 'number' || !Number.isFinite(pct)) return 500;
    return (Math.max(0, Math.min(100, pct)) / 100) * 1000;
  };

  const toY = (pct: number) => {
    if (typeof pct !== 'number' || !Number.isFinite(pct)) return 300;
    return (Math.max(0, Math.min(100, pct)) / 100) * 600;
  };

  // Derive or use existing animation sequence
  const effectiveAnimation = useMemo(() => {
    if (diagram.animation && Array.isArray(diagram.animation.steps) && diagram.animation.steps.length > 0) {
      return diagram.animation;
    }
    return buildSemanticAnimation(diagram);
  }, [diagram]);

  const [isPlaying, setIsPlaying] = useState<boolean>(Boolean(isSimulating));
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [activeCoachingMoment, setActiveCoachingMoment] = useState<DiagramCoachingMoment | null>(null);
  const [coachingElapsed, setCoachingElapsed] = useState<number>(0);
  const triggeredMomentsRef = useRef<Set<string>>(new Set());

  // Synchronize with external isSimulating prop from exercise card
  useEffect(() => {
    if (isSimulating !== undefined) {
      setIsPlaying(isSimulating);
      if (!isSimulating) {
        setCurrentTime(0);
        setActiveCoachingMoment(null);
        setCoachingElapsed(0);
        triggeredMomentsRef.current.clear();
      }
    }
  }, [isSimulating]);

  // Playback requestAnimationFrame loop with coaching moment freeze logic (TASK D5/D7B)
  useEffect(() => {
    if (!isPlaying || !effectiveAnimation || effectiveAnimation.duration <= 0) return;
    let animFrameId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (activeCoachingMoment) {
        // In coaching moment: drill animation visually freezes; presentation timer advances
        setCoachingElapsed((prev) => {
          const next = prev + dt;
          if (next >= activeCoachingMoment.duration) {
            // Presentation duration finished: exit freeze and resume normal animation
            setActiveCoachingMoment(null);
            return 0;
          }
          return next;
        });
      } else {
        // Normal animation progression
        setCurrentTime((prev) => {
          const next = prev + dt;

          // Check if natural playback reaches any un-triggered coaching moment
          const moments = effectiveAnimation.coachingMoments || [];
          const trigger = moments.find((m) =>
            shouldTriggerCoachingMoment(m, prev, next, triggeredMomentsRef.current)
          );

          if (trigger) {
            triggeredMomentsRef.current.add(trigger.id);
            setActiveCoachingMoment(trigger);
            setCoachingElapsed(0);
            return trigger.time; // Freeze at exact coaching timestamp
          }

          if (next >= effectiveAnimation.duration) {
            triggeredMomentsRef.current.clear();
            return 0;
          }
          return next;
        });
      }

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameId);
  }, [isPlaying, effectiveAnimation, activeCoachingMoment]);

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setActiveCoachingMoment(null);
    setCoachingElapsed(0);
    triggeredMomentsRef.current.clear();
  };

  const handleSkipCoachingMoment = () => {
    setActiveCoachingMoment(null);
    setCoachingElapsed(0);
  };

  const handleSeek = (newTime: number) => {
    const clampedTime = Math.max(0, Math.min(effectiveAnimation?.duration ?? 0, newTime));
    setCurrentTime(clampedTime);
    setActiveCoachingMoment(null);
    setCoachingElapsed(0);
    const moments = effectiveAnimation?.coachingMoments || [];
    triggeredMomentsRef.current = updateSeekTriggerState(
      clampedTime,
      moments,
      triggeredMomentsRef.current
    );
  };

  // Interpolated player & ball state at currentTime; restores exact diagram positions on stop/reset
  const displayState = useMemo(() => {
    if ((!isPlaying && currentTime === 0) || !effectiveAnimation) {
      return {
        players: Array.isArray(diagram.players) ? diagram.players : [],
        balls: Array.isArray(diagram.balls) ? diagram.balls : [],
      };
    }
    return interpolateAnimationState(
      { ...diagram, animation: effectiveAnimation },
      currentTime,
      DEFAULT_POLISHED_MOTION_OPTIONS
    );
  }, [diagram, effectiveAnimation, isPlaying, currentTime]);

  const players = displayState.players;
  const balls = displayState.balls;
  const cones = Array.isArray(diagram.cones) ? diagram.cones : [];
  const goals = Array.isArray(diagram.goals) ? diagram.goals : [];
  const zones = Array.isArray(diagram.zones) ? diagram.zones : [];
  const paths = Array.isArray(diagram.paths) ? diagram.paths : [];

  const phaseState = useMemo(() => {
    if (!activeCoachingMoment) return null;
    return getCoachingPhaseState(coachingElapsed, activeCoachingMoment.duration);
  }, [activeCoachingMoment, coachingElapsed]);

  // Track sequence progress for multi-action coaching sequences (TASK D7B)
  const sequenceProgress = useMemo(() => {
    if (!activeCoachingMoment || !effectiveAnimation) {
      return { current: 0, total: 0, isSequence: false, momentIds: [] };
    }
    return getCoachingSequenceProgress(
      activeCoachingMoment.id,
      effectiveAnimation.coachingSequence,
      effectiveAnimation.coachingMoments
    );
  }, [activeCoachingMoment, effectiveAnimation]);

  // Sequence timeline markers (TASK D7C)
  const timelineMarkers = useMemo(() => {
    return getSequenceTimelineMarkers(
      effectiveAnimation,
      currentTime,
      activeCoachingMoment?.id,
      triggeredMomentsRef.current
    );
  }, [effectiveAnimation, currentTime, activeCoachingMoment]);

  // Dynamic Camera Focus ViewBox during coaching moment with smooth ease-in, hold, ease-out (TASK D6)
  const cameraViewBox = useMemo(() => {
    const fullBox = { minX: 0, minY: 0, width: 1000, height: 600 };
    if (!activeCoachingMoment || !phaseState) {
      return '0 0 1000 600';
    }
    const target = players.find((p) => p.id === activeCoachingMoment.playerId);
    if (!target) return '0 0 1000 600';
    const tx = toX(target.x);
    const ty = toY(target.y);
    const zoom = activeCoachingMoment.focus?.zoom ?? 1.8;
    const targetBox = calculateCameraViewBox(tx, ty, zoom, 1000, 600);
    return interpolateViewBox(fullBox, targetBox, phaseState.cameraEase).viewBox;
  }, [activeCoachingMoment, phaseState, players]);

  // Tạo map id -> player để giải quyết tọa độ động cho paths
  const playerMap = useMemo(() => {
    const map = new Map<string, DiagramPlayer>();
    players.forEach((p) => {
      if (p && typeof p.id === 'string') {
        map.set(p.id, p);
      }
    });
    return map;
  }, [players]);

  // Giải quyết tọa độ paths từ playerMap an toàn
  const resolvedPaths = useMemo(() => {
    return paths
      .map((p) => resolvePathCoordinates(p, playerMap, toX, toY, 18))
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [paths, playerMap]);

  // Các đội thực sự có mặt trong sơ đồ để hiển thị chú thích chính xác
  const presentTeams = useMemo(() => {
    const set = new Set<string>();
    players.forEach((p) => {
      if (p && p.team) set.add(p.team);
    });
    return set;
  }, [players]);

  const formatPlayerNumber = (player: DiagramPlayer): string => {
    if (player.team === 'goalkeeper' || player.role === 'goalkeeper' || player.role === 'gk') {
      return 'GK';
    }
    const id = player.id || '';
    if (id.startsWith('p') && id.length > 1 && !isNaN(Number(id.slice(1)))) {
      return id.slice(1);
    }
    if (id.length <= 3) return id.toUpperCase();
    return id.slice(0, 2).toUpperCase();
  };

  return (
    <div className={`drill-board-wrapper w-full max-w-full ${className}`}>
      {/* Khung sơ đồ với aspect-ratio 5:3 chuẩn tỷ lệ sân 100:60, hoàn toàn responsive trên mobile & desktop */}
      <div className="drill-board relative w-full aspect-[5/3] overflow-hidden rounded-lg border border-stone-300 bg-[#164336] shadow-sm select-none">
        <svg
          viewBox={cameraViewBox}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          aria-label="Sơ đồ bài tập bóng đá chiến thuật"
        >
          <defs>
            {/* Lớp sọc cỏ tự nhiên nằm ngang */}
            <pattern id="turf-pattern-structured" width="1000" height="120" patternUnits="userSpaceOnUse">
              <rect width="1000" height="60" fill="#143d31" />
              <rect y="60" width="1000" height="60" fill="#18483a" />
            </pattern>

            {/* Mũi tên chuyền bóng (vàng chanh) */}
            <marker
              id="sd-arrow-pass"
              viewBox="0 0 12 12"
              refX="9"
              refY="6"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 1 2 L 10 6 L 1 10 z" fill="#fde047" />
            </marker>

            {/* Mũi tên chạy chỗ di chuyển không bóng (xanh da trời) */}
            <marker
              id="sd-arrow-movement"
              viewBox="0 0 12 12"
              refX="9"
              refY="6"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 1 2 L 10 6 L 1 10 z" fill="#38bdf8" />
            </marker>

            {/* Mũi tên dẫn bóng / rê dắt (cam sáng) */}
            <marker
              id="sd-arrow-dribble"
              viewBox="0 0 12 12"
              refX="9"
              refY="6"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 1 2 L 10 6 L 1 10 z" fill="#fb923c" />
            </marker>
          </defs>

          {/* LỚP 1: MẶT CỎ & ĐƯỜNG KẺ SÂN BÓNG */}
          <rect width="1000" height="600" fill="url(#turf-pattern-structured)" />

          {/* Đường biên sân bóng tiêu chuẩn (canh lề 40px ngang, 25px dọc) */}
          <rect
            x="40"
            y="25"
            width="920"
            height="550"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeOpacity="0.6"
            rx="3"
          />

          {/* Đường giữa sân chia đôi sân ngang */}
          <line
            x1="500"
            y1="25"
            x2="500"
            y2="575"
            stroke="#ffffff"
            strokeWidth="3"
            strokeOpacity="0.5"
          />

          {/* Vòng tròn trung tâm & điểm phát bóng */}
          <circle
            cx="500"
            cy="300"
            r="70"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeOpacity="0.5"
          />
          <circle cx="500" cy="300" r="4.5" fill="#ffffff" fillOpacity="0.8" />

          {/* VÒNG CẤM ĐỊA BÊN TRÁI */}
          <rect
            x="40"
            y="150"
            width="150"
            height="300"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeOpacity="0.45"
          />
          <rect
            x="40"
            y="220"
            width="55"
            height="160"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeOpacity="0.4"
          />
          <circle cx="150" cy="300" r="4" fill="#ffffff" fillOpacity="0.75" />
          <path
            d="M 190 255 A 70 70 0 0 1 190 345"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeOpacity="0.4"
          />

          {/* VÒNG CẤM ĐỊA BÊN PHẢI */}
          <rect
            x="810"
            y="150"
            width="150"
            height="300"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeOpacity="0.45"
          />
          <rect
            x="905"
            y="220"
            width="55"
            height="160"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeOpacity="0.4"
          />
          <circle cx="850" cy="300" r="4" fill="#ffffff" fillOpacity="0.75" />
          <path
            d="M 810 255 A 70 70 0 0 0 810 345"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeOpacity="0.4"
          />

          {/* Vòng cung 4 góc sân phạt góc */}
          <path d="M 40 40 A 15 15 0 0 0 55 25" fill="none" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.4" />
          <path d="M 40 560 A 15 15 0 0 1 55 575" fill="none" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.4" />
          <path d="M 945 25 A 15 15 0 0 0 960 40" fill="none" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.4" />
          <path d="M 945 575 A 15 15 0 0 1 960 560" fill="none" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.4" />

          {/* LỚP 2: KHU VỰC CHIẾN THUẬT / Ô CHIA SÂN (ZONES) */}
          <g className="zones-layer">
            {zones.map((zone, idx) => {
              if (
                typeof zone.x !== 'number' ||
                typeof zone.y !== 'number' ||
                typeof zone.width !== 'number' ||
                typeof zone.height !== 'number'
              ) {
                return null;
              }
              const zx = toX(zone.x);
              const zy = toY(zone.y);
              const zw = (Math.max(0, Math.min(100, zone.width)) / 100) * 1000;
              const zh = (Math.max(0, Math.min(100, zone.height)) / 100) * 600;
              return (
                <g key={zone.id || `zone-${idx}`}>
                  <rect
                    x={zx}
                    y={zy}
                    width={zw}
                    height={zh}
                    fill="rgba(255, 255, 255, 0.08)"
                    stroke="#fde047"
                    strokeWidth="1.8"
                    strokeDasharray="6,4"
                    rx="4"
                  />
                  {zone.label && (
                    <text
                      x={zx + zw / 2}
                      y={zy + 18}
                      textAnchor="middle"
                      fill="#fde047"
                      fontSize="12"
                      fontWeight="600"
                      fontFamily="Plus Jakarta Sans, sans-serif"
                    >
                      {String(zone.label)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* LỚP 3: ĐƯỜNG LUÂN CHUYỂN CHIẾN THUẬT (PATHS) */}
          <g className="paths-layer">
            {resolvedPaths.map((p) => {
              if (p.type === 'pass') {
                return (
                  <line
                    key={p.id}
                    x1={p.startX}
                    y1={p.startY}
                    x2={p.endX}
                    y2={p.endY}
                    stroke="#fde047"
                    strokeWidth="3.2"
                    markerEnd="url(#sd-arrow-pass)"
                    strokeLinecap="round"
                    opacity="0.95"
                  />
                );
              }

              if (p.type === 'movement') {
                return (
                  <line
                    key={p.id}
                    x1={p.startX}
                    y1={p.startY}
                    x2={p.endX}
                    y2={p.endY}
                    stroke="#38bdf8"
                    strokeWidth="2.8"
                    strokeDasharray="7,5"
                    markerEnd="url(#sd-arrow-movement)"
                    strokeLinecap="round"
                    opacity="0.95"
                  />
                );
              }

              // Dribble / Rê dắt bóng: đường lượn sóng màu cam đặc trưng
              const wavyD = buildWavyPath(p.startX, p.startY, p.endX, p.endY, 4, 5);
              return (
                <path
                  key={p.id}
                  d={wavyD}
                  fill="none"
                  stroke="#fb923c"
                  strokeWidth="3.2"
                  strokeDasharray="4,3"
                  markerEnd="url(#sd-arrow-dribble)"
                  strokeLinecap="round"
                  opacity="0.95"
                />
              );
            })}
          </g>

          {/* LỚP 4: CẦU MÔN & CỌC TIÊU / NÓN TẬP (EQUIPMENT) */}
          <g className="equipment-layer">
            {/* Cầu môn (Goals): Hỗ trợ mini goal & standard goal với orientation */}
            {goals.map((goal, idx) => {
              if (typeof goal.x !== 'number' || typeof goal.y !== 'number') return null;
              const geom = getGoalGeometry(goal, toX, toY);
              return (
                <g key={goal.id || `goal-${idx}`} className="goal-marker">
                  {/* Lưới cầu môn */}
                  <path
                    d={geom.pathD}
                    fill={geom.isMini ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.22)'}
                    stroke="#ffffff"
                    strokeWidth={geom.isMini ? '2.5' : '3.8'}
                    strokeDasharray={geom.isMini ? '6,4' : undefined}
                  />
                  {/* Vân lưới bên trong */}
                  <path
                    d={geom.netD}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.2"
                    strokeOpacity="0.4"
                  />
                </g>
              );
            })}

            {/* Cọc tiêu / Nón tập (Cones) */}
            {cones.map((c, idx) => {
              if (typeof c.x !== 'number' || typeof c.y !== 'number') return null;
              const cx = toX(c.x);
              const cy = toY(c.y);
              return (
                <g key={c.id || `cone-${idx}`} className="cone-marker">
                  <ellipse cx={cx} cy={cy + 6} rx={7} ry={2.5} fill="#c2410c" />
                  <polygon
                    points={`${cx},${cy - 9} ${cx - 6},${cy + 6} ${cx + 6},${cy + 6}`}
                    fill="#f97316"
                    stroke="#ea580c"
                    strokeWidth="1.2"
                  />
                </g>
              );
            })}
          </g>

          {/* LỚP 5: CẦU THỦ (PLAYERS) */}
          <g className="players-layer">
            {players.map((p, idx) => {
              if (typeof p.x !== 'number' || typeof p.y !== 'number') return null;
              const px = toX(p.x);
              const py = toY(p.y);
              const teamStyle = getTeamStyle(p.team);
              const label = formatPlayerNumber(p);
              const isCoachingFocus = activeCoachingMoment?.playerId === p.id;
              const isHighlighted = highlightPlayerId === p.id || (isCoachingFocus && activeCoachingMoment?.highlight);
              const highlightOpacity = isCoachingFocus && phaseState ? phaseState.highlightOpacity : 1;

              // Orientation continuity across multi-action coaching moments (TASK D7C)
              const playerOrientation = reconstructPlayerOrientation(
                p.id,
                currentTime,
                p.orientation,
                effectiveAnimation?.coachingMoments,
                isCoachingFocus ? activeCoachingMoment : null,
                phaseState ? phaseState.orientationProgress : 1
              );

              return (
                <g
                  key={p.id || `player-${idx}`}
                  transform={`translate(${px}, ${py})`}
                  className="cursor-pointer"
                >
                  {/* Coaching Focus Highlight Rings (TASK D5/D6) */}
                  {isCoachingFocus && isHighlighted && highlightOpacity > 0 && (
                    <g style={{ opacity: highlightOpacity }}>
                      <circle
                        r="30"
                        fill="rgba(253, 224, 71, 0.20)"
                        stroke="#fde047"
                        strokeWidth="2.5"
                      />
                      <circle
                        r="36"
                        fill="none"
                        stroke="#fde047"
                        strokeWidth="1.5"
                        strokeDasharray="5,4"
                      />
                    </g>
                  )}

                  {/* Vòng viền sáng khi được highlight thường */}
                  {!isCoachingFocus && isHighlighted && (
                    <circle
                      r="26"
                      fill="none"
                      stroke="#fde047"
                      strokeWidth="3.5"
                      strokeDasharray="6,4"
                      className="animate-spin"
                      style={{ animationDuration: '4s' }}
                    />
                  )}

                  {/* Directional Orientation Arrow (TASK D5/D6) - only arrow rotates, label stays upright */}
                  {playerOrientation !== undefined && (
                    <g transform={`rotate(${playerOrientation})`}>
                      <polygon
                        points="19,-5 28,0 19,5"
                        fill="#fde047"
                        stroke="#0f172a"
                        strokeWidth="1.2"
                        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"
                      />
                    </g>
                  )}

                  {/* Vòng tròn thân cầu thủ */}
                  <circle
                    r="18"
                    fill={teamStyle.fill}
                    stroke={teamStyle.stroke}
                    strokeWidth="2.5"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.45))"
                  />

                  {/* Số áo / Ký hiệu vai trò */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={teamStyle.text}
                    fontSize={label.length > 2 ? '10.5' : '12'}
                    fontWeight="800"
                    fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </g>

          {/* LỚP 6: QUẢ BÓNG (BALLS) - Kích thước rõ ràng nhỏ hơn cầu thủ (r=7.5 vs r=18) */}
          <g className="balls-layer">
            {balls.map((b, idx) => {
              if (typeof b.x !== 'number' || typeof b.y !== 'number') return null;
              const bx = toX(b.x);
              const by = toY(b.y);
              return (
                <g key={b.id || `ball-${idx}`} transform={`translate(${bx}, ${by})`}>
                  <circle
                    r="7.5"
                    fill="#ffffff"
                    stroke="#0f172a"
                    strokeWidth="1.8"
                    filter="drop-shadow(0 2px 3px rgba(0,0,0,0.5))"
                  />
                  <circle r="3" fill="#0f172a" />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Coaching Text Overlay Card (TASK D5/D6/D7B) */}
        {activeCoachingMoment && phaseState && phaseState.textOpacity > 0 && (
          <div
            style={{ opacity: phaseState.textOpacity }}
            className="absolute top-2.5 sm:top-3 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-sm sm:max-w-md rounded-lg bg-stone-900/95 p-2.5 sm:p-3 text-white shadow-xl backdrop-blur-md border border-amber-400/70 pointer-events-auto transition-opacity duration-150"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs uppercase tracking-wider truncate min-w-0">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                <span className="truncate">Điểm huấn luyện: {formatCoachingOverlayText(activeCoachingMoment.title, 40)}</span>
                {sequenceProgress.isSequence && (
                  <span
                    data-testid="coaching-sequence-indicator"
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-amber-300 bg-amber-400/20 border border-amber-400/30 whitespace-nowrap shrink-0"
                  >
                    Điểm HLV {sequenceProgress.current}/{sequenceProgress.total}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSkipCoachingMoment}
                className="text-[10px] text-stone-300 hover:text-white px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-all font-medium whitespace-nowrap cursor-pointer shrink-0"
                title="Bỏ qua phần giải thích và tiếp tục bài tập"
              >
                Tiếp tục ({Math.max(0, activeCoachingMoment.duration - coachingElapsed).toFixed(1)}s)
              </button>
            </div>
            <p className="text-xs sm:text-sm text-stone-100 font-normal leading-relaxed line-clamp-3">
              {formatCoachingOverlayText(activeCoachingMoment.text, 140)}
            </p>
          </div>
        )}

        {/* Minimal Playback Controls Overlay (TASK D4 / D5) */}
        {effectiveAnimation && effectiveAnimation.duration > 0 && (
          <div className="absolute bottom-2 left-2.5 z-10 flex items-center gap-1.5 rounded bg-black/80 px-2 py-1 text-xs text-white/95 backdrop-blur-xs shadow-sm no-print">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-white/20 active:scale-95 transition-all text-white focus:outline-hidden"
              title={isPlaying ? 'Tạm dừng mô phỏng (Pause)' : 'Phát mô phỏng (Play)'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5 fill-white" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-white ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-white/20 active:scale-95 transition-all text-white/80 hover:text-white focus:outline-hidden"
              title="Đặt lại vị trí ban đầu (Reset)"
              aria-label="Reset"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
            <div className="flex items-center gap-1 pl-1 text-[11px] font-mono text-white/80 select-none">
              <span>{currentTime.toFixed(1)}s</span>
              <span className="text-white/40">/</span>
              <span>{effectiveAnimation.duration.toFixed(1)}s</span>
            </div>
            <div className="relative flex items-center w-16 sm:w-24 h-4">
              <input
                type="range"
                min={0}
                max={effectiveAnimation.duration}
                step={0.05}
                value={currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  handleSeek(val);
                }}
                className="w-full h-1 accent-[#38bdf8] bg-white/20 rounded cursor-pointer z-10"
                aria-label="Thanh trượt thời gian mô phỏng"
              />
              {/* Sequence Timeline Markers (TASK D7C) */}
              {timelineMarkers.map((marker) => {
                const isActive = marker.state === 'active';
                const isCompleted = marker.state === 'completed';

                let markerStyle = 'bg-white/40 border-stone-600/60';
                if (isActive) {
                  markerStyle = 'bg-amber-400 border-white scale-125 shadow-[0_0_4px_rgba(251,191,36,0.85)]';
                } else if (isCompleted) {
                  markerStyle = 'bg-amber-400/90 border-stone-900/60';
                }

                return (
                  <span
                    key={marker.id}
                    data-testid={`timeline-marker-${marker.id}`}
                    data-marker-state={marker.state}
                    style={{ left: `${marker.pct}%` }}
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full border pointer-events-none transition-all duration-150 z-20 ${markerStyle}`}
                    title={`Điểm HLV: ${marker.title}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Chú thích màu sắc các đội thực sự có mặt */}
        <div className="absolute bottom-2 right-2.5 flex items-center gap-2 rounded bg-black/80 px-2 py-1 text-[11px] text-white/95 backdrop-blur-xs font-medium pointer-events-none">
          {presentTeams.has('blue') && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-blue-600" />
              <span>Xanh</span>
            </span>
          )}
          {presentTeams.has('red') && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-red-600" />
              <span>Đỏ</span>
            </span>
          )}
          {presentTeams.has('neutral') && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-stone-800 bg-amber-400" />
              <span>Tự do</span>
            </span>
          )}
          {presentTeams.has('goalkeeper') && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
              <span>Thủ môn</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// LEGACY DIAGRAM FALLBACK RENDERER
// Giữ nguyên 100% để đảm bảo tương thích ngược với các giáo án đã lưu trước đây
// =============================================================================
interface LegacyViewProps {
  data: PitchDiagramData;
  className?: string;
  isSimulating?: boolean;
  highlightPlayerId?: string;
}

const LegacyPitchDiagramView: React.FC<LegacyViewProps> = ({
  data,
  className = '',
  isSimulating = false,
  highlightPlayerId,
}) => {
  const { players = [], cones = [], goals = [], arrows = [], ball, coachingCueOverlay } = data;

  const toX = (pct: number) => (pct / 100) * 1600;
  const toY = (pct: number) => (pct / 100) * 1000;

  const getPlayerFill = (role: PitchPlayer['role']) => {
    switch (role) {
      case 'teamA':
        return '#ffffff';
      case 'teamB':
        return '#0f172a';
      case 'neutral':
        return '#f59e0b';
      case 'gk':
        return '#10b981';
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
      <div className="drill-board relative w-full aspect-[16/10] overflow-hidden rounded-lg border border-stone-300 bg-[#164336] shadow-sm select-none">
        <svg
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          aria-label="Sơ đồ chiến thuật sân bóng đá"
        >
          <defs>
            <pattern id="turf-stripes-1610" width="1600" height="200" patternUnits="userSpaceOnUse">
              <rect width="1600" height="100" fill="#143d31" />
              <rect y="100" width="1600" height="100" fill="#18483a" />
            </pattern>

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

          <rect width="1600" height="1000" fill="url(#turf-stripes-1610)" />

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

          <line
            x1="60"
            y1="500"
            x2="1540"
            y2="500"
            stroke="#ffffff"
            strokeWidth="4"
            strokeOpacity="0.5"
          />

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

                <circle
                  r="34"
                  fill={getPlayerFill(p.role)}
                  stroke={getPlayerStroke(p.role)}
                  strokeWidth="5"
                  filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                />

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
