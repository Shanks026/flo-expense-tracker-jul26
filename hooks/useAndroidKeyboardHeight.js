import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

// Android 16 is edge-to-edge, so the window doesn't resize for the keyboard:
// a screen with a pinned footer pads itself by this instead. Measured from
// the keyboard's top edge to the bottom of the screen, because the reported
// height alone leaves out the navigation bar the screen draws under (the
// same rule as app/assistant.js). 0 on iOS and while the keyboard is down.
export default function useAndroidKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setHeight(Math.max(0, Dimensions.get('screen').height - e.endCoordinates.screenY))
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
