export type BlockType = 'warm_up' | 'technical' | 'skill' | 'small_sided' | 'match';

export type SessionDuration = 60 | 75 | 90;

export type GameFormat = 'Futsal 5v5' | '7v7' | '9v9' | '11v11';

export type Language = 'en' | 'vi';

export interface PitchElement {
  x: number; // 0 to 100 percentage
  y: number; // 0 to 100 percentage
}

export interface PitchPlayer extends PitchElement {
  role: 'teamA' | 'teamB' | 'neutral' | 'gk';
  label?: string;
  rotation?: number; // 0-360 degrees facing direction
  highlight?: boolean; // For coach emphasis / focus
  targetX?: number; // Target coordinate for animation tween
  targetY?: number; // Target coordinate for animation tween
}

export interface PitchCone extends PitchElement {
  color?: 'orange' | 'yellow' | 'blue' | 'white';
}

export interface PitchGoal extends PitchElement {
  width?: number;
  orientation: 'top' | 'bottom' | 'left' | 'right';
  isMini?: boolean;
}

export interface PitchArrow {
  from: [number, number]; // [x, y]
  to: [number, number]; // [x, y]
  type: 'pass' | 'run' | 'dribble';
  curve?: number; // Optional curve offset
}

export interface PitchDiagramData {
  layout: 'rondo_box' | 'gates_grid' | 'channel_play' | 'half_pitch' | 'full_pitch';
  players: PitchPlayer[];
  cones?: PitchCone[];
  goals?: PitchGoal[];
  arrows?: PitchArrow[];
  ball?: PitchElement;
  coachingCueOverlay?: string; // Text overlay for tactical cue
  isSimulating?: boolean; // Animation simulation toggle
}

export type DiagramTeam = 'blue' | 'red' | 'neutral' | 'goalkeeper';
export type DiagramPathType = 'pass' | 'movement' | 'dribble';

export interface DiagramPitch {
  width: number;
  height: number;
}

export interface DiagramPlayer {
  id: string;
  team: DiagramTeam;
  role?: string;
  x: number; // 0 to 100 percentage
  y: number; // 0 to 100 percentage
  orientation?: number; // 0-359 degrees facing direction
}

export interface DiagramBall {
  id: string;
  x: number;
  y: number;
}

export interface DiagramCone {
  id: string;
  x: number;
  y: number;
}

export interface DiagramGoal {
  id: string;
  type: 'mini' | 'standard' | string;
  x: number;
  y: number;
  orientation: 'top' | 'bottom' | 'left' | 'right' | string;
}

export interface DiagramZone {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  label?: string;
  [key: string]: unknown;
}

export interface DiagramPath {
  id: string;
  type: DiagramPathType;
  fromPlayerId: string;
  toPlayerId?: string;
}

export interface DiagramCoordinate {
  x: number;
  y: number;
}

export interface PlayerMoveAction {
  type: 'playerMove';
  playerId: string;
  to: DiagramCoordinate;
}

export interface BallPassAction {
  type: 'ballPass';
  ballId: string;
  fromPlayerId: string;
  toPlayerId: string;
}

export interface BallDribbleAction {
  type: 'ballDribble';
  ballId: string;
  playerId: string;
  to: DiagramCoordinate;
}

export type DiagramAnimationAction = PlayerMoveAction | BallPassAction | BallDribbleAction;

export interface DiagramAnimationStep {
  id: string;
  start: number; // in seconds
  duration: number; // in seconds
  actions: DiagramAnimationAction[];
}

export interface CoachingMomentFocus {
  zoom?: number; // Safe range: 1.0–3.0 (default ~1.6–2.0)
}

export interface DiagramCoachingMoment {
  id: string;
  time: number; // in seconds (animation timeline trigger)
  duration: number; // in seconds (presentation freeze duration)
  playerId: string;
  title: string;
  text: string;
  focus?: CoachingMomentFocus;
  highlight?: boolean;
  orientation?: number; // 0-359 degrees
}

export interface DiagramAnimation {
  duration: number; // total duration in seconds
  steps: DiagramAnimationStep[];
  coachingMoments?: DiagramCoachingMoment[];
}

export interface StructuredDrillDiagram {
  pitch: DiagramPitch;
  players: DiagramPlayer[];
  balls: DiagramBall[];
  cones: DiagramCone[];
  goals: DiagramGoal[];
  zones: DiagramZone[];
  paths: DiagramPath[];
  animation?: DiagramAnimation;
}

export type GenerationSource = 'gemini' | 'fallback';

export type LeftoverRole = 'none' | 'joker' | 'rotation';

export interface ExercisePlayerOrganization {
  groups: number;
  playersPerGroup: number;
  leftover?: number;
  leftoverRole?: LeftoverRole;
  /** @deprecated Prefer leftover + leftoverRole (joker / rotation). */
  restingPlayers?: number;
}

export interface Exercise {
  id: string;
  blockType: BlockType;
  blockName: string; // e.g. "Warm-up", "Technical Practice", "Skill Practice", "Small-Sided Game", "Match / Game"
  exerciseName: string;
  duration: number; // minutes
  playersCount: string; // e.g. "16 Cầu thủ (4 nhóm 4)"
  areaSize: string; // e.g. "25 × 20 m"
  equipment: string[]; // e.g. ["12 Cọc tiêu", "8 Quả bóng", "4 Áo bib"]
  organization: string; // Brief setup description
  howItWorks: string[]; // Step by step rules
  coachingPoints: string[]; // Technical / tactical coaching cues
  pitchDiagram?: PitchDiagramData;
  diagram?: StructuredDrillDiagram;
  progression?: string;
  playerOrganization?: ExercisePlayerOrganization;
}

export interface TrainingSession {
  id: string;
  title: string;
  objective: string;
  topic: string;
  playerCount: number;
  totalDuration: number;
  selectedDuration?: SessionDuration;
  gameFormat?: GameFormat;
  createdAt: string;
  blocks: Exercise[];
  generationSource?: GenerationSource;
}

export interface GenerateSessionParams {
  topic: string;
  playerCount: number;
  duration: SessionDuration;
  gameFormat?: GameFormat;
  seedVariation?: number;
}
