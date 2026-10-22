import { useEffect } from 'react';
import { useUi } from '../state/uiStore';
import { engine, getScene, saveToSlot } from './runtime';
import { TOOLS } from './tools';
import { isTyping } from './Viewport';

const PAN: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, 1], KeyW: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1],
};

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if (isTyping(e) || ui.dialog) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) engine.redo();
        else engine.undo();
        return;
      }
      if (mod && e.code === 'KeyY') {
        e.preventDefault();
        engine.redo();
        return;
      }
      if (mod && e.code === 'KeyS') {
        e.preventDefault();
        void saveToSlot(`slot:${engine.world.meta.name}`, engine.world.meta.name);
        return;
      }
      if (mod || e.altKey) return;
      const tool = TOOLS.find((t) => t.key === e.key);
      if (tool) return ui.set({ tool: tool.id });
      const s = getScene();
      if (PAN[e.code]) {
        e.preventDefault();
        return s?.panBy(...PAN[e.code]);
      }
      switch (e.key) {
        case '[':
          return ui.set({ radiusM: Math.max((ui.world?.cellSizeM ?? 10) * 1.5, ui.radiusM / 1.15) });
        case ']':
          return ui.set({ radiusM: ui.radiusM * 1.15 });
        case 'f':
        case 'F':
          return s?.fitWorld();
        case 't':
        case 'T':
          return s?.topDown();
        case 'o':
        case 'O':
          return s?.oblique();
        case 'n':
        case 'N':
          return ui.set({ dialog: 'new' });
        case '?':
          return ui.set({ dialog: 'help' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
