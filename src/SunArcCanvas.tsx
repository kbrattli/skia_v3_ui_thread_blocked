import {
      Circle,
      Group,
      Line,
      Path,
      Shadow,
      Skia,
      vec,
} from 'react-native-skia';
import { memo, useMemo } from 'react';
import {
      ARC_STROKE_WIDTH,
      SUN_RADIUS,
      sunArcPath,
      type SunArcProps,
} from './sunArc';

const Colors = {
      sun: '#FFFEF5',
      sunNight: '#000000',
      sunGlow: 'rgba(255, 255, 240, 0.8)',
      sunGlowOuter: 'rgba(255, 255, 240, 0.5)',
      sunOutline: 'rgba(255, 255, 255, 0.6)',
      arcAbove: 'rgba(255, 255, 255, 0.35)',
      arcBelow: 'rgba(255, 255, 255, 0.15)',
      horizonLine: '#555555',
};

type Props = {
      arc: SunArcProps;
      sunX: number;
      sunY: number;
      /** Above the horizon the sun is filled; below it is dark with an outline. */
      daylight: boolean;
};

/**
 * The DAYLIGHT card's Skia scene: the 24-hour cosine arc clipped at the
 * horizon, the horizon line, and the sun with its glow. Pure drawing from
 * numbers; `SunPositionDisplay` does the layout and time math.
 */
export const SunArc = memo(function SunArc({
      arc,
      sunX,
      sunY,
      daylight,
}: Props) {
      const { width, height, leftX, rightX, horizonY } = arc;
      const wavePath = useMemo(() => sunArcPath(arc), [arc]);

      const clippedHorizonY = Math.max(0, Math.min(height, horizonY));
      const aboveHorizonClip = useMemo(
            () => Skia.XYWHRect(0, 0, width, clippedHorizonY),
            [width, clippedHorizonY]
      );
      const belowHorizonClip = useMemo(
            () =>
                  Skia.XYWHRect(
                        0,
                        clippedHorizonY,
                        width,
                        height - clippedHorizonY
                  ),
            [width, height, clippedHorizonY]
      );

      return (
            <>
                  {/* The wave, lighter above the horizon than below it. */}
                  <Group clip={aboveHorizonClip}>
                        <Path
                              path={wavePath}
                              style="stroke"
                              strokeWidth={ARC_STROKE_WIDTH}
                              color={Colors.arcAbove}
                              strokeCap="butt"
                        />
                  </Group>
                  <Group clip={belowHorizonClip}>
                        <Path
                              path={wavePath}
                              style="stroke"
                              strokeWidth={ARC_STROKE_WIDTH}
                              color={Colors.arcBelow}
                              strokeCap="butt"
                        />
                  </Group>

                  <Line
                        p1={vec(leftX, horizonY)}
                        p2={vec(rightX, horizonY)}
                        color={Colors.horizonLine}
                        style="stroke"
                        strokeWidth={2}
                  />

                  <Circle
                        cx={sunX}
                        cy={sunY}
                        r={SUN_RADIUS}
                        color={daylight ? Colors.sun : Colors.sunNight}
                  >
                        <Shadow dx={0} dy={0} blur={15} color={Colors.sunGlow} />
                        <Shadow
                              dx={0}
                              dy={0}
                              blur={25}
                              color={Colors.sunGlowOuter}
                        />
                  </Circle>

                  {/* Below the horizon the dark sun gets an outline. */}
                  {!daylight && (
                        <Circle
                              cx={sunX}
                              cy={sunY}
                              r={SUN_RADIUS - 0.5}
                              color={Colors.sunOutline}
                              style="stroke"
                              strokeWidth={1}
                        />
                  )}
            </>
      );
});
