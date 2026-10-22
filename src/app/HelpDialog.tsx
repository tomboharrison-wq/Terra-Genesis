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
              <kbd>P</kbd> play/pause · <kbd>.</kbd> step
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
        fields directly. <b>Surface water</b> is simulated: rain, springs, infiltration and evaporation add or remove real volume, and a
        shallow-water solver moves it downhill by water-surface slope with bed friction, so it ponds, fills lakes, spills over saddles and
        drains to the sea or open map edges. The water budget panel shows that volume is conserved. Cells below sea level are treated as sea.
        Erosion and deposition are the next milestone and are not simulated yet.
      </p>
    </Dialog>
  );
}
