// Contracts for shared formatter composables.
export interface DateFormatter {
  formatDate: (value: string | null | undefined) => string;
  formatDateTime: (value: string | null | undefined) => string;
}
