// Feature composable for links state and behavior (list, filter, mutations).
import { computed, ref } from 'vue';
import type { LinkItem, UseLinksState } from './interfaces';
import { useApiLinks } from './useApiLinks';

export const useLinks = (): UseLinksState => {
  const links = ref<LinkItem[]>([]);
  const searchTerm = ref('');
  const { fetchLinks, postLink, deleteLink } = useApiLinks();

  const filteredLinks = computed(() => {
    const query = searchTerm.value.trim().toLowerCase();
    if (!query) {
      return links.value;
    }

    return links.value.filter(
      (item) => item.name.toLowerCase().includes(query) || item.url.toLowerCase().includes(query)
    );
  });

  const loadLinks = async () => {
    links.value = await fetchLinks();
  };

  const createLink = async (payload: LinkItem) => {
    await postLink(payload);
    await loadLinks();
  };

  const removeLink = async (url: string) => {
    await deleteLink(url);
    await loadLinks();
  };

  return { links, searchTerm, filteredLinks, loadLinks, createLink, removeLink };
};
