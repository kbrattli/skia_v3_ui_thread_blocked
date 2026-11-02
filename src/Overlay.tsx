import { useCallback, useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  ClipEasings,
  SmoothClipView,
  useSmoothClipController,
  type SmoothClipPresentation,
} from 'react-native-smooth-clip-view';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { SunCard } from './SunCard';

/**
 * true: the clip window is written per frame on the UI thread, so a blocked
 * main thread freezes it where it is and the stall is easy to see.
 * false: the window runs on Core Animation, as my shipped app does. It keeps
 * moving through the stall while everything else on the UI thread freezes.
 */
const CLIP_ON_UI_THREAD = true;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DURATION = 400;
const TIMING = { duration: DURATION, easing: Easing.out(Easing.cubic) };
const NATIVE_TIMING = {
  type: 'timing',
  duration: DURATION,
  controlPoints: ClipEasings.easeOutCubic,
} as const;
const SHADOW = {
  color: 0x00000040 as unknown as string,
  offsetX: 0,
  offsetY: 2,
  blurRadius: 16,
  spreadDistance: 0,
};
const PREPARE_MAX_MS = 150;

export const CARD_COLOR = '#5B5BE0';

export type Rect = { x: number; y: number; w: number; h: number };

/** The window at `progress`: 0 is on the card, 1 is the whole screen. */
function presentation(origin: Rect, progress: number): SmoothClipPresentation {
  'worklet';
  const x = origin.x * (1 - progress);
  const y = origin.y * (1 - progress);
  return {
    clip: {
      x,
      y,
      width: origin.w + (SCREEN_WIDTH - origin.w) * progress,
      height: origin.h + (SCREEN_HEIGHT - origin.h) * progress,
      radius: 20,
      curve: 'continuous',
    },
    contentTranslateX: x,
    contentTranslateY: y,
    contentScale: 1,
    boxShadow: SHADOW,
  };
}

/** Calls `done` in the first UI frame `ready()` holds, or after `maxMs`. */
function waitOnUI(ready: () => boolean, maxMs: number, done: () => void) {
  'worklet';
  let start = -1;
  const step = (now: number) => {
    if (start < 0) start = now;
    if (ready() || now - start >= maxMs) done();
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

type Props = { origin: Rect; onClosed: () => void };

/**
 * Mounts parked one screen to the right with the window on the card, slides
 * into place once the native host is ready, then opens. The page, with the
 * Skia canvas in it, is already mounting by then, so the canvas draws during
 * the open.
 */
export function Overlay({ origin, onClosed }: Props) {
  const clip = useSmoothClipController(presentation(origin, 0));
  const shown = useSharedValue(0);
  const closing = useSharedValue(false);
  const clock = useSharedValue(0);
  const range = useSharedValue({ from: 0, to: 0 });

  const animate = useCallback(
    (to: number) => {
      'worklet';
      const { from, to: last } = range.get();
      const current = from + (last - from) * clock.get();
      cancelAnimation(clock);
      range.set({ from: current, to });
      clock.set(0);
      clip.ui.beginInteraction();
      const target = presentation(origin, to);
      if (!CLIP_ON_UI_THREAD && clip.ui.animateTo(target, NATIVE_TIMING) === null) {
        clip.ui.setFrame(target);
      }
      clock.set(
        withTiming(1, TIMING, (finished) => {
          if (!finished) return;
          clip.ui.setFrame(target);
          if (to === 0) scheduleOnRN(onClosed);
        })
      );
    },
    [clip, clock, onClosed, origin, range]
  );

  useAnimatedReaction(
    () => clock.get(),
    (value) => {
      if (!CLIP_ON_UI_THREAD) return;
      const { from, to } = range.get();
      clip.ui.setFrame(presentation(origin, from + (to - from) * value));
    }
  );

  useEffect(() => {
    scheduleOnUI(() => {
      'worklet';
      waitOnUI(
        () => clip.ui.isReady(),
        PREPARE_MAX_MS,
        () => {
          shown.set(1);
          animate(1);
        }
      );
    });
  }, [animate, clip, shown]);

  const close = useCallback(() => {
    scheduleOnUI(() => {
      'worklet';
      if (closing.get()) return;
      closing.set(true);
      animate(0);
    });
  }, [animate, closing]);

  const parkStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shown.get() === 1 ? 0 : SCREEN_WIDTH }],
  }));

  return (
    <Animated.View style={[styles.fullscreen, styles.overlay, parkStyle]}>
      <SmoothClipView
        controller={clip}
        shadowRendering="baked"
        style={styles.fullscreen}
      >
        <Pressable style={styles.page} onPress={close}>
          <Text style={styles.heading}>Tap anywhere to close</Text>
          <SunCard />
        </Pressable>
      </SmoothClipView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullscreen: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  overlay: { position: 'absolute', top: 0, left: 0 },
  page: {
    flex: 1,
    backgroundColor: CARD_COLOR,
    paddingTop: 120,
    paddingHorizontal: 20,
    gap: 24,
  },
  heading: { color: 'white', fontSize: 20 },
});
