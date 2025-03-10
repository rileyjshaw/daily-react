/// <reference types="@types/jest" />

import DailyIframe, {
  DailyCall,
  DailyEventObjectCameraError,
  DailyEventObjectParticipant,
  DailyEventObjectSelectedDevicesUpdated,
  DailyParticipant,
} from '@daily-co/daily-js';
import { act, renderHook } from '@testing-library/react-hooks';
import faker from 'faker';
import React from 'react';

import { StatefulDevice } from '../../src/DailyDevices';
import { DailyProvider } from '../../src/DailyProvider';
import { useDevices } from '../../src/hooks/useDevices';

jest.mock('../../src/DailyRoom', () => ({
  DailyRoom: (({ children }) => <>{children}</>) as React.FC,
}));
jest.mock('../../src/DailyParticipants', () => ({
  DailyParticipants: (({ children }) => <>{children}</>) as React.FC,
}));

const createWrapper =
  (callObject: DailyCall = DailyIframe.createCallObject()): React.FC =>
  ({ children }) =>
    <DailyProvider callObject={callObject}>{children}</DailyProvider>;

describe('useDevices', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns initial state', async () => {
    const daily = DailyIframe.createCallObject();
    const { result, waitFor } = renderHook(() => useDevices(), {
      wrapper: createWrapper(daily),
    });
    await waitFor(() => {
      expect(result.current.camState).toBe('idle');
      expect(result.current.cameras).toEqual([]);
      expect(result.current.hasCamError).toBe(false);
      expect(result.current.hasMicError).toBe(false);
      expect(result.current.micState).toBe('idle');
      expect(result.current.microphones).toEqual([]);
      expect(typeof result.current.refreshDevices).toBe('function');
      expect(typeof result.current.setCamera).toBe('function');
      expect(typeof result.current.setMicrophone).toBe('function');
      expect(typeof result.current.setSpeaker).toBe('function');
      expect(result.current.speakers).toEqual([]);
    });
  });
  it('sets states to not-supported if getUserMedia is unavailable', async () => {
    const oldGetUserMedia = navigator?.mediaDevices?.getUserMedia;
    if (typeof oldGetUserMedia !== 'undefined') {
      // @ts-ignore
      navigator.mediaDevices.getUserMedia = undefined;
    }
    const daily = DailyIframe.createCallObject();
    const { result, waitFor } = renderHook(() => useDevices(), {
      wrapper: createWrapper(daily),
    });
    act(() => {
      result.current.refreshDevices();
    });
    await waitFor(() => {
      expect(result.current.camState).toBe('not-supported');
      expect(result.current.micState).toBe('not-supported');
    });
    if (typeof oldGetUserMedia !== 'undefined') {
      navigator.mediaDevices.getUserMedia = oldGetUserMedia;
    }
  });
  it('sets states to not-supported if enumerateDevices is unavailable', async () => {
    const oldEnumerateDevices = navigator?.mediaDevices?.enumerateDevices;
    if (typeof oldEnumerateDevices !== 'undefined') {
      // @ts-ignore
      navigator.mediaDevices.enumerateDevices = undefined;
    }
    const daily = DailyIframe.createCallObject();
    const { result, waitFor } = renderHook(() => useDevices(), {
      wrapper: createWrapper(daily),
    });
    act(() => {
      result.current.refreshDevices();
    });
    await waitFor(() => {
      expect(result.current.camState).toBe('not-supported');
      expect(result.current.micState).toBe('not-supported');
    });
    if (typeof oldEnumerateDevices !== 'undefined') {
      navigator.mediaDevices.enumerateDevices = oldEnumerateDevices;
    }
  });
  describe('with gUM and enumerateDevices set up', () => {
    let oldEnumerateDevices: MediaDevices['enumerateDevices'];
    let oldGUM: MediaDevices['getUserMedia'];
    beforeEach(() => {
      oldEnumerateDevices = navigator?.mediaDevices?.enumerateDevices;
      oldGUM = navigator?.mediaDevices?.getUserMedia;
      if (!navigator.mediaDevices) {
        // @ts-ignore
        navigator.mediaDevices = {};
      }
      // @ts-ignore
      navigator.mediaDevices.enumerateDevices = jest.fn();
      // @ts-ignore
      navigator.mediaDevices.getUserMedia = jest.fn();
    });
    afterEach(() => {
      navigator.mediaDevices.enumerateDevices = oldEnumerateDevices;
      navigator.mediaDevices.getUserMedia = oldGUM;
    });
    it('calling refreshDevices updates lists of devices and sets state to granted', async () => {
      const devices: MediaDeviceInfo[] = [
        {
          deviceId: faker.random.alphaNumeric(12),
          groupId: faker.random.alphaNumeric(12),
          kind: 'audioinput',
          label: faker.random.words(),
          toJSON: jest.fn(),
        },
        {
          deviceId: faker.random.alphaNumeric(12),
          groupId: faker.random.alphaNumeric(12),
          kind: 'audiooutput',
          label: faker.random.words(),
          toJSON: jest.fn(),
        },
        {
          deviceId: faker.random.alphaNumeric(12),
          groupId: faker.random.alphaNumeric(12),
          kind: 'videoinput',
          label: faker.random.words(),
          toJSON: jest.fn(),
        },
      ];
      const daily = DailyIframe.createCallObject();
      (daily.enumerateDevices as jest.Mock).mockImplementation(async () => ({
        devices,
      }));
      const { result, waitFor } = renderHook(() => useDevices(), {
        wrapper: createWrapper(daily),
      });
      act(() => {
        result.current.refreshDevices();
      });
      await waitFor(() => {
        expect(result.current.cameras).toEqual<StatefulDevice[]>([
          {
            device: devices[2],
            selected: false,
            state: 'granted',
          },
        ]);
        expect(result.current.microphones).toEqual<StatefulDevice[]>([
          {
            device: devices[0],
            selected: false,
            state: 'granted',
          },
        ]);
        expect(result.current.speakers).toEqual<StatefulDevice[]>([
          {
            device: devices[1],
            selected: false,
            state: 'granted',
          },
        ]);
      });
    });
    it('devices are sorted by label but default device is first', async () => {
      const devices: MediaDeviceInfo[] = [
        {
          deviceId: faker.random.alphaNumeric(12),
          groupId: faker.random.alphaNumeric(12),
          kind: 'audioinput',
          label: 'Bluetooth mic',
          toJSON: jest.fn(),
        },
        {
          deviceId: faker.random.alphaNumeric(12),
          groupId: faker.random.alphaNumeric(12),
          kind: 'audioinput',
          label: 'Chaos headset',
          toJSON: jest.fn(),
        },
        {
          deviceId: 'default',
          groupId: faker.random.alphaNumeric(12),
          kind: 'audioinput',
          label: 'Default - Internal mic',
          toJSON: jest.fn(),
        },
        {
          deviceId: faker.random.alphaNumeric(12),
          groupId: faker.random.alphaNumeric(12),
          kind: 'audioinput',
          label: 'Chaos headset',
          toJSON: jest.fn(),
        },
        {
          deviceId: faker.random.alphaNumeric(12),
          groupId: faker.random.alphaNumeric(12),
          kind: 'audioinput',
          label: 'A microphone',
          toJSON: jest.fn(),
        },
      ];
      if (
        typeof navigator?.mediaDevices === 'undefined' ||
        typeof navigator?.mediaDevices?.enumerateDevices === 'undefined'
      ) {
        // @ts-ignore
        navigator.mediaDevices = {
          getUserMedia: jest.fn(),
          enumerateDevices: jest.fn(),
        };
      }
      const daily = DailyIframe.createCallObject();
      (daily.enumerateDevices as jest.Mock).mockImplementation(async () => ({
        devices,
      }));
      const { result, waitFor } = renderHook(() => useDevices(), {
        wrapper: createWrapper(daily),
      });
      act(() => {
        result.current.refreshDevices();
      });
      await waitFor(() => {
        const labels = result.current.microphones.map((m) => m.device.label);
        expect(labels).toEqual<string[]>([
          'Default - Internal mic',
          'A microphone',
          'Bluetooth mic',
          'Chaos headset',
          'Chaos headset',
        ]);
      });
    });
    describe('camera-error', () => {
      it('cam-in-use error updates general cam state', async () => {
        const daily = DailyIframe.createCallObject();
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const payload: DailyEventObjectCameraError = {
          action: 'camera-error',
          errorMsg: {
            errorMsg: '',
          },
          error: {
            type: 'cam-in-use',
          },
        };
        act(() => {
          // @ts-ignore
          daily.emit('camera-error', payload);
        });
        await waitFor(() => {
          expect(result.current.camState).toBe('in-use');
          expect(result.current.hasCamError).toBe(true);
          expect(result.current.cameraError).toEqual(payload.error);
        });
      });
      it('mic-in-use error updates general mic state', async () => {
        const daily = DailyIframe.createCallObject();
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const payload: DailyEventObjectCameraError = {
          action: 'camera-error',
          errorMsg: {
            errorMsg: '',
          },
          error: {
            type: 'mic-in-use',
          },
        };
        act(() => {
          // @ts-ignore
          daily.emit('camera-error', payload);
        });
        await waitFor(() => {
          expect(result.current.micState).toBe('in-use');
          expect(result.current.hasMicError).toBe(true);
          expect(result.current.cameraError).toEqual(payload.error);
        });
      });
      it('cam-mic-in-use error updates general cam and mic state', async () => {
        const daily = DailyIframe.createCallObject();
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const payload: DailyEventObjectCameraError = {
          action: 'camera-error',
          errorMsg: {
            errorMsg: '',
          },
          error: {
            type: 'cam-mic-in-use',
          },
        };
        act(() => {
          // @ts-ignore
          daily.emit('camera-error', payload);
        });
        await waitFor(() => {
          expect(result.current.camState).toBe('in-use');
          expect(result.current.hasCamError).toBe(true);
          expect(result.current.micState).toBe('in-use');
          expect(result.current.hasMicError).toBe(true);
          expect(result.current.cameraError).toEqual(payload.error);
        });
      });
      it('not-found error updates general cam and mic state', async () => {
        const daily = DailyIframe.createCallObject();
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const payload: DailyEventObjectCameraError = {
          action: 'camera-error',
          errorMsg: {
            errorMsg: '',
          },
          error: {
            missingMedia: ['audio', 'video'],
            type: 'not-found',
          },
        };
        act(() => {
          // @ts-ignore
          daily.emit('camera-error', payload);
        });
        await waitFor(() => {
          expect(result.current.camState).toBe('not-found');
          expect(result.current.micState).toBe('not-found');
          expect(result.current.hasCamError).toBe(true);
          expect(result.current.hasMicError).toBe(true);
          expect(result.current.cameraError).toEqual(payload.error);
        });
      });
      it('permissions error updates general cam and mic state', async () => {
        const daily = DailyIframe.createCallObject();
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const payload: DailyEventObjectCameraError = {
          action: 'camera-error',
          errorMsg: {
            errorMsg: '',
          },
          error: {
            type: 'permissions',
            blockedMedia: ['audio', 'video'],
          },
        };
        act(() => {
          // @ts-ignore
          daily.emit('camera-error', payload);
        });
        await waitFor(() => {
          expect(result.current.camState).toBe('blocked');
          expect(result.current.hasCamError).toBe(true);
          expect(result.current.micState).toBe('blocked');
          expect(result.current.hasMicError).toBe(true);
          expect(result.current.cameraError).toEqual(payload.error);
        });
      });
      it('constraints (invalid) error updates general cam and mic state', async () => {
        const daily = DailyIframe.createCallObject();
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const payload: DailyEventObjectCameraError = {
          action: 'camera-error',
          errorMsg: {
            errorMsg: '',
          },
          error: {
            type: 'constraints',
            reason: 'invalid',
          },
        };
        act(() => {
          // @ts-ignore
          daily.emit('camera-error', payload);
        });
        await waitFor(() => {
          expect(result.current.camState).toBe('constraints-invalid');
          expect(result.current.hasCamError).toBe(true);
          expect(result.current.micState).toBe('constraints-invalid');
          expect(result.current.hasMicError).toBe(true);
          expect(result.current.cameraError).toEqual(payload.error);
        });
      });
      it('constraints (none-specified) error updates general cam and mic state', async () => {
        const daily = DailyIframe.createCallObject();
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const payload: DailyEventObjectCameraError = {
          action: 'camera-error',
          errorMsg: {
            errorMsg: '',
          },
          error: {
            type: 'constraints',
            reason: 'none-specified',
          },
        };
        act(() => {
          // @ts-ignore
          daily.emit('camera-error', payload);
        });
        await waitFor(() => {
          expect(result.current.camState).toBe('constraints-none-specified');
          expect(result.current.hasCamError).toBe(true);
          expect(result.current.micState).toBe('constraints-none-specified');
          expect(result.current.hasMicError).toBe(true);
          expect(result.current.cameraError).toEqual(payload.error);
        });
      });
      it('undefined-mediadevices error updates general cam and mic state', async () => {
        const daily = DailyIframe.createCallObject();
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const payload: DailyEventObjectCameraError = {
          action: 'camera-error',
          errorMsg: {
            errorMsg: '',
          },
          error: {
            type: 'undefined-mediadevices',
          },
        };
        act(() => {
          // @ts-ignore
          daily.emit('camera-error', payload);
        });
        await waitFor(() => {
          expect(result.current.camState).toBe('undefined-mediadevices');
          expect(result.current.hasCamError).toBe(true);
          expect(result.current.micState).toBe('undefined-mediadevices');
          expect(result.current.hasMicError).toBe(true);
          expect(result.current.cameraError).toEqual(payload.error);
        });
      });
      it('unknown error updates general cam and mic state', async () => {
        const daily = DailyIframe.createCallObject();
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const payload: DailyEventObjectCameraError = {
          action: 'camera-error',
          errorMsg: {
            errorMsg: '',
          },
          error: {
            type: 'unknown',
          },
        };
        act(() => {
          // @ts-ignore
          daily.emit('camera-error', payload);
        });
        await waitFor(() => {
          expect(result.current.camState).toBe('unknown');
          expect(result.current.hasCamError).toBe(true);
          expect(result.current.micState).toBe('unknown');
          expect(result.current.hasMicError).toBe(true);
          expect(result.current.cameraError).toEqual(payload.error);
        });
      });
    });
    describe('participant-updated', () => {
      it('remote updates are ignored', async () => {
        const daily = DailyIframe.createCallObject();
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const payload: DailyEventObjectParticipant = {
          action: 'participant-updated',
          // @ts-ignore
          participant: {
            local: false,
          },
        };
        act(() => {
          // @ts-ignore
          daily.emit('participant-updated', payload);
        });
        await waitFor(() => {
          expect(result.current.camState).toBe('idle');
          expect(result.current.micState).toBe('idle');
        });
      });
      it('local updates state (granted)', async () => {
        // @ts-ignore
        const local: DailyParticipant = {
          local: true,
          tracks: {
            audio: {
              state: 'playable',
              subscribed: true,
            },
            screenAudio: {
              state: 'off',
              subscribed: false,
            },
            screenVideo: {
              state: 'off',
              subscribed: false,
            },
            video: {
              state: 'playable',
              subscribed: true,
            },
          },
        };
        const daily = DailyIframe.createCallObject();
        (daily.participants as jest.Mock).mockImplementation(() => ({
          local,
        }));
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const payload: DailyEventObjectParticipant = {
          action: 'participant-updated',
          participant: local,
        };
        act(() => {
          // @ts-ignore
          daily.emit('participant-updated', payload);
        });
        await waitFor(() => {
          expect(result.current.camState).toBe('granted');
          expect(result.current.micState).toBe('granted');
        });
      });
      it('local updates state (device in use)', async () => {
        // @ts-ignore
        const local: DailyParticipant = {
          local: true,
          tracks: {
            audio: {
              blocked: {
                byDeviceInUse: true,
              },
              state: 'blocked',
              subscribed: true,
            },
            screenAudio: {
              state: 'off',
              subscribed: false,
            },
            screenVideo: {
              state: 'off',
              subscribed: false,
            },
            video: {
              blocked: {
                byDeviceInUse: true,
              },
              state: 'blocked',
              subscribed: true,
            },
          },
        };
        const daily = DailyIframe.createCallObject();
        (daily.participants as jest.Mock).mockImplementation(() => ({
          local,
        }));
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const payload: DailyEventObjectParticipant = {
          action: 'participant-updated',
          participant: local,
        };
        act(() => {
          // @ts-ignore
          daily.emit('participant-updated', payload);
        });
        await waitFor(() => {
          expect(result.current.camState).toBe('in-use');
          expect(result.current.micState).toBe('in-use');
        });
      });
      it('local updates state (device missing)', async () => {
        // @ts-ignore
        const local: DailyParticipant = {
          local: true,
          tracks: {
            audio: {
              blocked: {
                byDeviceMissing: true,
              },
              state: 'blocked',
              subscribed: true,
            },
            screenAudio: {
              state: 'off',
              subscribed: false,
            },
            screenVideo: {
              state: 'off',
              subscribed: false,
            },
            video: {
              blocked: {
                byDeviceMissing: true,
              },
              state: 'blocked',
              subscribed: true,
            },
          },
        };
        const daily = DailyIframe.createCallObject();
        (daily.participants as jest.Mock).mockImplementation(() => ({
          local,
        }));
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const payload: DailyEventObjectParticipant = {
          action: 'participant-updated',
          participant: local,
        };
        act(() => {
          // @ts-ignore
          daily.emit('participant-updated', payload);
        });
        await waitFor(() => {
          expect(result.current.camState).toBe('not-found');
          expect(result.current.micState).toBe('not-found');
        });
      });
      describe('with pre-selected device', () => {
        it('updates mic in-use', async () => {
          // @ts-ignore
          const local: DailyParticipant = {
            local: true,
            tracks: {
              audio: {
                blocked: {
                  byDeviceInUse: true,
                },
                state: 'blocked',
                subscribed: true,
              },
              screenAudio: {
                state: 'off',
                subscribed: false,
              },
              screenVideo: {
                state: 'off',
                subscribed: false,
              },
              video: {
                state: 'off',
                subscribed: true,
              },
            },
          };
          const microphones: MediaDeviceInfo[] = [
            {
              deviceId: faker.random.alphaNumeric(12),
              groupId: faker.random.alphaNumeric(12),
              kind: 'audioinput',
              label: 'Microphone',
              toJSON: jest.fn(),
            },
          ];
          const daily = DailyIframe.createCallObject();
          (daily.getInputDevices as jest.Mock).mockImplementation(async () => ({
            camera: {},
            mic: microphones[0],
            speaker: {},
          }));
          (daily.enumerateDevices as jest.Mock).mockImplementation(
            async () => ({ devices: microphones })
          );
          (daily.participants as jest.Mock).mockImplementation(() => ({
            local,
          }));
          const { result, waitFor } = renderHook(() => useDevices(), {
            wrapper: createWrapper(daily),
          });
          act(() => {
            result.current.setMicrophone(microphones[0].deviceId);
            const payload: DailyEventObjectSelectedDevicesUpdated = {
              action: 'selected-devices-updated',
              devices: {
                camera: {},
                mic: microphones[0],
                speaker: {},
              },
            };
            // @ts-ignore
            daily.emit('selected-devices-updated', payload);
          });
          await waitFor(() => {
            expect(result.current.microphones).toHaveLength(1);
          });
          const payload: DailyEventObjectParticipant = {
            action: 'participant-updated',
            participant: local,
          };
          act(() => {
            // @ts-ignore
            daily.emit('participant-updated', payload);
          });
          await waitFor(() => {
            expect(result.current.microphones[0].state).toBe('in-use');
            expect(result.current.microphones[0].selected).toBe(true);
          });
        });
        it('updates mic granted', async () => {
          // @ts-ignore
          const local: DailyParticipant = {
            local: true,
            tracks: {
              audio: {
                state: 'sendable',
                subscribed: true,
              },
              screenAudio: {
                state: 'off',
                subscribed: false,
              },
              screenVideo: {
                state: 'off',
                subscribed: false,
              },
              video: {
                state: 'off',
                subscribed: true,
              },
            },
          };
          const microphones: MediaDeviceInfo[] = [
            {
              deviceId: faker.random.alphaNumeric(12),
              groupId: faker.random.alphaNumeric(12),
              kind: 'audioinput',
              label: 'Microphone',
              toJSON: jest.fn(),
            },
          ];
          const daily = DailyIframe.createCallObject();
          (daily.getInputDevices as jest.Mock).mockImplementation(async () => ({
            camera: {},
            mic: microphones[0],
            speaker: {},
          }));
          (daily.enumerateDevices as jest.Mock).mockImplementation(
            async () => ({ devices: microphones })
          );
          (daily.participants as jest.Mock).mockImplementation(() => ({
            local,
          }));
          const { result, waitFor, waitForNextUpdate } = renderHook(
            () => useDevices(),
            {
              wrapper: createWrapper(daily),
            }
          );
          act(() => {
            result.current.setMicrophone(microphones[0].deviceId);
            const payload: DailyEventObjectSelectedDevicesUpdated = {
              action: 'selected-devices-updated',
              devices: {
                camera: {},
                mic: microphones[0],
                speaker: {},
              },
            };
            // @ts-ignore
            daily.emit('selected-devices-updated', payload);
          });
          await waitFor(() => {
            expect(result.current.microphones).toHaveLength(1);
          });
          const payload: DailyEventObjectParticipant = {
            action: 'participant-updated',
            participant: local,
          };
          act(() => {
            // @ts-ignore
            daily.emit('participant-updated', payload);
          });
          await waitForNextUpdate();
          await waitFor(() => {
            expect(result.current.microphones[0].state).toBe('granted');
            expect(result.current.microphones[0].selected).toBe(true);
          });
        });
        it('updates cam in-use', async () => {
          // @ts-ignore
          const local: DailyParticipant = {
            local: true,
            tracks: {
              audio: {
                state: 'off',
                subscribed: true,
              },
              screenAudio: {
                state: 'off',
                subscribed: false,
              },
              screenVideo: {
                state: 'off',
                subscribed: false,
              },
              video: {
                blocked: {
                  byDeviceInUse: true,
                },
                state: 'blocked',
                subscribed: true,
              },
            },
          };
          const cameras: MediaDeviceInfo[] = [
            {
              deviceId: faker.random.alphaNumeric(12),
              groupId: faker.random.alphaNumeric(12),
              kind: 'videoinput',
              label: 'Camera',
              toJSON: jest.fn(),
            },
          ];
          const daily = DailyIframe.createCallObject();
          (daily.getInputDevices as jest.Mock).mockImplementation(async () => ({
            camera: cameras[0],
            mic: {},
            speaker: {},
          }));
          (daily.enumerateDevices as jest.Mock).mockImplementation(
            async () => ({ devices: cameras })
          );
          (daily.participants as jest.Mock).mockImplementation(() => ({
            local,
          }));
          const { result, waitFor, waitForNextUpdate } = renderHook(
            () => useDevices(),
            {
              wrapper: createWrapper(daily),
            }
          );
          act(() => {
            result.current.setCamera(cameras[0].deviceId);
            const payload: DailyEventObjectSelectedDevicesUpdated = {
              action: 'selected-devices-updated',
              devices: {
                camera: cameras[0],
                mic: {},
                speaker: {},
              },
            };
            // @ts-ignore
            daily.emit('selected-devices-updated', payload);
          });
          await waitFor(() => {
            expect(result.current.cameras).toHaveLength(1);
          });
          const payload: DailyEventObjectParticipant = {
            action: 'participant-updated',
            participant: local,
          };
          act(() => {
            // @ts-ignore
            daily.emit('participant-updated', payload);
          });
          await waitForNextUpdate();
          await waitFor(() => {
            expect(result.current.cameras[0].state).toBe('in-use');
            expect(result.current.cameras[0].selected).toBe(true);
          });
        });
        it('updates cam granted', async () => {
          // @ts-ignore
          const local: DailyParticipant = {
            local: true,
            tracks: {
              audio: {
                state: 'off',
                subscribed: true,
              },
              screenAudio: {
                state: 'off',
                subscribed: false,
              },
              screenVideo: {
                state: 'off',
                subscribed: false,
              },
              video: {
                state: 'sendable',
                subscribed: true,
              },
            },
          };
          const cameras: MediaDeviceInfo[] = [
            {
              deviceId: faker.random.alphaNumeric(12),
              groupId: faker.random.alphaNumeric(12),
              kind: 'videoinput',
              label: 'Camera',
              toJSON: jest.fn(),
            },
          ];
          const daily = DailyIframe.createCallObject();
          (daily.getInputDevices as jest.Mock).mockImplementation(async () => ({
            camera: cameras[0],
            mic: {},
            speaker: {},
          }));
          (daily.enumerateDevices as jest.Mock).mockImplementation(
            async () => ({ devices: cameras })
          );
          (daily.participants as jest.Mock).mockImplementation(() => ({
            local,
          }));
          const { result, waitFor, waitForNextUpdate } = renderHook(
            () => useDevices(),
            {
              wrapper: createWrapper(daily),
            }
          );
          act(() => {
            result.current.setCamera(cameras[0].deviceId);
            const payload: DailyEventObjectSelectedDevicesUpdated = {
              action: 'selected-devices-updated',
              devices: {
                camera: cameras[0],
                mic: {},
                speaker: {},
              },
            };
            // @ts-ignore
            daily.emit('selected-devices-updated', payload);
          });
          await waitFor(() => {
            expect(result.current.cameras).toHaveLength(1);
          });
          const payload: DailyEventObjectParticipant = {
            action: 'participant-updated',
            participant: local,
          };
          act(() => {
            // @ts-ignore
            daily.emit('participant-updated', payload);
          });
          await waitForNextUpdate();
          await waitFor(() => {
            expect(result.current.cameras[0].state).toBe('granted');
            expect(result.current.cameras[0].selected).toBe(true);
          });
        });
      });
    });
    describe('setting devices', () => {
      it('setCamera calls setInputDevicesAsync', async () => {
        const daily = DailyIframe.createCallObject();
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const id = faker.random.alphaNumeric(12);
        act(() => {
          result.current.setCamera(id);
        });
        await waitFor(() => {
          expect(daily.setInputDevicesAsync).toBeCalledWith({
            audioDeviceId: null,
            videoDeviceId: id,
          });
        });
      });
      it('setMicrophone calls setInputDevicesAsync', async () => {
        const daily = DailyIframe.createCallObject();
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const id = faker.random.alphaNumeric(12);
        act(() => {
          result.current.setMicrophone(id);
        });
        await waitFor(() => {
          expect(daily.setInputDevicesAsync).toBeCalledWith({
            audioDeviceId: id,
            videoDeviceId: null,
          });
        });
      });
      it('setSpeaker calls setOutputDeviceAsync', async () => {
        const daily = DailyIframe.createCallObject();
        const { result, waitFor } = renderHook(() => useDevices(), {
          wrapper: createWrapper(daily),
        });
        const id = faker.random.alphaNumeric(12);
        act(() => {
          result.current.setSpeaker(id);
        });
        await waitFor(() => {
          expect(daily.setOutputDeviceAsync).toBeCalledWith({
            outputDeviceId: id,
          });
        });
      });
    });
  });
});
