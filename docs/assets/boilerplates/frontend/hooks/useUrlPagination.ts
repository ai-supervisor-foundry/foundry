import { useCallback, useEffect } from 'react';

export interface UseUrlPaginationArgs {
  searchParams: URLSearchParams;
  setSearchParams: (next: URLSearchParams, opts?: { replace?: boolean }) => void;
  totalItems: number;
  perPage: number;
  pageParam?: string;
}

export interface UseUrlPaginationResult {
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
}

export function useUrlPagination({
  searchParams,
  setSearchParams,
  totalItems,
  perPage,
  pageParam = 'page',
}: UseUrlPaginationArgs): UseUrlPaginationResult {
  const pageFromUrl = Math.max(1, parseInt(searchParams.get(pageParam) ?? '1', 10) || 1);
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage) || 1);

  const setPage = useCallback(
    (nextPage: number) => {
      const clamped = Math.max(1, Math.min(nextPage, totalPages));
      const next = new URLSearchParams(searchParams);
      if (clamped > 1) next.set(pageParam, String(clamped));
      else next.delete(pageParam);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, totalPages, pageParam],
  );

  useEffect(() => {
    if (totalPages >= 1 && pageFromUrl > totalPages) {
      setPage(totalPages);
    }
  }, [pageFromUrl, totalPages, setPage]);

  return { page: pageFromUrl, totalPages, setPage };
}
