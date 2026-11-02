import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Canvas } from 'react-native-skia';
import { SunArc } from './SunArcCanvas';
import {
  ARC_STROKE_WIDTH,
  arcPoint,
  SUN_CARD_MIN_HEIGHT,
  SUN_RADIUS,
} from './sunArc';

// A fixed evening, so every run draws the same thing: sunrise and sunset as
// fractions of the day, and the sun below the horizon.
const SUNRISE = 0.4;
const SUNSET = 0.7;
const SUN = 0.85;
const PADDING = 16;
const HEADER = 34;

/**
 * The card around the plain `<Canvas>`. As in the app, the canvas mounts in the
 * commit after the card's first layout, and it has no warm-up, no `static` and
 * no flags.
 */
export function SunCard() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width: Math.round(width), height: Math.round(height) });
  }, []);

  const arc = useMemo(() => {
    const { width, height } = size;
    if (width === 0 || height === 0) return null;
    const top = HEADER;
    const bottom = height - PADDING;
    const centerY = (top + bottom) / 2;
    const amplitude =
      ((bottom - top) / 2 - SUN_RADIUS - ARC_STROKE_WIDTH) * 0.98;
    const arcPeakProgress = (SUNRISE + SUNSET) / 2;
    return {
      width,
      height,
      leftX: PADDING,
      rightX: width - PADDING,
      centerY,
      amplitude,
      arcPeakProgress,
      horizonY:
        centerY -
        amplitude * Math.cos(2 * Math.PI * (SUNRISE - arcPeakProgress)),
    };
  }, [size]);
  const sun = arc ? arcPoint(arc, SUN) : { x: 0, y: 0 };

  return (
    <View style={styles.card} onLayout={onLayout}>
      {arc && (
        <View style={styles.canvasLayer} pointerEvents="none">
          <Canvas style={StyleSheet.absoluteFill}>
            <SunArc arc={arc} sunX={sun.x} sunY={sun.y} daylight={false} />
          </Canvas>
        </View>
      )}
      <Text style={styles.label}>DAYLIGHT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SUN_CARD_MIN_HEIGHT,
    height: SUN_CARD_MIN_HEIGHT,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#0D1B34',
    padding: PADDING,
  },
  canvasLayer: {
    ...StyleSheet.absoluteFill,
    borderRadius: 20,
    overflow: 'hidden',
  },
  label: {
    color: 'white',
    opacity: 0.6,
    fontSize: 12,
    letterSpacing: 1.5,
  },
});
