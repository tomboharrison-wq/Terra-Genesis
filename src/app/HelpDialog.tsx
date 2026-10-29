import { Dialog } from './Dialog';
import { useUi } from '../state/uiStore';
import { TOOLS } from './tools';

export function HelpDialog() {
  const close = () => useUi.getState().set({ dialog: null });
  return (
    <Dialog title="Help" onClose={close}>
      <div className="help-cols">
        <section>
          <h3>Camera</h3>
          <ul>
            <li>Navigate tool: drag to orbit</li>
            <li>Right-drag or Shift-drag: pan</li>
            <li>Scroll / pinch: zoom to cursor</li>
            <li>
              With a brush: hold <kbd>Space</kbd> or <kbd>⌥ Option</kbd> and drag to orbit
            </li>
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
      <h3>What is simulated</h3>
      <ul className="small help-sim">
        <li>
          <b>Ground</b>: bedrock in up to four rock layers plus loose sediment, per cell. Brushes, earthquakes, volcanoes and meteors change these fields; the
          surface is always bedrock + sediment.
        </li>
        <li>
          <b>Water</b>: rain, springs, infiltration and evaporation add or remove real volume; a shallow-water solver (on the GPU where available) routes it to
          lakes, rivers and the sea, and the water budget shows it is conserved.
        </li>
        <li>
          <b>Erosion and deposition</b>: flowing water picks up, carries and drops sediment; weak rock wears faster; slopes creep, weather and fail. Long-term
          change is sped up by the erosion speed-up you set.
        </li>
        <li>
          <b>Geological time</b> (time bar → Geological time): thousands to millions of years. A separate long-timescale landscape model — rivers cut down by
          stream power, soil forms and creeps, over-steep slopes fail, sediment fills lakes and the sea, optional uplift — run in the background; rivers and
          lakes are drawn from the drainage. Replay goes back to any recorded moment. The lowland-river lesson adds a meandering river (bank erosion and
          point bars, neck cut-offs → oxbow lakes, flood deposits → levees and floodplain). No glaciers, waves, lava or plants in geological time.
        </li>
        <li>
          <b>Coasts, climate, snow, glaciers, plants, plates, lava and ash</b> run on their own clocks with stated time compression.
        </li>
        <li>
          <b>Hazards</b>: storms, droughts and sea surges run through the water model; the sea surge is a level rise, not a travelling wave.
        </li>
        <li>
          <b>Guided models</b> (labs and some lessons, always badged) are teaching models drawn from rules, not the map simulation.
        </li>
      </ul>
      <p className="hint small">
        Known limits: one sediment size; no isostasy; inland ground below sea level counts as sea; no travelling waves; glaciers are plan-view.
      </p>
      <p className="hint small version">Version {__APP_VERSION__}</p>
    </Dialog>
  );
}
