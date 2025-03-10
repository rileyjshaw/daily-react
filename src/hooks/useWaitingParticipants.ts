import {
  DailyEventObjectWaitingParticipant,
  DailyWaitingParticipant,
} from '@daily-co/daily-js';
import { useCallback } from 'react';
import {
  atom,
  atomFamily,
  selector,
  useRecoilCallback,
  useRecoilValue,
} from 'recoil';

import { RECOIL_PREFIX } from '../lib/constants';
import { useDaily } from './useDaily';
import { useDailyEvent } from './useDailyEvent';

interface UseWaitingParticipantsArgs {
  onWaitingParticipantAdded?(ev: DailyEventObjectWaitingParticipant): void;
  onWaitingParticipantUpdated?(ev: DailyEventObjectWaitingParticipant): void;
  onWaitingParticipantRemoved?(ev: DailyEventObjectWaitingParticipant): void;
}

const waitingParticipantsState = atom<string[]>({
  key: RECOIL_PREFIX + 'waiting-participants',
  default: [],
});

export const waitingParticipantState = atomFamily<
  DailyWaitingParticipant,
  string
>({
  key: RECOIL_PREFIX + 'waiting-participant',
  default: {
    awaitingAccess: {
      level: 'full',
    },
    id: '',
    name: '',
  },
});

export const allWaitingParticipantsSelector = selector({
  key: RECOIL_PREFIX + 'waitingParticipantsSelector',
  get: ({ get }) => {
    const ids = get(waitingParticipantsState);
    return ids.map((id) => get(waitingParticipantState(id)));
  },
});

/**
 * Hook to access and manage waiting participants.
 */
export const useWaitingParticipants = ({
  onWaitingParticipantAdded,
  onWaitingParticipantRemoved,
  onWaitingParticipantUpdated,
}: UseWaitingParticipantsArgs = {}) => {
  const daily = useDaily();

  const waitingParticipants = useRecoilValue(allWaitingParticipantsSelector);

  const handleAdded = useRecoilCallback(
    ({ transact_UNSTABLE }) =>
      (ev: DailyEventObjectWaitingParticipant) => {
        transact_UNSTABLE(({ set }) => {
          set(waitingParticipantsState, (wps) => {
            if (!wps.includes(ev.participant.id)) {
              return [...wps, ev.participant.id];
            }
            return wps;
          });
          set(waitingParticipantState(ev.participant.id), ev.participant);
        });
        onWaitingParticipantAdded?.(ev);
      },
    [onWaitingParticipantAdded]
  );

  const handleRemoved = useRecoilCallback(
    ({ transact_UNSTABLE }) =>
      (ev: DailyEventObjectWaitingParticipant) => {
        transact_UNSTABLE(({ reset, set }) => {
          set(waitingParticipantsState, (wps) =>
            wps.filter((wp) => wp !== ev.participant.id)
          );
          reset(waitingParticipantState(ev.participant.id));
        });
        onWaitingParticipantRemoved?.(ev);
      },
    [onWaitingParticipantRemoved]
  );

  const handleUpdated = useRecoilCallback(
    ({ set }) =>
      (ev: DailyEventObjectWaitingParticipant) => {
        set(waitingParticipantState(ev.participant.id), ev.participant);
        onWaitingParticipantUpdated?.(ev);
      },
    [onWaitingParticipantUpdated]
  );

  useDailyEvent('waiting-participant-added', handleAdded);
  useDailyEvent('waiting-participant-removed', handleRemoved);
  useDailyEvent('waiting-participant-updated', handleUpdated);

  const updateWaitingParticipantAccess = useCallback(
    (id: '*' | string, grantRequestedAccess: boolean) => {
      if (id === '*') {
        daily?.updateWaitingParticipants({
          '*': {
            grantRequestedAccess,
          },
        });
        return;
      }
      daily?.updateWaitingParticipant(id, {
        grantRequestedAccess,
      });
    },
    [daily]
  );

  const grantAccess = useCallback(
    (id: '*' | string) => {
      updateWaitingParticipantAccess(id, true);
    },
    [updateWaitingParticipantAccess]
  );

  const denyAccess = useCallback(
    (id: '*' | string) => {
      updateWaitingParticipantAccess(id, false);
    },
    [updateWaitingParticipantAccess]
  );

  return {
    waitingParticipants,
    grantAccess,
    denyAccess,
  };
};
