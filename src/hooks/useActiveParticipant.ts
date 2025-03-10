import { DailyEventObjectActiveSpeakerChange } from '@daily-co/daily-js';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { activeIdState } from '../DailyParticipants';
import { useDaily } from './useDaily';
import { useDailyEvent } from './useDailyEvent';
import { useParticipant } from './useParticipant';

interface UseActiveParticipantArgs {
  /**
   * If set to true, useActiveParticipant will never return the local participant.
   */
  ignoreLocal?: boolean;
  /**
   * Optional event callback for [active-speaker-change](https://docs.daily.co/reference/daily-js/events/meeting-events#active-speaker-change) event listener.
   */
  onActiveSpeakerChange?(ev: DailyEventObjectActiveSpeakerChange): void;
}

/**
 * Returns the most recent participant mentioned in an [active-speaker-change](https://docs.daily.co/reference/daily-js/events/meeting-events#active-speaker-change) event.
 */
export const useActiveParticipant = ({
  ignoreLocal = false,
  onActiveSpeakerChange,
}: UseActiveParticipantArgs = {}) => {
  const daily = useDaily();
  const recentActiveId = useRecoilValue(activeIdState);
  const [activeId, setActiveId] = useState('');
  const activeParticipant = useParticipant(activeId);

  useEffect(() => {
    if (!daily) return;
    const local = daily?.participants()?.local;
    if (ignoreLocal && recentActiveId === local?.session_id) return;

    // setting activeId as string to avoid passing null to useParticipant hook
    setActiveId(recentActiveId ?? '');
  }, [daily, ignoreLocal, recentActiveId]);

  useDailyEvent(
    'active-speaker-change',
    useCallback(
      (ev: DailyEventObjectActiveSpeakerChange) => {
        onActiveSpeakerChange?.(ev);
      },
      [onActiveSpeakerChange]
    )
  );

  return activeParticipant;
};
