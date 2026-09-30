import React, { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import { Exercise } from '../types/session';

interface EditExerciseModalProps {
  exercise: Exercise | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Exercise) => void;
}

function formFromExercise(exercise: Exercise) {
  return {
    exerciseName: exercise.exerciseName,
    duration: exercise.duration,
    playersCount: exercise.playersCount,
    areaSize: exercise.areaSize,
    equipmentStr: exercise.equipment.join(', '),
    organization: exercise.organization,
    howItWorksStr: exercise.howItWorks.join('\n'),
    coachingPointsStr: exercise.coachingPoints.join('\n'),
  };
}

export const EditExerciseModal: React.FC<EditExerciseModalProps> = ({
  exercise,
  isOpen,
  onClose,
  onSave,
}) => {
  const [exerciseName, setExerciseName] = useState('');
  const [duration, setDuration] = useState(10);
  const [playersCount, setPlayersCount] = useState('');
  const [areaSize, setAreaSize] = useState('');
  const [equipmentStr, setEquipmentStr] = useState('');
  const [organization, setOrganization] = useState('');
  const [howItWorksStr, setHowItWorksStr] = useState('');
  const [coachingPointsStr, setCoachingPointsStr] = useState('');

  useEffect(() => {
    if (!exercise) return;
    const form = formFromExercise(exercise);
    setExerciseName(form.exerciseName);
    setDuration(form.duration);
    setPlayersCount(form.playersCount);
    setAreaSize(form.areaSize);
    setEquipmentStr(form.equipmentStr);
    setOrganization(form.organization);
    setHowItWorksStr(form.howItWorksStr);
    setCoachingPointsStr(form.coachingPointsStr);
  }, [exercise, isOpen]);

  if (!isOpen || !exercise) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedEquipment = equipmentStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedHowItWorks = howItWorksStr
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedCoachingPoints = coachingPointsStr
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: Exercise = {
      ...exercise,
      exerciseName: exerciseName.trim() || exercise.exerciseName,
      duration: Math.max(1, duration || 10),
      playersCount: playersCount.trim() || exercise.playersCount,
      areaSize: areaSize.trim() || exercise.areaSize,
      equipment: parsedEquipment.length > 0 ? parsedEquipment : exercise.equipment,
      organization: organization.trim() || exercise.organization,
      howItWorks: parsedHowItWorks.length > 0 ? parsedHowItWorks : exercise.howItWorks,
      coachingPoints: parsedCoachingPoints.length > 0 ? parsedCoachingPoints : exercise.coachingPoints,
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-xl border border-stone-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Tiêu đề Modal */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div>
            <span className="font-mono text-xs font-semibold text-[#164336] uppercase">
              {exercise.blockName}
            </span>
            <h3 className="text-lg font-bold text-stone-900">
              Chỉnh sửa bài tập
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Biểu mẫu chỉnh sửa */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
              Tên bài tập
            </label>
            <input
              type="text"
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3.5 py-2 text-sm font-semibold text-stone-900 focus:border-[#164336] focus:ring-1 focus:ring-[#164336] focus:outline-hidden"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                Thời lượng (phút)
              </label>
              <input
                type="number"
                min={5}
                max={90}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10) || 5)}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-sm font-bold text-stone-900 focus:border-[#164336] focus:ring-1 focus:ring-[#164336] focus:outline-hidden tabular-nums"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                Kích thước sân
              </label>
              <input
                type="text"
                value={areaSize}
                onChange={(e) => setAreaSize(e.target.value)}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#164336] focus:ring-1 focus:ring-[#164336] focus:outline-hidden"
                placeholder="25 × 20 m"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                Phân bổ cầu thủ
              </label>
              <input
                type="text"
                value={playersCount}
                onChange={(e) => setPlayersCount(e.target.value)}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#164336] focus:ring-1 focus:ring-[#164336] focus:outline-hidden"
                placeholder="16 Cầu thủ"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
              Dụng cụ (cách nhau bởi dấu phẩy)
            </label>
            <input
              type="text"
              value={equipmentStr}
              onChange={(e) => setEquipmentStr(e.target.value)}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-[#164336] focus:ring-1 focus:ring-[#164336] focus:outline-hidden"
              placeholder="12 Nón tập, 8 Quả bóng, 4 Áo bib"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
              Tổ chức & Bố trí
            </label>
            <textarea
              rows={2}
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-[#164336] focus:ring-1 focus:ring-[#164336] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
              Cách vận hành (mỗi bước trên một dòng)
            </label>
            <textarea
              rows={4}
              value={howItWorksStr}
              onChange={(e) => setHowItWorksStr(e.target.value)}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-[#164336] focus:ring-1 focus:ring-[#164336] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#164336]">
              Điểm huấn luyện (mỗi ý trên một dòng)
            </label>
            <textarea
              rows={3}
              value={coachingPointsStr}
              onChange={(e) => setCoachingPointsStr(e.target.value)}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-[#164336] focus:ring-1 focus:ring-[#164336] focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#164336] px-4 py-2 text-xs font-semibold text-white hover:bg-[#10352a] shadow-xs transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
