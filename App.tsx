import { useCallback, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { CARD_COLOR, Overlay, type Rect } from './src/Overlay';

const CARD: Rect = {
  x: 20,
  y: 120,
  w: Dimensions.get('window').width - 40,
  h: 100,
};
const GAP_REPORTED_OVER_MS = 50;

export default function App() {
  const [session, setSession] = useState(0);
  const [open, setOpen] = useState(false);
  const [longestGap, setLongestGap] = useState(0);
  const longest = useSharedValue(0);

  // The UI runtime's frame callback runs on the main thread on iOS, so a long
  // gap between two of its frames means the main thread was blocked.
  useFrameCallback((frame) => {
    const gap = frame.timeSincePreviousFrame;
    if (gap !== null && gap > GAP_REPORTED_OVER_MS && gap > longest.get()) {
      longest.set(gap);
      scheduleOnRN(setLongestGap, Math.round(gap));
    }
  });

  const onPress = useCallback(() => {
    longest.set(0);
    setLongestGap(0);
    setSession((s) => s + 1);
    setOpen(true);
  }, [longest]);
  const onClosed = useCallback(() => setOpen(false), []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Skia 3.9</Text>
      <Pressable style={styles.card} onPress={onPress}>
        <Text style={styles.cardText}>Tap to open</Text>
      </Pressable>
      {open && <Overlay key={session} origin={CARD} onClosed={onClosed} />}
      <Text style={styles.readout} pointerEvents="none">
        {longestGap > 0
          ? `Longest UI thread gap since the tap: ${longestGap} ms`
          : `No UI thread gap over ${GAP_REPORTED_OVER_MS} ms since the tap`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020B14' },
  title: {
    position: 'absolute',
    top: 70,
    left: 20,
    color: 'white',
    fontSize: 28,
    fontWeight: '600',
  },
  card: {
    position: 'absolute',
    left: CARD.x,
    top: CARD.y,
    width: CARD.w,
    height: CARD.h,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: CARD_COLOR,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cardText: { color: 'white', fontSize: 20 },
  readout: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    color: 'white',
    fontSize: 15,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    overflow: 'hidden',
    padding: 8,
  },
});
