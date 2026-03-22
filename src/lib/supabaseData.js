import { supabase, isSupabaseReady } from './supabaseClient';

const SITE_DATA_TABLE = 'site_data';
const SITE_DATA_ID = 1;
const EVENTS_TABLE = 'events';
const LOCAL_EVENTS_KEY = 'paroquia_events';
const LOCAL_PENDING_EVENTS_KEY = 'paroquia_events_pending';
const REQUEST_TIMEOUT_MS = 15000;

const withTimeout = (promise, ms, message) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const safeJsonParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const sortEvents = (events) =>
  [...events].sort((left, right) => {
    const dateCompare = (left.date || '').localeCompare(right.date || '');
    if (dateCompare !== 0) return dateCompare;
    return (left.time || '').localeCompare(right.time || '');
  });

const normalizeEvent = (input) => ({
  title: input.title?.trim() || '',
  date: input.date || '',
  time: input.time || '',
  location: input.location || '',
  community: input.community?.trim() || '',
  category: input.category?.trim() || '',
  recurrence: input.recurrence?.trim() || '',
  description: input.description || '',
});

const normalizeStoredEvent = (input) => {
  if (!input?.id) return null;
  return {
    id: input.id,
    ...normalizeEvent(input),
  };
};

const readLocalEvents = () => {
  if (typeof window === 'undefined') return [];
  const parsed = safeJsonParse(localStorage.getItem(LOCAL_EVENTS_KEY), []);
  const items = Array.isArray(parsed) ? parsed : [];

  return sortEvents(items.map(normalizeStoredEvent).filter(Boolean));
};

const writeLocalEvents = (events) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(sortEvents(events)));
};

const readPendingEvents = () => {
  if (typeof window === 'undefined') {
    return { upserts: [], deletes: [] };
  }

  const parsed = safeJsonParse(localStorage.getItem(LOCAL_PENDING_EVENTS_KEY), {
    upserts: [],
    deletes: [],
  });

  return {
    upserts: Array.isArray(parsed?.upserts)
      ? parsed.upserts.map(normalizeStoredEvent).filter(Boolean)
      : [],
    deletes: Array.isArray(parsed?.deletes) ? parsed.deletes.map(String) : [],
  };
};

const writePendingEvents = (pending) => {
  if (typeof window === 'undefined') return;

  const nextPending = {
    upserts: Array.isArray(pending?.upserts) ? pending.upserts.map(normalizeStoredEvent).filter(Boolean) : [],
    deletes: Array.isArray(pending?.deletes) ? pending.deletes.map(String) : [],
  };

  if (nextPending.upserts.length === 0 && nextPending.deletes.length === 0) {
    localStorage.removeItem(LOCAL_PENDING_EVENTS_KEY);
    return;
  }

  localStorage.setItem(LOCAL_PENDING_EVENTS_KEY, JSON.stringify(nextPending));
};

const isLocalEventId = (id) => String(id).startsWith('local-');

const applyPendingEvents = (baseEvents, pending = readPendingEvents()) => {
  const mergedMap = new Map();
  const pendingUpserts = new Map(
    (pending.upserts || []).map((event) => [String(event.id), normalizeStoredEvent(event)])
  );
  const pendingDeletes = new Set((pending.deletes || []).map(String));

  (Array.isArray(baseEvents) ? baseEvents : []).forEach((event) => {
    const normalizedEvent = normalizeStoredEvent(event);
    if (!normalizedEvent) return;

    const eventId = String(normalizedEvent.id);
    if (pendingDeletes.has(eventId)) {
      return;
    }

    if (pendingUpserts.has(eventId)) {
      mergedMap.set(eventId, pendingUpserts.get(eventId));
      pendingUpserts.delete(eventId);
      return;
    }

    mergedMap.set(eventId, normalizedEvent);
  });

  pendingUpserts.forEach((event, eventId) => {
    if (!pendingDeletes.has(eventId) && event) {
      mergedMap.set(eventId, event);
    }
  });

  return sortEvents([...mergedMap.values()]);
};

const queuePendingUpsert = (event) => {
  const normalizedEvent = normalizeStoredEvent(event);
  if (!normalizedEvent) {
    return readPendingEvents();
  }

  const pending = readPendingEvents();
  const nextPending = {
    upserts: [
      ...pending.upserts.filter((item) => String(item.id) !== String(normalizedEvent.id)),
      normalizedEvent,
    ],
    deletes: pending.deletes.filter((item) => String(item) !== String(normalizedEvent.id)),
  };

  writePendingEvents(nextPending);
  return nextPending;
};

const queuePendingDelete = (id) => {
  const pending = readPendingEvents();
  const normalizedId = String(id);
  const nextPending = {
    upserts: pending.upserts.filter((item) => String(item.id) !== normalizedId),
    deletes: isLocalEventId(normalizedId)
      ? pending.deletes.filter((item) => String(item) !== normalizedId)
      : Array.from(new Set([...pending.deletes.filter((item) => String(item) !== normalizedId), normalizedId])),
  };

  writePendingEvents(nextPending);
  return nextPending;
};

const clearPendingEvent = (id) => {
  const normalizedId = String(id);
  const pending = readPendingEvents();
  const nextPending = {
    upserts: pending.upserts.filter((item) => String(item.id) !== normalizedId),
    deletes: pending.deletes.filter((item) => String(item) !== normalizedId),
  };

  writePendingEvents(nextPending);
  return nextPending;
};

const createLocalId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? `local-${crypto.randomUUID()}`
    : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const fetchRemoteEvents = async () => {
  const { data, error } = await withTimeout(
    supabase
      .from(EVENTS_TABLE)
      .select('*')
      .order('date', { ascending: true }),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao carregar eventos.'
  );

  if (error) {
    throw error;
  }

  return sortEvents((data || []).map(normalizeStoredEvent).filter(Boolean));
};

const syncPendingEvents = async (remoteEvents = []) => {
  if (!isSupabaseReady) {
    const pending = readPendingEvents();
    const events = applyPendingEvents(readLocalEvents(), pending);
    return { events, synced: false, pending };
  }

  let pending = readPendingEvents();
  let syncedEvents = [...remoteEvents];
  let lastError;

  for (const pendingEvent of [...pending.upserts]) {
    try {
      const payload = normalizeEvent(pendingEvent);

      if (isLocalEventId(pendingEvent.id)) {
        const { data, error } = await withTimeout(
          supabase
            .from(EVENTS_TABLE)
            .insert(payload)
            .select('*')
            .single(),
          REQUEST_TIMEOUT_MS,
          'Tempo limite ao criar evento.'
        );

        if (error) throw error;

        const syncedEvent = normalizeStoredEvent(data);
        syncedEvents = [...syncedEvents.filter((event) => String(event.id) !== String(pendingEvent.id)), syncedEvent];
        pending = {
          ...pending,
          upserts: pending.upserts.filter((event) => String(event.id) !== String(pendingEvent.id)),
        };
      } else {
        const { data, error } = await withTimeout(
          supabase
            .from(EVENTS_TABLE)
            .update(payload)
            .eq('id', pendingEvent.id)
            .select('*')
            .single(),
          REQUEST_TIMEOUT_MS,
          'Tempo limite ao atualizar evento.'
        );

        if (error) throw error;

        const syncedEvent = normalizeStoredEvent(data);
        const hasEvent = syncedEvents.some((event) => String(event.id) === String(syncedEvent.id));
        syncedEvents = hasEvent
          ? syncedEvents.map((event) =>
              String(event.id) === String(syncedEvent.id) ? syncedEvent : event
            )
          : [...syncedEvents, syncedEvent];
        pending = {
          ...pending,
          upserts: pending.upserts.filter((event) => String(event.id) !== String(pendingEvent.id)),
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  for (const deletedId of [...pending.deletes]) {
    try {
      const { error } = await withTimeout(
        supabase.from(EVENTS_TABLE).delete().eq('id', deletedId),
        REQUEST_TIMEOUT_MS,
        'Tempo limite ao remover evento.'
      );

      if (error) throw error;

      syncedEvents = syncedEvents.filter((event) => String(event.id) !== String(deletedId));
      pending = {
        ...pending,
        deletes: pending.deletes.filter((eventId) => String(eventId) !== String(deletedId)),
      };
    } catch (error) {
      lastError = error;
    }
  }

  writePendingEvents(pending);

  const visibleEvents = applyPendingEvents(syncedEvents, pending);
  writeLocalEvents(visibleEvents);

  return {
    events: visibleEvents,
    synced: pending.upserts.length === 0 && pending.deletes.length === 0,
    pending,
    error: lastError,
  };
};

export const fetchSiteData = async () => {
  if (!isSupabaseReady) return null;
  const { data, error } = await withTimeout(
    supabase
      .from(SITE_DATA_TABLE)
      .select('data')
      .eq('id', SITE_DATA_ID)
      .maybeSingle(),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao carregar dados do site.'
  );

  if (error) {
    throw error;
  }

  return data?.data ?? null;
};

export const upsertSiteData = async (payload) => {
  if (!isSupabaseReady) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await withTimeout(
    supabase
      .from(SITE_DATA_TABLE)
      .upsert({
        id: SITE_DATA_ID,
        data: payload,
        updated_at: new Date().toISOString(),
      })
      .select('data')
      .single(),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao salvar dados do site.'
  );

  if (error) {
    throw error;
  }

  return data?.data ?? null;
};

export const loadEvents = async ({ useLocalFallback = true, syncPending = false } = {}) => {
  const localEvents = readLocalEvents();
  const pending = readPendingEvents();
  const fallbackEvents = applyPendingEvents(localEvents, pending);

  if (!isSupabaseReady) {
    return { events: fallbackEvents, synced: false };
  }

  try {
    const remoteEvents = await fetchRemoteEvents();
    const mergedEvents = applyPendingEvents(remoteEvents, pending);
    writeLocalEvents(mergedEvents);

    if (syncPending && (pending.upserts.length > 0 || pending.deletes.length > 0)) {
      return syncPendingEvents(remoteEvents);
    }

    return {
      events: mergedEvents,
      synced: pending.upserts.length === 0 && pending.deletes.length === 0,
    };
  } catch (error) {
    return {
      events: useLocalFallback ? fallbackEvents : [],
      synced: false,
      error,
    };
  }
};

export const createEvent = async (input) => {
  const payload = normalizeEvent(input);
  const localEvents = readLocalEvents();

  if (!isSupabaseReady) {
    const newEvent = { id: createLocalId(), ...payload };
    queuePendingUpsert(newEvent);
    const updated = sortEvents([...localEvents, newEvent]);
    writeLocalEvents(updated);
    return { event: newEvent, events: updated, synced: false };
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from(EVENTS_TABLE)
        .insert(payload)
        .select('*')
        .single(),
      REQUEST_TIMEOUT_MS,
      'Tempo limite ao criar evento.'
    );

    if (error) {
      throw error;
    }

    const createdEvent = normalizeStoredEvent(data);
    const updated = sortEvents([
      ...localEvents.filter((event) => String(event.id) !== String(createdEvent.id)),
      createdEvent,
    ]);
    writeLocalEvents(updated);
    clearPendingEvent(createdEvent.id);

    return { event: createdEvent, events: updated, synced: true };
  } catch (error) {
    const newEvent = { id: createLocalId(), ...payload };
    queuePendingUpsert(newEvent);
    const updated = sortEvents([...localEvents, newEvent]);
    writeLocalEvents(updated);
    return { event: newEvent, events: updated, synced: false, error };
  }
};

export const updateEvent = async (id, input) => {
  const payload = normalizeEvent(input);
  const localEvents = readLocalEvents();
  const existingEvent = localEvents.find((event) => String(event.id) === String(id));
  const updatedEvent = normalizeStoredEvent({ ...existingEvent, id, ...payload });

  if (!updatedEvent) {
    return { event: null, events: localEvents, synced: false };
  }

  if (!isSupabaseReady || isLocalEventId(id)) {
    queuePendingUpsert(updatedEvent);
    const updated = sortEvents(
      localEvents.some((event) => String(event.id) === String(id))
        ? localEvents.map((event) => (String(event.id) === String(id) ? updatedEvent : event))
        : [...localEvents, updatedEvent]
    );
    writeLocalEvents(updated);
    return { event: updatedEvent, events: updated, synced: false };
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from(EVENTS_TABLE)
        .update(payload)
        .eq('id', id)
        .select('*')
        .single(),
      REQUEST_TIMEOUT_MS,
      'Tempo limite ao atualizar evento.'
    );

    if (error) {
      throw error;
    }

    const syncedEvent = normalizeStoredEvent(data);
    const updated = sortEvents(
      localEvents.some((event) => String(event.id) === String(id))
        ? localEvents.map((event) => (String(event.id) === String(id) ? syncedEvent : event))
        : [...localEvents, syncedEvent]
    );
    writeLocalEvents(updated);
    clearPendingEvent(id);

    return { event: syncedEvent, events: updated, synced: true };
  } catch (error) {
    queuePendingUpsert(updatedEvent);
    const updated = sortEvents(
      localEvents.some((event) => String(event.id) === String(id))
        ? localEvents.map((event) => (String(event.id) === String(id) ? updatedEvent : event))
        : [...localEvents, updatedEvent]
    );
    writeLocalEvents(updated);
    return { event: updatedEvent, events: updated, synced: false, error };
  }
};

export const deleteEvent = async (id) => {
  const localEvents = readLocalEvents();
  const updated = sortEvents(localEvents.filter((event) => String(event.id) !== String(id)));

  if (!isSupabaseReady || isLocalEventId(id)) {
    queuePendingDelete(id);
    writeLocalEvents(updated);
    return { events: updated, synced: false };
  }

  try {
    const { error } = await withTimeout(
      supabase.from(EVENTS_TABLE).delete().eq('id', id),
      REQUEST_TIMEOUT_MS,
      'Tempo limite ao remover evento.'
    );

    if (error) {
      throw error;
    }

    clearPendingEvent(id);
    writeLocalEvents(updated);
    return { events: updated, synced: true };
  } catch (error) {
    queuePendingDelete(id);
    writeLocalEvents(updated);
    return { events: updated, synced: false, error };
  }
};
