/// <reference types="@types/jest" />

import DailyIframe, { DailyCall, DailyParticipant } from '@daily-co/daily-js';
import { act, render, waitFor } from '@testing-library/react';
import faker from 'faker';
import React from 'react';

import { DailyAudio } from '../../src/components/DailyAudio';
import { DailyProvider } from '../../src/DailyProvider';
import {
  emitActiveSpeakerChange,
  emitParticipantLeft,
  emitParticipantUpdated,
  emitStartedCamera,
  emitTrackStarted,
} from '../.test-utils/event-emitter';

const localSessionId = faker.datatype.uuid();

jest.mock('../../src/hooks/useLocalSessionId', () => ({
  useLocalSessionId: () => localSessionId,
}));
jest.mock('../../src/DailyDevices', () => ({
  DailyDevices: (({ children }) => <>{children}</>) as React.FC,
}));

const createWrapper =
  (callObject: DailyCall = DailyIframe.createCallObject()): React.FC =>
  ({ children }) =>
    <DailyProvider callObject={callObject}>{children}</DailyProvider>;

const emitAudioTrackStarted = (callObject: DailyCall, peerId: string) =>
  emitTrackStarted(
    callObject,
    {
      local: peerId === localSessionId,
      session_id: peerId,
    },
    {
      kind: 'audio',
    }
  );

const queryAudioById = (
  peerId: string,
  container: HTMLElement = document.body
) =>
  container.querySelector(
    `audio[data-session-id="${peerId}"][data-audio-type="audio"]`
  );

describe('DailyAudio', () => {
  it.each([1, 3, 5])('renders maxSpeakers audio tags (%i)', (maxSpeakers) => {
    const Wrapper = createWrapper();
    const { container } = render(
      <Wrapper>
        <DailyAudio maxSpeakers={maxSpeakers} />
      </Wrapper>
    );
    expect(container.querySelectorAll('audio')).toHaveLength(maxSpeakers);
  });

  describe('active speaker', () => {
    it('assigns subscribed speaker to first free slot', async () => {
      const callObject = DailyIframe.createCallObject();
      const peerId = faker.datatype.uuid();
      (callObject.participants as jest.Mock).mockImplementation(() => ({
        local: {
          local: true,
          session_id: localSessionId,
        },
        [peerId]: {
          local: false,
          session_id: peerId,
          tracks: {
            audio: {
              subscribed: true,
            },
          },
        },
      }));
      const Wrapper = createWrapper(callObject);
      const { container } = render(
        <Wrapper>
          <DailyAudio />
        </Wrapper>
      );
      act(() => emitStartedCamera(callObject));
      act(() => emitActiveSpeakerChange(callObject, peerId));
      await waitFor(() => {
        expect(queryAudioById(peerId, container)).not.toBeNull();
      });
    });
    it('ignores unsubscribed speaker', async () => {
      const callObject = DailyIframe.createCallObject();
      const peerId = faker.datatype.uuid();
      (callObject.participants as jest.Mock).mockImplementation(() => ({
        local: {
          local: true,
          session_id: localSessionId,
        },
        [peerId]: {
          local: false,
          session_id: peerId,
          tracks: {
            audio: {
              subscribed: false,
            },
          },
        },
      }));
      const Wrapper = createWrapper(callObject);
      const { container } = render(
        <Wrapper>
          <DailyAudio />
        </Wrapper>
      );
      act(() => emitStartedCamera(callObject));
      act(() => emitActiveSpeakerChange(callObject, peerId));
      await waitFor(() => {
        expect(queryAudioById(peerId, container)).toBeNull();
      });
    });
    it('ignores local participant', async () => {
      const callObject = DailyIframe.createCallObject();
      (callObject.participants as jest.Mock).mockImplementation(() => ({
        local: {
          local: true,
          session_id: localSessionId,
        },
      }));
      const Wrapper = createWrapper(callObject);
      const { container } = render(
        <Wrapper>
          <DailyAudio />
        </Wrapper>
      );
      act(() => emitStartedCamera(callObject));
      act(() => emitActiveSpeakerChange(callObject, localSessionId));
      await waitFor(() => {
        expect(queryAudioById(localSessionId, container)).toBeNull();
      });
    });
  });
  describe('unmuted participant', () => {
    it('assigns subscribed participant to first free slot', async () => {
      const callObject = DailyIframe.createCallObject();
      const peerId = faker.datatype.uuid();
      (callObject.participants as jest.Mock).mockImplementation(() => ({
        local: {
          local: true,
          session_id: localSessionId,
        },
        [peerId]: {
          local: false,
          session_id: peerId,
          tracks: {
            audio: {
              subscribed: true,
            },
          },
        },
      }));
      const Wrapper = createWrapper(callObject);
      const { container } = render(
        <Wrapper>
          <DailyAudio />
        </Wrapper>
      );
      act(() => emitStartedCamera(callObject));
      act(() => emitAudioTrackStarted(callObject, peerId));
      await waitFor(() => {
        expect(queryAudioById(peerId, container)).not.toBeNull();
      });
    });
    it('ignores local participant', async () => {
      const callObject = DailyIframe.createCallObject();
      (callObject.participants as jest.Mock).mockImplementation(() => ({
        local: {
          local: true,
          session_id: localSessionId,
        },
      }));
      const Wrapper = createWrapper(callObject);
      const { container } = render(
        <Wrapper>
          <DailyAudio />
        </Wrapper>
      );
      act(() => emitStartedCamera(callObject));
      act(() => emitAudioTrackStarted(callObject, localSessionId));
      await waitFor(() => {
        expect(queryAudioById(localSessionId, container)).toBeNull();
      });
    });
  });
  describe('left participant', () => {
    it('unassigns audio', async () => {
      const callObject = DailyIframe.createCallObject();
      const peerId = faker.datatype.uuid();
      (callObject.participants as jest.Mock).mockImplementation(() => ({
        local: {
          local: true,
          session_id: localSessionId,
        },
        [peerId]: {
          local: false,
          session_id: peerId,
          tracks: {
            audio: {
              subscribed: true,
            },
          },
        },
      }));
      const Wrapper = createWrapper(callObject);
      const { container } = render(
        <Wrapper>
          <DailyAudio />
        </Wrapper>
      );
      act(() => emitStartedCamera(callObject));
      act(() => emitAudioTrackStarted(callObject, peerId));
      await waitFor(() => {
        expect(queryAudioById(peerId, container)).not.toBeNull();
      });
      act(() =>
        emitParticipantLeft(callObject, { local: false, session_id: peerId })
      );
      await waitFor(() => {
        expect(queryAudioById(peerId, container)).toBeNull();
      });
    });
  });
  describe('replacement logic', () => {
    it('replaces unsubscribed slot', async () => {
      /**
       * Scenario:
       * - Remote participant 1 becomes active speaker (subscribed)
       * - Remote participant 2 becomes active speaker (subscribed)
       * - Unsubscribe from remote participant 2
       * - Remote participant 3 becomes active speaker (subscribed) and replaces slot of participant 2
       */
      const callObject = DailyIframe.createCallObject();
      const remoteParticipants = [
        faker.datatype.uuid(),
        faker.datatype.uuid(),
        faker.datatype.uuid(),
      ];
      (callObject.participants as jest.Mock).mockImplementation(() => {
        const participants: Record<string, Partial<DailyParticipant>> = {
          local: {
            local: true,
            session_id: localSessionId,
          },
        };
        remoteParticipants.forEach((id) => {
          participants[id] = {
            local: false,
            session_id: id,
            // @ts-ignore
            tracks: {
              audio: {
                state: 'playable',
                subscribed: true,
              },
            },
          };
        });
        return participants;
      });
      const Wrapper = createWrapper(callObject);
      const { container } = render(
        <Wrapper>
          <DailyAudio maxSpeakers={2} />
        </Wrapper>
      );
      act(() => emitStartedCamera(callObject));
      act(() => emitActiveSpeakerChange(callObject, remoteParticipants[0]));
      await waitFor(() =>
        expect(queryAudioById(remoteParticipants[0], container)).not.toBeNull()
      );
      act(() => emitActiveSpeakerChange(callObject, remoteParticipants[1]));
      await waitFor(() => {
        expect(queryAudioById(remoteParticipants[0], container)).not.toBeNull();
        expect(queryAudioById(remoteParticipants[1], container)).not.toBeNull();
      });
      act(() =>
        emitParticipantUpdated(callObject, {
          local: false,
          session_id: remoteParticipants[1],
          // @ts-ignore
          tracks: {
            audio: {
              state: 'sendable',
              subscribed: false,
            },
          },
        })
      );
      act(() => emitActiveSpeakerChange(callObject, remoteParticipants[2]));
      await waitFor(() => {
        expect(queryAudioById(remoteParticipants[0], container)).not.toBeNull();
        expect(queryAudioById(remoteParticipants[1], container)).toBeNull();
        expect(queryAudioById(remoteParticipants[2], container)).not.toBeNull();
      });
    });
    it('replaces muted slot', async () => {
      /**
       * Scenario:
       * - Remote participant 1 becomes active speaker (subscribed)
       * - Remote participant 2 becomes active speaker (subscribed)
       * - Remote participant 2 mutes (still subscribed)
       * - Remote participant 3 becomes active speaker (subscribed) and replaces slot of participant 2
       */
      const callObject = DailyIframe.createCallObject();
      const remoteParticipants = [
        faker.datatype.uuid(),
        faker.datatype.uuid(),
        faker.datatype.uuid(),
      ];
      (callObject.participants as jest.Mock).mockImplementation(() => {
        const participants: Record<string, Partial<DailyParticipant>> = {
          local: {
            local: true,
            session_id: localSessionId,
          },
        };
        remoteParticipants.forEach((id) => {
          participants[id] = {
            local: false,
            session_id: id,
            // @ts-ignore
            tracks: {
              audio: {
                state: 'playable',
                subscribed: true,
              },
            },
          };
        });
        return participants;
      });
      const Wrapper = createWrapper(callObject);
      const { container } = render(
        <Wrapper>
          <DailyAudio maxSpeakers={2} />
        </Wrapper>
      );
      act(() => emitStartedCamera(callObject));
      act(() => emitActiveSpeakerChange(callObject, remoteParticipants[0]));
      await waitFor(() =>
        expect(queryAudioById(remoteParticipants[0], container)).not.toBeNull()
      );
      act(() => emitActiveSpeakerChange(callObject, remoteParticipants[1]));
      await waitFor(() => {
        expect(queryAudioById(remoteParticipants[0], container)).not.toBeNull();
        expect(queryAudioById(remoteParticipants[1], container)).not.toBeNull();
      });
      act(() =>
        emitParticipantUpdated(callObject, {
          local: false,
          session_id: remoteParticipants[1],
          // @ts-ignore
          tracks: {
            audio: {
              state: 'off',
              subscribed: true,
            },
          },
        })
      );
      act(() => emitActiveSpeakerChange(callObject, remoteParticipants[2]));
      await waitFor(() => {
        expect(queryAudioById(remoteParticipants[0], container)).not.toBeNull();
        expect(queryAudioById(remoteParticipants[1], container)).toBeNull();
        expect(queryAudioById(remoteParticipants[2], container)).not.toBeNull();
      });
    });
    it('replaces least recent speaker slot', async () => {
      /**
       * Scenario: 4 participants to trigger sorting by last_active dates.
       * - Remote participant 1 becomes active speaker (subscribed)
       * - Remote participant 2 becomes active speaker (subscribed)
       * - Remote participant 3 becomes active speaker (subscribed)
       * - Remote participant 4 becomes active speaker (subscribed) and replaces slot of participant 1
       */
      const callObject = DailyIframe.createCallObject();
      const remoteParticipants = [
        faker.datatype.uuid(),
        faker.datatype.uuid(),
        faker.datatype.uuid(),
        faker.datatype.uuid(),
      ];
      (callObject.participants as jest.Mock).mockImplementation(() => {
        const participants: Record<string, Partial<DailyParticipant>> = {
          local: {
            local: true,
            session_id: localSessionId,
          },
        };
        remoteParticipants.forEach((id) => {
          participants[id] = {
            local: false,
            session_id: id,
            // @ts-ignore
            tracks: {
              audio: {
                state: 'playable',
                subscribed: true,
              },
            },
          };
        });
        return participants;
      });
      const Wrapper = createWrapper(callObject);
      const { container } = render(
        <Wrapper>
          <DailyAudio maxSpeakers={3} />
        </Wrapper>
      );
      jest.useFakeTimers();
      act(() => emitStartedCamera(callObject));
      act(() => emitActiveSpeakerChange(callObject, remoteParticipants[0]));
      await waitFor(() =>
        expect(queryAudioById(remoteParticipants[0], container)).not.toBeNull()
      );
      act(() => {
        jest.advanceTimersByTime(5000);
        emitActiveSpeakerChange(callObject, remoteParticipants[1]);
      });
      await waitFor(() => {
        expect(queryAudioById(remoteParticipants[0], container)).not.toBeNull();
        expect(queryAudioById(remoteParticipants[1], container)).not.toBeNull();
      });
      act(() => {
        jest.advanceTimersByTime(5000);
        emitActiveSpeakerChange(callObject, remoteParticipants[2]);
      });
      await waitFor(() => {
        expect(queryAudioById(remoteParticipants[0], container)).not.toBeNull();
        expect(queryAudioById(remoteParticipants[1], container)).not.toBeNull();
        expect(queryAudioById(remoteParticipants[2], container)).not.toBeNull();
      });
      act(() => {
        jest.advanceTimersByTime(5000);
        emitActiveSpeakerChange(callObject, remoteParticipants[3]);
      });
      await waitFor(() => {
        expect(queryAudioById(remoteParticipants[0], container)).toBeNull();
        expect(queryAudioById(remoteParticipants[1], container)).not.toBeNull();
        expect(queryAudioById(remoteParticipants[2], container)).not.toBeNull();
        expect(queryAudioById(remoteParticipants[3], container)).not.toBeNull();
      });
      jest.useRealTimers();
    });
  });
});
