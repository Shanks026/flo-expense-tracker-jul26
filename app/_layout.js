import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { DataRefreshProvider } from '../lib/DataRefreshContext';
import { AccountProvider } from '../lib/AccountContext';
import { AddTransactionSheetProvider } from '../components/AddTransactionSheet';
import { AddBudgetSheetProvider } from '../components/AddBudgetSheet';
import { AddPlanSheetProvider } from '../components/AddPlanSheet';
import { EditProfileSheetProvider } from '../components/EditProfileSheet';
import { AddCategorySheetProvider } from '../components/AddCategorySheet';
import { AddAccountSheetProvider } from '../components/AddAccountSheet';
import { AccountSwitcherSheetProvider } from '../components/AccountSwitcherSheet';
import { MenuSheetProvider } from '../components/MenuSheet';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onSignIn = segments[0] === 'sign-in';
    if (!session && !onSignIn) {
      router.replace('/sign-in');
    } else if (session && onSignIn) {
      router.replace('/');
    }
  }, [session, loading, segments]);

  if (loading) return null;

  return (
    <DataRefreshProvider>
      <AccountProvider>
        <BottomSheetModalProvider>
          <AddTransactionSheetProvider>
            <AddBudgetSheetProvider>
              <AddPlanSheetProvider>
                <EditProfileSheetProvider>
                  <AddCategorySheetProvider>
                    <AddAccountSheetProvider>
                      <AccountSwitcherSheetProvider>
                        <MenuSheetProvider>
                          <Stack screenOptions={{ headerShown: false }} />
                        </MenuSheetProvider>
                      </AccountSwitcherSheetProvider>
                    </AddAccountSheetProvider>
                  </AddCategorySheetProvider>
                </EditProfileSheetProvider>
              </AddPlanSheetProvider>
            </AddBudgetSheetProvider>
          </AddTransactionSheetProvider>
        </BottomSheetModalProvider>
      </AccountProvider>
    </DataRefreshProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      setReady(true);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
