// Studies feature contracts for theme, queue, and session state.
export interface StudyQueueItem {
  id: number;
  prompt: string;
  createdAt: string;
}

export interface StudyStatus {
  hasPrompt: boolean;
  pendingStudy: boolean;
  canSaveNewTheme: boolean;
  prompt: string;
  updatedAt: string | null;
  completionCount: number;
  remainingCycles: number;
}

export interface UseStudiesState {
  status: import('vue').Ref<StudyStatus | null>;
  queue: import('vue').Ref<StudyQueueItem[]>;
  loadStatus: () => Promise<void>;
  loadQueue: () => Promise<void>;
}
