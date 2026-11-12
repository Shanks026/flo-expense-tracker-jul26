import { useRef } from 'react';
import { MoreHorizontal } from 'lucide-react-native';
import HeaderIconButton from './HeaderIconButton';
import Sheet from './Sheet';
import ListRow from './ListRow';
import useSheetBackHandler from '../../hooks/useSheetBackHandler';

// A row's or header's extra actions (spec 48): a 40 dp ⋯ circle that opens a
// small Sheet of ListRow actions, in place of per-row text buttons.
//
// `actions`: [{ key, title, icon, onPress, danger? }]. A tapped action runs
// once the menu has closed, so an action that opens another sheet doesn't
// stack it on top of this one. `title` heads the menu (usually the item's
// name); `accessibilityLabel` names the ⋯ button ("More for Personal").
export default function OverflowMenu({ title, actions, accessibilityLabel = 'More' }) {
  const sheetRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(sheetRef);
  const pendingRef = useRef(null);

  function choose(action) {
    pendingRef.current = action.onPress;
    sheetRef.current?.dismiss();
  }

  function handleDismiss() {
    const run = pendingRef.current;
    pendingRef.current = null;
    run?.();
  }

  return (
    <>
      <HeaderIconButton icon={MoreHorizontal} onPress={() => sheetRef.current?.present()} accessibilityLabel={accessibilityLabel} />
      {/* push: a menu opened from a row inside another sheet (the switcher)
          stacks on it instead of closing it, which would unmount the menu. */}
      <Sheet ref={sheetRef} title={title} onChange={handleSheetChange} onDismiss={handleDismiss} stackBehavior="push">
        {actions.map((action, i) => (
          <ListRow
            key={action.key ?? action.title}
            icon={action.icon}
            title={action.title}
            danger={action.danger}
            onPress={() => choose(action)}
            divider={i < actions.length - 1}
          />
        ))}
      </Sheet>
    </>
  );
}
