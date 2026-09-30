import React from 'react';
import { FolderOpen, Printer } from 'lucide-react';

interface NavbarProps {
  savedCount: number;
  onOpenSavedModal: () => void;
  onPrint: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  savedCount,
  onOpenSavedModal,
  onPrint,
}) => {
  return (
    <header className="border-b border-stone-200/90 bg-white sticky top-0 z-40 no-print">
      <div className="mx-auto flex h-16 sm:h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Khối thương hiệu chính: COQUINHO dominant, Nguyễn Thanh Tú · Huấn luyện viên bóng đá */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Logo Monogram */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#121316] text-white">
            <div className="relative flex h-5 w-5 items-center justify-center border border-emerald-500/70 bg-[#164336]">
              <span className="font-display font-extrabold text-xs text-white tracking-wider">
                CQ
              </span>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#121316] leading-none">
                COQUINHO
              </span>
            </div>
            <div className="mt-0.5 text-xs sm:text-[13px] font-medium text-stone-500 leading-tight">
              <span>Nguyễn Thanh Tú</span>
              <span className="mx-1 text-stone-300">·</span>
              <span className="text-stone-700">Huấn luyện viên bóng đá</span>
            </div>
          </div>
        </div>

        {/* Nút thao tác nhanh: Buổi tập của tôi & In giáo án */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Buổi tập của tôi / Giáo án đã lưu */}
          <button
            type="button"
            onClick={onOpenSavedModal}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:border-stone-400 hover:bg-stone-50 transition-colors"
            title="Xem các buổi tập đã lưu trong kho giáo án"
          >
            <FolderOpen className="h-4 w-4 text-stone-500" />
            <span className="hidden sm:inline">Buổi tập của tôi</span>
            <span className="sm:hidden">Đã lưu</span>
            {savedCount > 0 && (
              <span className="ml-1 rounded-full bg-[#164336] px-1.5 py-0.2 font-mono text-[10px] font-bold text-white tabular-nums">
                {savedCount}
              </span>
            )}
          </button>

          {/* In giáo án */}
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:border-stone-400 hover:bg-stone-50 transition-colors"
            title="In hoặc xuất file PDF giáo án để mang ra sân"
          >
            <Printer className="h-4 w-4 text-stone-500" />
            <span className="hidden sm:inline">In giáo án</span>
            <span className="sm:hidden">In PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
};
