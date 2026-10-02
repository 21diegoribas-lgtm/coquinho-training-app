/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameFormat, StructuredDrillDiagram } from './session';

export interface PlayerOrganization {
  groups: number;
  playersPerGroup: number;
  leftover?: number;
  leftoverRole?: 'none' | 'joker' | 'rotation';
  restingPlayers?: number;
}

export interface TrainingPhase {
  id: string;
  phase: string;
  exerciseName: string;
  duration: number; // minutes
  players: number;
  area: string;
  equipment: string[];
  organization: string;
  execution: string;
  coachingPoints: string[];
  progression?: string;
  playerOrganization?: PlayerOrganization;

  diagram?: StructuredDrillDiagram;
  animation?: unknown;
  playerPositions?: unknown[];
  ballPath?: unknown[];
  movementPath?: unknown[];
  coachingEvents?: unknown[];
}

export interface GeminiTrainingPlan {
  sessionTitle: string;
  mainObjective: string;
  players: number;
  duration: number;
  gameFormat?: GameFormat;
  ageGroup?: string;
  sessionOverview?: string;
  phases: TrainingPhase[];
  generationSource?: 'gemini' | 'fallback';
}

export interface GeneratePlanRequest {
  players: number;
  trainingFocus: string;
  duration: number;
  gameFormat?: GameFormat;
}
