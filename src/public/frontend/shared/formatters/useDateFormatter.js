// Runtime date formatter helpers shared by frontend feature modules.
export const useDateFormatter = () => {
  const safeParse = (value) => {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDate = (value) => {
    const date = safeParse(value);
    return date ? date.toLocaleDateString('pt-BR') : '-';
  };

  const formatDateTime = (value) => {
    const date = safeParse(value);
    return date ? date.toLocaleString('pt-BR') : value || '-';
  };

  return { formatDate, formatDateTime };
};
