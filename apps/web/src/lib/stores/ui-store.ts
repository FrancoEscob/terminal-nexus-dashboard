import { create } from 'zustand';

interface UiStore {
  selectedSessionId: string | null;
  isTerminalModalOpen: boolean;
  subscribedSessionIds: string[];
  selectSession: (sessionId: string | null) => void;
  openTerminalModal: (sessionId: string) => void;
  closeTerminalModal: () => void;
  addSubscribedSession: (sessionId: string) => void;
  removeSubscribedSession: (sessionId: string) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  selectedSessionId: null,
  isTerminalModalOpen: false,
  subscribedSessionIds: [],

  selectSession: (sessionId) => {
    set({ selectedSessionId: sessionId });
  },

  openTerminalModal: (sessionId) => {
    set({ selectedSessionId: sessionId, isTerminalModalOpen: true });
  },

  closeTerminalModal: () => {
    set({ isTerminalModalOpen: false });
  },

  addSubscribedSession: (sessionId) => {
    set((state) => {
      if (state.subscribedSessionIds.includes(sessionId)) {
        return state;
      }

      return {
        subscribedSessionIds: [...state.subscribedSessionIds, sessionId],
      };
    });
  },

  removeSubscribedSession: (sessionId) => {
    set((state) => ({
      subscribedSessionIds: state.subscribedSessionIds.filter((id) => id !== sessionId),
    }));
  },
}));
