// Links feature contracts for link entities and local state.
export interface LinkItem {
  name: string;
  url: string;
}

export interface UseLinksState {
  links: import('vue').Ref<LinkItem[]>;
  searchTerm: import('vue').Ref<string>;
  filteredLinks: import('vue').ComputedRef<LinkItem[]>;
  loadLinks: () => Promise<void>;
  createLink: (payload: LinkItem) => Promise<void>;
  removeLink: (url: string) => Promise<void>;
}
