import { Tabs } from 'expo-router';
import TabBar from '../../components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions' }} />
      <Tabs.Screen name="budgets" options={{ title: 'Budgets' }} />
      {/* Plans is back in the tab bar and Bills is back in the menu sheet
          (2026-07-13), reversing the 2026-07-11 swap — real usage went the other
          way than expected once plans were actually being used. The tab slot has
          now moved twice; it is not sacred. */}
      <Tabs.Screen name="plans" options={{ title: 'Plans' }} />
    </Tabs>
  );
}
