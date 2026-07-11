import { useCallback, useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

// @gorhom/bottom-sheet (v5) has no built-in Android hardware-back handling —
// with nothing to intercept it, a back press while a sheet is open falls
// through to expo-router/React Navigation, and since Home is the root screen
// with nothing to pop to, that means the OS's default "exit app" behavior.
// Every sheet in this app is mounted persistently (open/closed, not
// mounted/unmounted), so each one registers its own listener but only acts
// while *it* is actually open (tracked via BottomSheetModal's onChange,
// since the library exposes no other "is this modal open" signal) — RN's
// BackHandler already supports multiple simultaneously-registered listeners,
// invoking the most-recently-registered first until one returns true, so
// only the currently-open sheet (if any) intercepts the press; every other
// mounted-but-closed sheet returns false and lets it fall through.
//
// Usage: const handleSheetChange = useSheetBackHandler(modalRef);
//        <BottomSheetModal ref={modalRef} onChange={handleSheetChange} ...>
export default function useSheetBackHandler(modalRef) {
  const isOpenRef = useRef(false);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isOpenRef.current) return false;
      modalRef.current?.dismiss();
      return true;
    });
    return () => subscription.remove();
  }, [modalRef]);

  return useCallback((index) => {
    isOpenRef.current = index >= 0;
  }, []);
}
