import { Children, isValidElement, cloneElement } from 'react';
import { View } from 'react-native';
import SectionHeader from './SectionHeader';
import Callout from './Callout';
import { ledgerSpace } from '../../theme/ledger';

// A run of ListRows under an optional sentence-case SectionHeader, a section
// gap above (Settings, the You tab). Flagged-off children (`false`) are
// dropped first; the last row has no divider. A Callout among the rows (a
// permission note under its row) doesn't count as the last row. A group left
// with nothing renders nothing. A row wrapped in another component (Settings'
// currency picker) gets `divider` passed down and has to set it itself.
export default function ListGroup({ title, children }) {
  const items = Children.toArray(children).filter(isValidElement);
  if (items.length === 0) return null;
  let lastRow = -1;
  items.forEach((el, i) => {
    if (el.type !== Callout) lastRow = i;
  });
  return (
    <View style={{ marginTop: ledgerSpace.section }}>
      {!!title && <SectionHeader title={title} />}
      {items.map((el, i) => (i === lastRow ? cloneElement(el, { divider: false }) : el))}
    </View>
  );
}
