export type BlockType = 'warm_up' | 'technical' | 'skill' | 'small_sided' | 'match';

export type SessionDuration = 60 | 75 | 90;

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
  createdAt: string;
  blocks: Exercise[];
  generationSource?: GenerationSource;
}

export interface GenerateSessionParams {
  topic: string;
  playerCount: number;
  duration: SessionDuration;
  seedVariation?: number;
}
