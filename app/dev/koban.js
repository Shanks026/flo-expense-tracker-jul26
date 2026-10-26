import { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import Koban from '../../components/koban/Koban';
import Row, { RowGroup } from '../../components/Row';
import { fontFamily, type, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

// Development-only Koban gallery (37-design-system-and-koban.md): every size
// on light and dark, with the motion and scarf switches. Release (store)
// builds have __DEV__ false, so the route sends them Home and nothing links
// here outside a development build.
export default function KobanGallery() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Gallery />;
}

function Gallery() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loop, setLoop] = useState(true);
  const [scarf, setScarf] = useState(false);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <RowGroup title="Koban">
        <Row title="Motion" switchValue={loop} onSwitchChange={setLoop} />
        <Row title="Scarf" switchValue={scarf} onSwitchChange={setScarf} />
      </RowGroup>

      {[
        ['Light', '#FFFFFF', 'light'],
        ['Dark', '#111111', 'dark'],
      ].map(([label, bg, surface]) => (
        <View key={label} style={[styles.stage, { backgroundColor: bg }]}>
          <Text style={[styles.stageLabel, { color: surface === 'dark' ? '#EDEDE8' : '#101010' }]}>{label}</Text>
          <View style={styles.sizes}>
            {[48, 96, 160].map((size) => (
              <Koban key={size} size={size} loop={loop} scarf={scarf} surface={surface} />
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
    sizes: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      marginTop: spacing.md,
    },
  });
}
