import { analyse, blockPolygon, polygonArea, SOIL_PRESETS, type SlumpParams } from './model';

/**
 * Coastal slumping cycle (spec E6 "coastal slumping … with protective temporary toe debris"), built on
 * the rotational-slump model. Cross-section state: crest at x = crestM, toe at x = toeM (x seaward),
 * debris apron of area debrisM2 at the toe. Each year:
 *  1. Waves first carry away toe debris (debrisRateM2 × energy); only once it has gone do they cut
 *     the toe itself (toeRateM × energy), which steepens the face.
 *  2. The critical slip circle is found for the current face + apron; if FoS < 1 the slipped block
 *     breaks up into toe debris (same area), and the cliff is rebuilt from a new crest set back so
 *     that the land lost equals that area (toe fixed ⇒ the face relaxes to a gentler angle).
 * So the apron buttresses the cliff for a while, waves unload the toe, and the next slump follows —
 * the episodic retreat of soft-rock coasts. Teaching approximation, not a coastal-management tool.
 */
export interface CoastalSlumpParams {
  soil: keyof typeof SOIL_PRESETS;
  heightM: number;
  /** Initial face angle (degrees). */
  faceDeg: number;
  saturation: number;
  /** Wave energy multiplier (0 = no waves). */
  waveEnergy: number;
  debrisRateM2: number;
  toeRateM: number;
}

export function defaultCoastalSlumpParams(): CoastalSlumpParams {
  return { soil: 'till', heightM: 20, faceDeg: 32, saturation: 0.5, waveEnergy: 1, debrisRateM2: 6, toeRateM: 0.4 };
}

export interface SlumpEvent {
  year: number;
  areaM2: number;
  retreatM: number;
}

/** Steepest face before the material simply falls (rockfall, outside this model). */
const MAX_FACE_DEG = 75;

export class CoastalSlumpModel {
  year = 0;
  crestM = 0;
  toeM = 0;
  debrisM2 = 0;
  slumpedM2 = 0;
  removedM2 = 0;
  toeCutM2 = 0;
  fos = Infinity;
  events: SlumpEvent[] = [];
  /** FoS each year (index = year). */
  fosHistory: number[] = [];

  constructor(public p: CoastalSlumpParams = defaultCoastalSlumpParams()) {
    this.reset();
  }

  reset() {
    this.year = 0;
    this.crestM = 0;
    this.toeM = this.p.heightM / Math.tan((this.p.faceDeg * Math.PI) / 180);
    this.debrisM2 = 0;
    this.slumpedM2 = 0;
    this.removedM2 = 0;
    this.toeCutM2 = 0;
    this.events = [];
    this.fos = this.analyse().fos;
    this.fosHistory = [this.fos];
  }

  get faceDeg(): number {
    return (Math.atan2(this.p.heightM, this.toeM - this.crestM) * 180) / Math.PI;
  }

  /** Slump parameters in the crest frame (crest at x = 0). */
  slumpParams(): SlumpParams {
    return { ...SOIL_PRESETS[this.p.soil], heightM: this.p.heightM, faceDeg: this.faceDeg, saturation: this.p.saturation, toeDebrisM2: this.debrisM2 };
  }

  analyse() {
    return analyse(this.slumpParams());
  }

  /** Advance one year. Returns the slump event if one happened. */
  stepYear(): SlumpEvent | null {
    const p = this.p;
    const H = p.heightM;
    this.year++;
    let budget = p.debrisRateM2 * p.waveEnergy;
    const take = Math.min(budget, this.debrisM2);
    this.debrisM2 -= take;
    this.removedM2 += take;
    budget -= take;
    if (this.debrisM2 <= 1e-9 && p.waveEnergy > 0) {
      // Toe cut: the toe moves landward; the face steepens (capped — beyond that it falls as rock).
      const minRun = H / Math.tan((MAX_FACE_DEG * Math.PI) / 180);
      const cut = Math.min(p.toeRateM * p.waveEnergy, Math.max(0, this.toeM - this.crestM - minRun));
      this.toeM -= cut;
      this.toeCutM2 += (cut * H) / 2;
    }
    const r = this.analyse();
    let ev: SlumpEvent | null = null;
    if (r.failed && r.critical) {
      const area = polygonArea(blockPolygon(r.params, r.critical));
      // Land lost = area: crest moves back by 2·area/H with the toe fixed.
      const back = (2 * area) / H;
      this.crestM -= back;
      this.debrisM2 += area;
      this.slumpedM2 += area;
      ev = { year: this.year, areaM2: area, retreatM: back };
      this.events.push(ev);
      this.fos = this.analyse().fos;
    } else this.fos = r.fos;
    this.fosHistory.push(this.fos);
    return ev;
  }
}
