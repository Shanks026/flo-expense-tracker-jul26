import { Tabs } from 'expo-router';
import TabBar from '../../components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
      {/* Home · Transactions · (+) · Insights · More (38-home-insights-more.md).
          Insights is the old Analytics tab renamed; More replaced the Menu
          action and its sheet. The + sits in TabBar.js, between the halves. */}
    </Tabs>
  );
}
