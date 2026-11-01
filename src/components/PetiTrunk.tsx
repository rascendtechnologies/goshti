import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { ArtImage } from './ArtImage';

/** Aaji's peti — a little wooden trunk with its lid open and a warm glow of stories inside. */
export function PetiTrunk({ height = 120 }: { height?: number }) {
  return (
    <View style={[styles.frame, { height, width: height * 1.4 }]} accessibilityLabel="आजीची पेटी" accessibilityRole="image">
      <ArtImage
        slot="peti"
        resizeMode="contain"
        fallback={
          <Svg width="100%" height="100%" viewBox="0 0 140 100">
            <Defs>
              <RadialGradient id="petiGlow" cx="50%" cy="40%" r="60%">
                <Stop offset="0" stopColor="#FFE9A8" stopOpacity={0.95} />
                <Stop offset="1" stopColor="#FFE9A8" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={70} cy={42} r={44} fill="url(#petiGlow)" />
            {/* lid, open */}
            <Path d="M26 46 L34 12 Q70 4 106 12 L114 46 Z" fill="#9A5A32" />
            <Path d="M34 12 Q70 4 106 12" stroke="#C98B55" strokeWidth={3} fill="none" />
            <Rect x={30} y={30} width={80} height={4} fill="#7A4524" opacity={0.5} />
            {/* little stars rising */}
            <G fill="#FFF3C4">
              <Path d="M58 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
              <Path d="M82 22 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z" />
              <Circle cx={70} cy={16} r={2} />
            </G>
            {/* body */}
            <Rect x={22} y={46} width={96} height={44} rx={6} fill="#B9703E" />
            <Rect x={22} y={46} width={96} height={8} fill="#8F5330" />
            <Rect x={22} y={62} width={96} height={3} fill="#8F5330" opacity={0.6} />
            <Rect x={32} y={46} width={6} height={44} fill="#E3A23A" opacity={0.9} />
            <Rect x={102} y={46} width={6} height={44} fill="#E3A23A" opacity={0.9} />
            <Rect x={63} y={54} width={14} height={16} rx={3} fill="#E3A23A" />
            <Circle cx={70} cy={62} r={2.4} fill="#8F5330" />
          </Svg>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({ frame: { alignSelf: 'center' } });
