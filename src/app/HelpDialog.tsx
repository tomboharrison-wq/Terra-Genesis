import { Dialog } from './Dialog';
import { useUi } from '../state/uiStore';
import { TOOLS } from './tools';

export function HelpDialog() {
  const close = () => useUi.getState().set({ dialog: null });
  return (
    <Dialog title="Controls" onClose={close}>
      <div className="help-cols">
        <section>
          <h3>Camera</h3>
          <ul>
            <li>Navigate tool: drag to orbit</li>
            <li>Right-drag or Shift-drag: pan</li>
            <li>Scroll / pinch: zoom to cursor</li>
            <li>With a brush: hold <kbd>Space</kbd> or <kbd>⌥ Option</kbd> and drag to orbit</li>
            <li>
              <kbd>F</kbd> fit · <kbd>T</kbd> top-down · <kbd>O</kbd> oblique · arrows/<kbd>WASD</kbd> pan
            </li>
          </ul>
        </section>
        <section>
          <h3>Tools</h3>
          <ul>
            {TOOLS.map((t) => (
              <li key={t.id}>
                <kbd>{t.key}</kbd> {t.label}
              </li>
            ))}
            <li>
              <kbd>[</kbd> / <kbd>]</kbd> brush radius
            </li>
            <li>
              <kbd>⌘Z</kbd> undo · <kbd>⇧⌘Z</kbd> redo · <kbd>⌘S</kbd> save
            </li>
          </ul>
        </section>
      </div>
      <h3>What is simulated so far</h3>
      <p className="small">
        Terrain is a heightfield of <b>bedrock</b> plus <b>loose sediment</b> with a bedrock <b>lithology</b> per cell. Brushes change those
        fields directly. The sea surface shows the sea-level setting only. Water flow, erosion and deposition are the next milestones and are
        not simulated yet.
      </p>
    </Dialog>
  );
}
