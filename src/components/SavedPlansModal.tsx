import React from 'react';
import { X, FolderOpen, Trash2, ArrowRight, Clock, Users, Calendar } from 'lucide-react';
import { TrainingSession } from '../types/session';

interface SavedPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedSessions: TrainingSession[];
  onLoadSession: (session: TrainingSession) => void;
  onDeleteSession: (id: string) => void;
}

export const SavedPlansModal: React.FC<SavedPlansModalProps> = ({
  isOpen,
  onClose,
  savedSessions,
  onLoadSession,
  onDeleteSession,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-xl border border-stone-200 bg-white p-6 shadow-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-[#164336]">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900">
                Buổi tập của tôi ({savedSessions.length})
              </h3>
              <p className="text-xs text-stone-500">
                Kho lưu trữ giáo án trên thiết bị của bạn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List Content */}
        <div className="mt-4 flex-1 overflow-y-auto divide-y divide-stone-100 pr-1">
          {savedSessions.length === 0 ? (
            <div className="py-12 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-stone-300" />
              <p className="mt-2 text-sm font-semibold text-stone-700">
                Chưa có giáo án nào được lưu
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Nhấn &quot;Lưu giáo án&quot; trên bất kỳ buổi tập nào để lưu vào kho cá nhân.
              </p>
            </div>
          ) : (
            savedSessions.map((s) => (
              <div
                key={s.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 group"
              >
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-stone-900 group-hover:text-[#164336] transition-colors">
                    {s.title}
                  </h4>
                  <p className="text-xs text-stone-500 line-clamp-1">{s.objective}</p>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-stone-500">
                    <span className="flex items-center gap-1 text-[#164336] font-bold">
                      <Clock className="h-3 w-3" />
                      {s.totalDuration} phút
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {s.playerCount} cầu thủ
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {s.createdAt}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onLoadSession(s);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#121316] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#164336] transition-colors"
                  >
                    <span>Mở giáo án</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSession(s.id)}
                    className="rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Xóa giáo án"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-stone-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
