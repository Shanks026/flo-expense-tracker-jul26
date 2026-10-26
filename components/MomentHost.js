import { useCallback, useEffect } from 'react';
import { useActiveMoment, finishMoment } from '../lib/momentQueue';
import { DueBillsMoment } from './DueBillsModal';

// Renders whichever moment lib/momentQueue.js says is on now, one at a time.
// Each kind maps to a renderer that takes `payload` and `onDone`; onDone ends
// the moment, and `onDone({ skipped: true })` gives the takeover back when it
// turned out to have nothing to show. Mounted once in app/_layout.js, inside
// the toast provider so ambient moments can use it.
const RENDERERS = {
  'bills-due': DueBillsMoment,
};

export default function MomentHost() {
  const moment = useActiveMoment();
  const id = moment?.id;
  const onDone = useCallback((options) => finishMoment(id, options), [id]);
  const Renderer = moment ? RENDERERS[moment.kind] : null;

  // An unknown kind (say, saved by a newer build) is dropped, not stuck.
  useEffect(() => {
    if (moment && !Renderer) finishMoment(moment.id, { skipped: true });
  }, [moment, Renderer]);

  if (!moment || !Renderer) return null;
  return <Renderer key={moment.id} payload={moment.payload} onDone={onDone} />;
}
