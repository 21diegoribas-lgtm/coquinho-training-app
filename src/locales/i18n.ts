import { Language } from '../types/session';

export interface Translations {
  brandTitle: string;
  brandCoachName: string;
  brandRole: string;
  brandTagline: string;
  savedPlans: string;
  printSession: string;
  archiveTitle: string;
  archiveEmptyTitle: string;
  archiveEmptyDesc: string;
  loadPlan: string;
  close: string;
  cancel: string;
  saveChanges: string;

  // Session Configurator
  configTitle: string;
  configSubtitle: string;
  playersLabel: string;
  playersHint: string;
  topicLabel: string;
  topicPlaceholder: string;
  quickPicks: string;
  durationLabel: string;
  durationMinutes: string;
  defaultBadge: string;
  generateBtn: string;
  generatingBtn: string;

  // Overview
  sessionOverview: string;
  objectiveLabel: string;
  equipmentChecklist: string;
  savePlanBtn: string;
  planSavedBtn: string;
  regenerateBtn: string;
  copyBriefBtn: string;
  copiedBtn: string;

  // Timeline
  timelineTitle: string;
  timelineSubtitle: string;
  timelineMatched: string;
  timelineVariance: string;
  startLabel: string;
  midLabel: string;
  endLabel: string;

  // Drill Cards
  phasePrefix: string;
  drillDiagram: string;
  animateDrill: string;
  animatingPreview: string;
  editDrill: string;
  variationBtn: string;
  showBoard: string;
  hideBoard: string;
  equipment: string;
  organizationSetup: string;
  execution: string;
  coachingPoints: string;

  // Toast messages
  toastGenerated: string;
  toastRegenerated: string;
  toastUpdatedDrill: string;
  toastSavedPlan: string;
  toastArchiveUpdated: string;
  toastDeleted: string;
  toastLoaded: string;
  toastAnimationNotice: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    brandTitle: 'COQUINHO',
    brandCoachName: 'Nguyễn Thanh Tú',
    brandRole: 'Football Coach',
    brandTagline: 'Build better sessions. Faster.',
    savedPlans: 'Saved Plans',
    printSession: 'Print Session',
    archiveTitle: 'Saved Training Plans',
    archiveEmptyTitle: 'No saved sessions yet',
    archiveEmptyDesc: 'Click "Save Plan" on any session to store it in your coaching archive.',
    loadPlan: 'Load Plan',
    close: 'Close',
    cancel: 'Cancel',
    saveChanges: 'Save Changes',

    configTitle: 'Create Training Session',
    configSubtitle: 'Select squad size and tactical topic to generate a structured 5-phase session.',
    playersLabel: 'Number of Players',
    playersHint: 'Min. 4 players (e.g. 16)',
    topicLabel: 'Training Topic',
    topicPlaceholder: 'e.g. Receiving with an open body shape',
    quickPicks: 'Examples:',
    durationLabel: 'Session Duration:',
    durationMinutes: 'min',
    defaultBadge: 'Default',
    generateBtn: 'Generate Training Plan',
    generatingBtn: 'Structuring Session...',

    sessionOverview: 'Session Plan',
    objectiveLabel: 'Session Objective',
    equipmentChecklist: 'Equipment Checklist:',
    savePlanBtn: 'Save Plan',
    planSavedBtn: 'Plan Saved',
    regenerateBtn: 'Regenerate',
    copyBriefBtn: 'Copy Brief',
    copiedBtn: 'Copied!',

    timelineTitle: 'Session Timeline',
    timelineSubtitle: '5 training blocks totaling',
    timelineMatched: 'min scheduled (100%)',
    timelineVariance: 'min variance',
    startLabel: 'Kickoff',
    midLabel: 'Halfway',
    endLabel: 'Cooldown',

    phasePrefix: 'PHASE',
    drillDiagram: 'DRILL DIAGRAM',
    animateDrill: 'Animate Drill',
    animatingPreview: 'Interactive Animation Preview',
    editDrill: 'Edit Drill',
    variationBtn: 'Variation',
    showBoard: 'Board',
    hideBoard: 'Hide Board',
    equipment: 'Equipment',
    organizationSetup: 'Organization & Setup',
    execution: 'Execution & Rules',
    coachingPoints: 'COACHING POINTS',

    toastGenerated: 'Generated training session for',
    toastRegenerated: 'Regenerated session with alternative drill variations.',
    toastUpdatedDrill: 'Updated variation for',
    toastSavedPlan: 'Training plan saved to local storage!',
    toastArchiveUpdated: 'Saved plan updated successfully!',
    toastDeleted: 'Session plan removed from saved list.',
    toastLoaded: 'Loaded session plan',
    toastAnimationNotice: 'Animation player preview: 2D player trajectory engine ready.',
  },
  vi: {
    brandTitle: 'COQUINHO',
    brandCoachName: 'Nguyễn Thanh Tú',
    brandRole: 'Huấn luyện viên bóng đá',
    brandTagline: 'Xây dựng giáo án chất lượng. Nhanh hơn.',
    savedPlans: 'Kế hoạch đã lưu',
    printSession: 'In giáo án',
    archiveTitle: 'Giáo án đã lưu',
    archiveEmptyTitle: 'Chưa có giáo án nào được lưu',
    archiveEmptyDesc: 'Nhấn "Lưu giáo án" để lưu lại giáo án vào kho lưu trữ cá nhân.',
    loadPlan: 'Mở giáo án',
    close: 'Đóng',
    cancel: 'Hủy',
    saveChanges: 'Lưu thay đổi',

    configTitle: 'Thiết kế buổi tập',
    configSubtitle: 'Chọn quân số và chủ đề huấn luyện để tạo buổi tập chuẩn 5 giai đoạn.',
    playersLabel: 'Số lượng cầu thủ',
    playersHint: 'Tối thiểu 4 cầu thủ (ví dụ: 16)',
    topicLabel: 'Chủ đề huấn luyện',
    topicPlaceholder: 'Ví dụ: Nhận bóng với tư thế mở',
    quickPicks: 'Gợi ý nhanh:',
    durationLabel: 'Thời lượng buổi tập:',
    durationMinutes: 'phút',
    defaultBadge: 'Chuẩn',
    generateBtn: 'Tạo giáo án buổi tập',
    generatingBtn: 'Đang tạo giáo án...',

    sessionOverview: 'Kế hoạch buổi tập',
    objectiveLabel: 'Mục tiêu buổi tập',
    equipmentChecklist: 'Dụng cụ cần chuẩn bị:',
    savePlanBtn: 'Lưu giáo án',
    planSavedBtn: 'Đã lưu giáo án',
    regenerateBtn: 'Đổi biến thể',
    copyBriefBtn: 'Sao chép giáo án',
    copiedBtn: 'Đã sao chép!',

    timelineTitle: 'Tiến trình thời gian',
    timelineSubtitle: '5 khối huấn luyện liên hoàn với',
    timelineMatched: 'phút khớp (100%)',
    timelineVariance: 'phút chênh lệch',
    startLabel: 'Bắt đầu',
    midLabel: 'Giữa buổi',
    endLabel: 'Thả lỏng',

    phasePrefix: 'GIAI ĐOẠN',
    drillDiagram: 'SƠ ĐỒ BÀI TẬP',
    animateDrill: 'Mô phỏng bài tập',
    animatingPreview: 'Xem trước mô phỏng 2D',
    editDrill: 'Sửa bài tập',
    variationBtn: 'Biến thể',
    showBoard: 'Sơ đồ sân',
    hideBoard: 'Ẩn sơ đồ',
    equipment: 'Dụng cụ',
    organizationSetup: 'Bố trí & Thiết lập sân',
    execution: 'Cách thức vận hành',
    coachingPoints: 'ĐIỂM NHẤN HUẤN LUYỆN',

    toastGenerated: 'Đã tạo giáo án buổi tập cho',
    toastRegenerated: 'Đã làm mới giáo án với các biến thể bài tập mới.',
    toastUpdatedDrill: 'Đã đổi biến thể cho',
    toastSavedPlan: 'Đã lưu giáo án vào bộ nhớ!',
    toastArchiveUpdated: 'Đã cập nhật giáo án thành công!',
    toastDeleted: 'Đã xóa giáo án khỏi danh sách lưu trữ.',
    toastLoaded: 'Đã tải giáo án',
    toastAnimationNotice: 'Chế độ mô phỏng chuyển động 2D sẵn sàng.',
  },
};
