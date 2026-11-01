import { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

import { getArt, type ArtSlot } from '@/art';
import { useReduceMotion } from '@/hooks/useReduceMotion';

interface Props {
  slot: ArtSlot;
  style?: StyleProp<ImageStyle>;
  /** Shown when no artwork exists for the slot yet (the built-in drawing). */
  fallback: React.ReactNode;
  resizeMode?: 'cover' | 'contain';
}

/** Real artwork for a slot with a soft fade-in, or the built-in drawing when none has been added. */
export function ArtImage({ slot, style, fallback, resizeMode = 'cover' }: Props) {
  const source = getArt(slot);
  const reduce = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [opacity, reduce]);

  if (!source) return <>{fallback}</>;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      <Image source={source} style={[styles.image, style]} resizeMode={resizeMode} accessibilityIgnoresInvertColors />
    </Animated.View>
  );
}

const styles = StyleSheet.create({ image: { width: '100%', height: '100%' } });
