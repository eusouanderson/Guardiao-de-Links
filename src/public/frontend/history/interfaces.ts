// History feature contracts for API responses and view-model state.
export interface StudyHistoryItem {
  id: number;
  promptSnapshot: string;
  explanation: string;
  cycleNumber: number;
  totalQuestions: number;
  correctCount: number;
  completedAt: string;
}

export interface HistoryStats {
  totalCycles: number;
  totalThemes: number;
  lastCompletion: string;
}

export interface UseHistoryState {
  history: import('vue').Ref<StudyHistoryItem[]>;
  isLoading: import('vue').Ref<boolean>;
  errorMessage: import('vue').Ref<string>;
  stats: import('vue').ComputedRef<HistoryStats>;
  loadHistory: () => Promise<void>;
}
