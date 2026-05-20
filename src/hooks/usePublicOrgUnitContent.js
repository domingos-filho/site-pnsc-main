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
        const normalized = rows.length > 0 ? buildPublicOrgUnitContentFromRows(rows) : fallback;

        if (isMounted) {
          setState({
            ...normalized,
            loading: false,
            source: rows.length > 0 ? 'supabase' : 'fallback',
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
