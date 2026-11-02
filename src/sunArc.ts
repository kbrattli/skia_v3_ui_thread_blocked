import { Skia } from 'react-native-skia';
import { Dimensions } from 'react-native';

/** The card is square at the default width. */
export const SUN_CARD_MIN_HEIGHT = (Dimensions.get('window').width - 52) / 2;
export const SUN_RADIUS = 7;
export const ARC_STROKE_WIDTH = 4;
const WAVE_SEGMENTS = 80;

export type SunArcProps = {
      /** Canvas size; the horizon clips span it. */
      width: number;
      height: number;
      leftX: number;
      rightX: number;
      centerY: number;
      amplitude: number;
      arcPeakProgress: number;
      horizonY: number;
};

/**
 * The arc's point at `progress` (0 = midnight, 0.5 = noon): where the sun
 * sits then. The path is traced through it and the card places the sun with
 * it, so the sun is on the drawn line by construction.
 */
export function arcPoint(arc: SunArcProps, progress: number) {
      return {
            x: arc.leftX + progress * (arc.rightX - arc.leftX),
            y:
                  arc.centerY -
                  arc.amplitude *
                        Math.cos(
                              2 * Math.PI * (progress - arc.arcPeakProgress)
                        ),
      };
}

/** The 24-hour cosine arc, as a path through `arcPoint`. */
export function sunArcPath(arc: SunArcProps) {
      const builder = Skia.PathBuilder.Make();
      for (let i = 0; i <= WAVE_SEGMENTS; i++) {
            const { x, y } = arcPoint(arc, i / WAVE_SEGMENTS);
            if (i === 0) {
                  builder.moveTo(x, y);
            } else {
                  builder.lineTo(x, y);
            }
      }
      return builder.detach();
}
