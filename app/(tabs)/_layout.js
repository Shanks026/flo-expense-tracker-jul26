import { Tabs } from 'expo-router';
import TabBar from '../../components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions' }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics' }} />
      {/* Budgets swapped out for Analytics here (2026-07-18) — Budgets moved
          to a pushed screen reached from the Menu sheet, alongside Plans, so
          the two sit consistently; Analytics took the tab slot as the
          more-frequently-used screen. Plans moved back out to the Menu sheet
          (2026-07-14) — its slot in the tab bar is now a "Menu" action button
          instead (see TabBar.js), since the menu was otherwise only reachable
          via Home's header, hard to get to from other tabs. The tab slot has
          moved several times now across this app's history; it is not
          sacred. */}
    </Tabs>
  );
}
