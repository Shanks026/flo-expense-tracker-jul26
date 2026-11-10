import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

// Whether the software keyboard is up. Sheets use it to drop the nav-bar
// inset under their pinned footer while the keyboard is showing, so Save
// sits right on the keyboard.
export default function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
