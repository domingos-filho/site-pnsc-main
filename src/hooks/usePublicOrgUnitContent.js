import { useEffect, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { isSupabaseReady } from '@/lib/supabaseClient';
import {
  buildFallbackPublicOrgUnitContent,
  buildPublicOrgUnitContentFromRows,
  fetchOrgUnitSiteContentRows,
} from '@/lib/orgUnitSiteContent';

export const usePublicOrgUnitContent = () => {
  const { siteData, loading: siteDataLoading } = useData();
  const [state, setState] = useState({
    communities: [],
    pastoralSections: { pastorais: [], movimentos: [], servicos: [] },
    pastoralItems: [],
    loading: true,
    source: 'fallback',
    error: null,
  });

  useEffect(() => {
    if (siteDataLoading) {
      return;
    }

    let isMounted = true;
    const fallback = buildFallbackPublicOrgUnitContent(siteData);

    if (!isSupabaseReady) {
      if (isMounted) {
        setState({
          ...fallback,
          loading: false,
          source: 'fallback',
          error: null,
        });
      }
      return () => {
        isMounted = false;
      };
    }

    const load = async () => {
      try {
        const rows = await fetchOrgUnitSiteContentRows();
        const relational = rows.length > 0 ? buildPublicOrgUnitContentFromRows(rows) : null;
        const hasRelationalContent =
          (relational?.communities?.length || 0) > 0 || (relational?.pastoralItems?.length || 0) > 0;
        const normalized = hasRelationalContent ? relational : fallback;

        if (isMounted) {
          setState({
            ...normalized,
            loading: false,
            source: hasRelationalContent ? 'supabase' : 'fallback',
            error: null,
          });
        }
      } catch (error) {
        if (isMounted) {
          setState({
            ...fallback,
            loading: false,
            source: 'fallback',
            error,
          });
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [siteData, siteDataLoading]);

  return state;
};
