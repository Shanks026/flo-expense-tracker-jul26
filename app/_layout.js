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
import { AddTransactionSheetProvider, useAddTransactionSheet } from '../components/AddTransactionSheet';
import { AddBudgetSheetProvider } from '../components/AddBudgetSheet';
import { AddPlanSheetProvider } from '../components/AddPlanSheet';
import { EditProfileSheetProvider } from '../components/EditProfileSheet';
import { AddCategorySheetProvider } from '../components/AddCategorySheet';
import { AddAccountSheetProvider } from '../components/AddAccountSheet';
import { AccountSwitcherSheetProvider } from '../components/AccountSwitcherSheet';
import { MenuSheetProvider } from '../components/MenuSheet';
import useIncomingShare from '../hooks/useIncomingShare';
import { parseTransactionSms } from '../lib/smsParser';

SplashScreen.preventAutoHideAsync();

// Rendered inside the sheet providers (unlike RootNavigator itself, which
// defines them) so it can actually call useAddTransactionSheet().
function ShareIntentHandler() {
  const { session } = useAuth();
  const { sharedText, clearSharedText } = useIncomingShare();
  const { openAdd } = useAddTransactionSheet();

  useEffect(() => {
    if (!sharedText || !session) return;
    const parsed = parseTransactionSms(sharedText);
    openAdd(parsed ? { amount: parsed.amount, type: parsed.type } : { note: sharedText });
    clearSharedText();
  }, [sharedText, session]);

  return null;
}

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
          <AddAccountSheetProvider>
            <AccountSwitcherSheetProvider>
              <AddTransactionSheetProvider>
                <AddBudgetSheetProvider>
                  <AddPlanSheetProvider>
                    <EditProfileSheetProvider>
                      <AddCategorySheetProvider>
                        <MenuSheetProvider>
                          <ShareIntentHandler />
                          <Stack screenOptions={{ headerShown: false }} />
                        </MenuSheetProvider>
                      </AddCategorySheetProvider>
                    </EditProfileSheetProvider>
                  </AddPlanSheetProvider>
                </AddBudgetSheetProvider>
              </AddTransactionSheetProvider>
            </AccountSwitcherSheetProvider>
          </AddAccountSheetProvider>
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
