import { useEffect } from 'react';
import { Viewport } from './Viewport';
import { TopBar } from './TopBar';
import { ToolRail } from './ToolRail';
import { ToolPanel } from './ToolPanel';
import { StatusBar } from './StatusBar';
import { NewWorldDialog } from './NewWorldDialog';
import { LoadDialog } from './LoadDialog';
import { HelpDialog } from './HelpDialog';
import { Toasts } from './Toasts';
import { TimeBar } from './TimeBar';
import { SlumpLab } from './SlumpLab';
import { ArchLab } from './ArchLab';
import { useShortcuts } from './useShortcuts';
import { useUi } from '../state/uiStore';
import { flushAutosave, restoreAutosave } from './runtime';

export function App() {
  const dialog = useUi((s) => s.dialog);
  useShortcuts();
  useEffect(() => {
    const skip = new URLSearchParams(location.search).has('fresh');
    if (!skip) void restoreAutosave();
    const onHide = () => document.visibilityState === 'hidden' && flushAutosave();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  return (
    <div className="app">
      <Viewport />
      <TopBar />
      <ToolRail />
      <ToolPanel />
      <TimeBar />
      <StatusBar />
      <Toasts />
      {dialog === 'new' && <NewWorldDialog />}
      {dialog === 'load' && <LoadDialog />}
      {dialog === 'help' && <HelpDialog />}
      {dialog === 'slump' && <SlumpLab />}
      {dialog === 'arch' && <ArchLab />}
    </div>
  );
}
