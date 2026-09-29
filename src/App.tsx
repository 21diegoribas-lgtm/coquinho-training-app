/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { SessionInputCard } from './components/SessionInputCard';
import { SessionSummaryHeader } from './components/SessionSummaryHeader';
import { SessionTimeline } from './components/SessionTimeline';
import { ExerciseCard } from './components/ExerciseCard';
import { EditExerciseModal } from './components/EditExerciseModal';
import { SavedPlansModal } from './components/SavedPlansModal';
import {
  generateTrainingSession,
  regenerateSingleExercise,
} from './services/sessionGenerator';
import {
  generateTrainingPlanWithGemini,
  mapGeminiPlanToSession,
} from './services/trainingPlanService';
import {
  getSavedSessions,
  saveSessionToStorage,
  deleteSavedSession,
} from './services/storageService';
import { Exercise, SessionDuration, TrainingSession } from './types/session';
import { CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentSession, setCurrentSession] = useState<TrainingSession>(() =>
    generateTrainingSession('Nhận bóng với tư thế mở & Quan sát không gian', 16, 90, 0)
  );
  const [seedVariation, setSeedVariation] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [savedSessions, setSavedSessions] = useState<TrainingSession[]>([]);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState<boolean>(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const planRef = useRef<HTMLDivElement>(null);

  // Tải danh sách giáo án đã lưu trong localStorage khi khởi động
  useEffect(() => {
    setSavedSessions(getSavedSessions());
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleGenerate = async (topic: string, players: number, duration: SessionDuration) => {
    setIsGenerating(true);
    setApiError(null);

    try {
      const plan = await generateTrainingPlanWithGemini({
        players,
        trainingFocus: topic,
        duration,
      });

      const newSession = mapGeminiPlanToSession(plan, topic);
      setCurrentSession(newSession);
      setSeedVariation(0);

      showToast(`Đã tạo giáo án cho ${players} cầu thủ: "${newSession.title}"`);

      if (planRef.current) {
        planRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err: any) {
      console.error('Error generating plan with Gemini:', err);
      const msg = err.message || 'Không thể tạo giáo án lúc này. Vui lòng thử lại.';
      setApiError(msg);
      showToast(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateWholePlan = () => {
    handleGenerate(
      currentSession.topic,
      currentSession.playerCount,
      currentSession.totalDuration
    );
  };

  const handleRegenerateExercise = (exercise: Exercise) => {
    const updated = regenerateSingleExercise(
      exercise,
      currentSession.topic,
      currentSession.playerCount,
      seedVariation + 1
    );

    setCurrentSession((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === exercise.id ? updated : b)),
    }));

    showToast(`Đã đổi biến thể bài tập cho giai đoạn: ${exercise.blockName}`);
  };

  const handleEditExerciseSave = (updated: Exercise) => {
    setCurrentSession((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === updated.id ? updated : b)),
    }));
    showToast(`Đã lưu thay đổi cho "${updated.exerciseName}"`);
  };

  const handleSavePlan = () => {
    const result = saveSessionToStorage(currentSession);
    if (result.success) {
      setSavedSessions(getSavedSessions());
      showToast(
        result.isNew
          ? 'Đã lưu giáo án vào bộ nhớ thiết bị!'
          : 'Đã cập nhật giáo án thành công!'
      );
    }
  };

  const handleDeleteSaved = (id: string) => {
    deleteSavedSession(id);
    setSavedSessions(getSavedSessions());
    showToast('Đã xóa giáo án khỏi danh sách lưu trữ.');
  };

  const handleLoadSaved = (session: TrainingSession) => {
    setCurrentSession(session);
    showToast(`Đã tải giáo án: "${session.title}"`);
    if (planRef.current) {
      planRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectBlock = (blockId: string) => {
    setActiveBlockId(blockId);
    const el = document.getElementById(`block-${blockId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleAnimateClick = (exerciseName: string) => {
    showToast(`Đang xem thử mô phỏng 2D: ${exerciseName}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const isCurrentSessionSaved = savedSessions.some((s) => s.id === currentSession.id);

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#121316] flex flex-col font-sans">
      {/* Brand Header chính & Điều hướng */}
      <Navbar
        savedCount={savedSessions.length}
        onOpenSavedModal={() => setIsSavedModalOpen(true)}
        onPrint={handlePrint}
      />

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Form thiết lập buổi tập */}
        <section aria-label="Thiết lập giáo án" className="no-print">
          <SessionInputCard
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            errorMessage={apiError}
            onClearError={() => setApiError(null)}
          />
        </section>

        {/* Khối hiển thị giáo án buổi tập */}
        <div ref={planRef} className="space-y-6 pt-2">
          {/* Tiêu đề & Thông số tổng quan buổi tập */}
          <section aria-label="Tổng quan giáo án">
            <SessionSummaryHeader
              session={currentSession}
              onSave={handleSavePlan}
              onRegenerate={handleRegenerateWholePlan}
              isSaved={isCurrentSessionSaved}
            />
          </section>

          {/* Tiến trình thời gian của buổi tập */}
          <section aria-label="Tiến trình thời gian" className="no-print">
            <SessionTimeline
              blocks={currentSession.blocks}
              totalDuration={currentSession.totalDuration}
              onSelectBlock={handleSelectBlock}
              activeBlockId={activeBlockId}
            />
          </section>

          {/* Danh sách các khối bài tập */}
          <section aria-label="Các khối bài tập" className="space-y-6">
            <div className="flex items-center justify-between no-print border-b border-stone-200/80 pb-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                  Các khối bài tập huấn luyện
                </h2>
                <p className="text-xs text-stone-500">
                  Trình tự các giai đoạn: từ khởi động đến trận đấu tự do
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-[#164336] bg-[#164336]/10 px-2.5 py-1 rounded">
                {currentSession.blocks.length} Giai đoạn
              </span>
            </div>

            <div className="space-y-6">
              {currentSession.blocks.map((exercise, index) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  index={index}
                  onEdit={(ex) => setEditingExercise(ex)}
                  onRegenerate={handleRegenerateExercise}
                  isSelected={activeBlockId === exercise.id}
                  onAnimateClick={handleAnimateClick}
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Footer dành riêng cho bản in PDF / Bản giấy ra sân */}
      <div className="hidden print:block p-8 border-t-2 border-stone-800 text-xs font-sans text-stone-900">
        <div className="flex justify-between items-end">
          <div>
            <div className="font-black text-lg">COQUINHO</div>
            <div className="text-stone-600">Nguyễn Thanh Tú · Huấn luyện viên bóng đá</div>
            <div className="text-[11px] text-stone-400 mt-1">Giáo án huấn luyện bóng đá cộng đồng</div>
          </div>
          <div className="text-right font-mono text-[11px]">
            <div>Ngày in: {currentSession.createdAt}</div>
            <div>{currentSession.totalDuration} phút · {currentSession.playerCount} cầu thủ</div>
          </div>
        </div>
      </div>

      {/* Modals & Dialogs */}
      <EditExerciseModal
        exercise={editingExercise}
        isOpen={Boolean(editingExercise)}
        onClose={() => setEditingExercise(null)}
        onSave={handleEditExerciseSave}
      />

      <SavedPlansModal
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        savedSessions={savedSessions}
        onLoadSession={handleLoadSaved}
        onDeleteSession={handleDeleteSaved}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-lg bg-stone-950 px-4 py-3 text-xs font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-2 no-print"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </aside>
      )}
    </div>
  );
}
