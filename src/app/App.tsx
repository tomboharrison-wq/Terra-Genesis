import { LandformShow } from './LandformShow';
import { ExportDialog } from './ExportDialog';
import { EvidenceDialog } from './EvidenceDialog';
import { useEffect } from 'react';
import { Viewport } from './Viewport';
import { TopBar } from './TopBar';
import { ToolRail } from './ToolRail';
import { ToolPanel } from './ToolPanel';
import { StatusBar } from './StatusBar';
import { NewWorldDialog } from './NewWorldDialog';
import { LoadDialog } from './LoadDialog';
import { HelpDialog } from './HelpDialog';
import { CheckpointsDialog } from './CheckpointsDialog';
import { ChallengeHud, ChallengesDialog } from './ChallengesDialog';
import { GuidedStage, LessonLabels, LessonPanel, LessonsDialog } from './EducationMode';
import { Toasts } from './Toasts';
import { TimeBar } from './TimeBar';
import { LiveLandformHud } from './LiveLandformHud';
import { SlumpLab } from './SlumpLab';
import { ArchLab } from './ArchLab';
import { ShorelineLab } from './ShorelineLab';
import { SubductionLab } from './SubductionLab';
import { FoldLab } from './FoldLab';
import { useShortcuts } from './useShortcuts';
import { useUi } from '../state/uiStore';
import { flushAutosave, restoreAutosave } from './runtime';
import { startLessonAt } from './educationRunner';
import { BeforeAfterDialog } from './BeforeAfterDialog';
import { syncAudio } from './audio';
import { launchTeacherSetupById } from './teacherSetupRunner';

export function App() {
  const dialog = useUi((s) => s.dialog);
  const classroom = useUi((s) => s.education !== null);
  const big = useUi((s) => !!s.education?.big);
  const contrast = useUi((s) => !!s.education?.contrast);
  const hidePanel = useUi((s) => !!s.education?.hidePanel);
  useShortcuts();
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const lesson = q.get('lesson');
    const landform = q.get('landform');
    const teacher = q.get('teacher');
    if (landform) {
      // Teacher link: open the Landform Show at that landform (it plays straight away).
      useUi.getState().set({ dialog: 'landforms', landformId: landform });
      void restoreAutosave();
    } else if (teacher && launchTeacherSetupById(teacher)) {
      useUi.getState().set({ dialog: 'evidence' });
    } else if (lesson) {
      // Teacher link: open the lesson at the given stage (1-based) and level.
      const lv = q.get('level');
      startLessonAt(lesson, Number(q.get('stage') ?? '1') - 1, lv === 'ks3' || lv === 'gcse' ? lv : undefined);
    } else if (!q.has('fresh')) void restoreAutosave();
    const onHide = () => document.visibilityState === 'hidden' && flushAutosave();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);
  useEffect(() => {
    const apply = (s: ReturnType<typeof useUi.getState>) => {
      syncAudio(s.audio, s.classroom);
      try {
        localStorage.setItem('tg-audio', JSON.stringify(s.audio));
      } catch {
        // Storage can be unavailable in private browser contexts.
      }
    };
    apply(useUi.getState());
    return useUi.subscribe((s, prev) => {
      if (s.audio !== prev.audio || s.classroom !== prev.classroom) apply(s);
    });
  }, []);

  return (
    <div className={`app ${classroom ? 'classroom' : ''} ${big ? 'lesson-big' : ''} ${contrast ? 'lesson-contrast' : ''} ${hidePanel ? 'lesson-nopanel' : ''}`}>
      <Viewport />
      <LessonLabels />
      <GuidedStage />
      <LessonPanel />
      <TopBar />
      <ToolRail />
      <ToolPanel />
      <LiveLandformHud />
      <TimeBar />
      <StatusBar />
      <Toasts />
      {dialog === 'new' && <NewWorldDialog />}
      {dialog === 'load' && <LoadDialog />}
      {dialog === 'help' && <HelpDialog />}
      {dialog === 'slump' && <SlumpLab />}
      {dialog === 'arch' && <ArchLab />}
      {dialog === 'shore' && <ShorelineLab />}
      {dialog === 'subduction' && <SubductionLab />}
      {dialog === 'folds' && <FoldLab />}
      {dialog === 'checkpoints' && <CheckpointsDialog />}
      {dialog === 'challenges' && <ChallengesDialog />}
      {dialog === 'lessons' && <LessonsDialog />}
      {dialog === 'evidence' && <EvidenceDialog />}
      {dialog === 'export' && <ExportDialog />}
      {dialog === 'landforms' && <LandformShow />}
      {dialog === 'compare' && <BeforeAfterDialog />}
      <ChallengeHud />
    </div>
  );
}
