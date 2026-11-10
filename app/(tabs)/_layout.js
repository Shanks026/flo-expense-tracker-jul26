import { Tabs } from 'expo-router';
import TabBar from '../../components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Activity' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="more" options={{ title: 'You' }} />
      {/* Home · Activity · (+) · Insights · You (spec 46). The route names
          are unchanged from 38-home-insights-more.md; only the titles moved.
          The + sits in TabBar.js, between the halves. */}
    </Tabs>
  );
}
