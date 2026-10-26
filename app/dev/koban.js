import { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import Koban from '../../components/koban/Koban';
import { MOODS } from '../../components/koban/faces';
import { POSES, POSE_NAMES } from '../../components/koban/poses';
import Row, { RowGroup } from '../../components/Row';
import SegmentedChoice from '../../components/SegmentedChoice';
import { fontFamily, type, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

// Development-only Koban gallery (37-design-system-and-koban.md): a live Koban
// whose mood and pose can be switched (to see the crossfade and each move),
// every size, every mood and every pose, on light and dark, with the motion,
// loop and scarf switches. Release
// (store) builds have __DEV__ false, so the route sends them Home and nothing
// links here outside a development build.
export default function KobanGallery() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Gallery />;
}

const STAGES = [
  { label: 'Light', bg: '#FFFFFF', fg: '#101010', surface: 'light' },
  { label: 'Dark', bg: '#111111', fg: '#EDEDE8', surface: 'dark' },
];

function Gallery() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [animated, setAnimated] = useState(true);
  const [loop, setLoop] = useState(true);
  const [scarf, setScarf] = useState(false);
  const [mood, setMood] = useState('neutral');
  const [pose, setPose] = useState('idle');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <RowGroup title="Koban">
        <Row title="Motion" switchValue={animated} onSwitchChange={setAnimated} />
        <Row title="Loop" hint="Off plays the pose once, then settles into idle." switchValue={loop} onSwitchChange={setLoop} />
        <Row title="Scarf" switchValue={scarf} onSwitchChange={setScarf} />
        <Row title="Mood">
          <SegmentedChoice
            accessibilityLabel="Koban's mood"
            options={MOODS.map((m) => ({ value: m, label: m }))}
            value={mood}
            onChange={setMood}
          />
        </Row>
        <Row title="Pose">
          <SegmentedChoice
            accessibilityLabel="Koban's pose"
            options={POSE_NAMES.map((p) => ({ value: p, label: p }))}
            value={pose}
            onChange={(p) => {
              setPose(p);
              setMood(POSES[p].mood);
            }}
          />
        </Row>
      </RowGroup>

      {STAGES.map((stage) => (
        <View key={stage.label} style={[styles.stage, { backgroundColor: stage.bg }]}>
          <Text style={[styles.stageLabel, { color: stage.fg }]}>{stage.label} · live</Text>
          <View style={styles.sizes}>
            {[48, 96, 160].map((size) => (
              <Koban key={size} size={size} mood={mood} pose={pose} loop={loop} animated={animated} scarf={scarf} surface={stage.surface} />
            ))}
          </View>

          <Text style={[styles.stageLabel, styles.gridLabel, { color: stage.fg }]}>Every mood</Text>
          <View style={styles.grid}>
            {MOODS.map((m) => (
              <View key={m} style={styles.gridCell}>
                <Koban size={72} mood={m} animated={animated} scarf={scarf} surface={stage.surface} />
                <Text style={[styles.cellLabel, { color: stage.fg }]}>{m}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.stageLabel, styles.gridLabel, { color: stage.fg }]}>Every pose</Text>
          <View style={styles.grid}>
            {POSE_NAMES.map((p) => (
              <View key={p} style={styles.gridCell}>
                <Koban size={72} pose={p} mood={POSES[p].mood} animated={animated} scarf={scarf} surface={stage.surface} />
                <Text style={[styles.cellLabel, { color: stage.fg }]}>{p}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.sectionLg,
    },
    stage: {
      marginTop: spacing.xl,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    stageLabel: {
      fontFamily: fontFamily.bold,
      fontSize: type.caption,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    gridLabel: {
      marginTop: spacing.xl,
    },
    sizes: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      marginTop: spacing.md,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: spacing.sm,
    },
    gridCell: {
      width: '33.33%',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    cellLabel: {
      fontFamily: fontFamily.semibold,
      fontSize: type.caption,
      marginTop: spacing.xs,
    },
  });
}
