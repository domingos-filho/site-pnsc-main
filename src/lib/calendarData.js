import { supabase, isSupabaseReady } from './supabaseClient';

const CALENDAR_EVENTS_TABLE = 'calendar_events';
const CALENDAR_EVENT_TYPES_TABLE = 'calendar_event_types';
const CALENDAR_RESOURCES_TABLE = 'calendar_resources';
const CALENDAR_EVENT_RESOURCES_TABLE = 'calendar_event_resources';
const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_TIMEZONE = 'America/Fortaleza';
const VISIBLE_STATUSES = ['confirmed', 'cancelled'];
export const COMMUNITY_RESOURCE_VALUE = '__community__';

const withTimeout = (promise, ms, message) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const normalizeText = (value) => String(value || '').trim();
const normalizeOptionalText = (value) => {
  const normalized = normalizeText(value);
  return normalized || null;
};

const EVENT_SELECT_FIELDS = [
  'id',
  'slug',
  'title',
  'summary',
  'description',
  'starts_at',
  'ends_at',
  'timezone',
  'is_all_day',
  'status',
  'visibility',
  'event_type_id',
  'community',
  'category',
  'location_text',
  'organizer_name',
  'organizer_phone',
  'organizer_email',
  'expected_attendance',
  'recurrence_rule',
  'recurrence_until',
  'booking_origin',
  'published_at',
  'legacy_event_id',
  'created_at',
  'updated_at',
].join(', ');

const buildResourceMap = (resources) =>
  new Map((resources || []).map((resource) => [String(resource.id), resource]));

const buildEventTypeMap = (eventTypes) =>
  new Map((eventTypes || []).map((eventType) => [String(eventType.id), eventType]));

const buildEventResourceMap = (eventResources) => {
  const map = new Map();

  (eventResources || []).forEach((link) => {
    const key = String(link.event_id);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(link);
  });

  return map;
};

const normalizeEventType = (row) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description || '',
  color: row.color || '#1d4ed8',
  defaultDurationMinutes: row.default_duration_minutes || 60,
  defaultVisibility: row.default_visibility || 'public',
  requiresApproval: Boolean(row.requires_approval),
  requiresResource: Boolean(row.requires_resource),
  isActive: Boolean(row.is_active),
});

const dedupeEventTypes = (items) => {
  const seen = new Set();

  return (items || []).filter((item) => {
    const key = String(item.slug || item.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const normalizeResource = (row) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  type: row.type || 'other',
  description: row.description || '',
  capacity: row.capacity || null,
  bookingMode: row.booking_mode || 'exclusive',
  defaultSetupMinutes: row.default_setup_minutes || 0,
  defaultTeardownMinutes: row.default_teardown_minutes || 0,
  requiresApproval: Boolean(row.requires_approval),
  isActive: Boolean(row.is_active),
  isPubliclyListed: Boolean(row.is_publicly_listed),
});

const normalizeEventResource = (row) => ({
  id: row.id,
  event_id: row.event_id,
  resource_id: row.resource_id,
  starts_at: row.starts_at,
  ends_at: row.ends_at,
  setup_minutes: row.setup_minutes || 0,
  teardown_minutes: row.teardown_minutes || 0,
  notes: row.notes || '',
});

const normalizeCalendarEvent = (row, { eventTypes = [], resources = [], eventResources = [] } = {}) => {
  const eventTypeMap = buildEventTypeMap(eventTypes);
  const resourceMap = buildResourceMap(resources);
  const eventResourceMap = buildEventResourceMap(eventResources);

  const eventType = row.event_type_id ? eventTypeMap.get(String(row.event_type_id)) : null;
  const linkedResources = (eventResourceMap.get(String(row.id)) || [])
    .map((link) => {
      const resource = resourceMap.get(String(link.resource_id));
      if (!resource) return null;

      return {
        ...resource,
        startsAt: link.starts_at || row.starts_at,
        endsAt: link.ends_at || row.ends_at,
        setupMinutes: link.setup_minutes || 0,
        teardownMinutes: link.teardown_minutes || 0,
        notes: link.notes || '',
      };
    })
    .filter(Boolean);

  const primaryResource = linkedResources[0] || null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title || '',
    summary: row.summary || '',
    description: row.description || '',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone || DEFAULT_TIMEZONE,
    isAllDay: Boolean(row.is_all_day),
    status:
      row.status === 'draft'
        ? 'pending_approval'
        : row.status === 'completed'
          ? 'confirmed'
          : row.status || 'pending_approval',
    visibility: row.visibility === 'private' ? 'internal' : row.visibility || 'public',
    eventTypeId: row.event_type_id || '',
    eventTypeName: eventType?.name || row.category || '',
    eventTypeColor: eventType?.color || '#1d4ed8',
    community: row.community || '',
    category: row.category || '',
    locationText: row.location_text || primaryResource?.name || '',
    organizerName: row.organizer_name || '',
    organizerPhone: row.organizer_phone || '',
    organizerEmail: row.organizer_email || '',
    expectedAttendance: row.expected_attendance || null,
    recurrenceRule: row.recurrence_rule || '',
    recurrenceUntil: row.recurrence_until || '',
    bookingOrigin: row.booking_origin || 'manual',
    publishedAt: row.published_at || null,
    legacyEventId: row.legacy_event_id || null,
    resourceId: primaryResource?.id || '',
    resourceName: primaryResource?.name || row.location_text || '',
    resources: linkedResources,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const fetchEventTypes = async ({ publicOnly = true } = {}) => {
  let query = supabase
    .from(CALENDAR_EVENT_TYPES_TABLE)
    .select('id, slug, name, description, color, default_duration_minutes, default_visibility, requires_approval, requires_resource, is_active')
    .order('name', { ascending: true });

  if (publicOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await withTimeout(
    query,
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao carregar tipos de evento.'
  );

  if (error) throw error;
  return dedupeEventTypes((data || []).map(normalizeEventType));
};

const fetchResources = async ({ publicOnly = true } = {}) => {
  let query = supabase
    .from(CALENDAR_RESOURCES_TABLE)
    .select('id, slug, name, type, description, capacity, booking_mode, default_setup_minutes, default_teardown_minutes, requires_approval, is_active, is_publicly_listed')
    .order('name', { ascending: true });

  if (publicOnly) {
    query = query.eq('is_active', true).eq('is_publicly_listed', true);
  }

  const { data, error } = await withTimeout(
    query,
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao carregar espacos.'
  );

  if (error) throw error;
  return (data || []).map(normalizeResource);
};

const fetchEvents = async ({ publicOnly = true } = {}) => {
  let query = supabase
    .from(CALENDAR_EVENTS_TABLE)
    .select(EVENT_SELECT_FIELDS)
    .order('starts_at', { ascending: true });

  if (publicOnly) {
    query = query.in('status', VISIBLE_STATUSES);
  }

  const { data, error } = await withTimeout(
    query,
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao carregar agenda.'
  );

  if (error) throw error;
  return data || [];
};

const fetchEventResourceLinks = async () => {
  const { data, error } = await withTimeout(
    supabase
      .from(CALENDAR_EVENT_RESOURCES_TABLE)
      .select('id, event_id, resource_id, starts_at, ends_at, setup_minutes, teardown_minutes, notes')
      .order('created_at', { ascending: true }),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao carregar vinculos de espaco.'
  );

  if (error) throw error;
  return (data || []).map(normalizeEventResource);
};

const buildEventPayload = (input, resources) => {
  const resourceMap = buildResourceMap(resources);
  const eventTypeMap = buildEventTypeMap(input.eventTypes || []);
  const title = normalizeText(input.title);
  const status = normalizeText(input.status) || 'pending_approval';
  const visibility = normalizeText(input.visibility) || 'public';
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  if (!title) {
    throw new Error('Informe o titulo do evento.');
  }

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error('Informe inicio e fim validos para o evento.');
  }

  if (endsAt <= startsAt) {
    throw new Error('O horario de termino precisa ser maior que o de inicio.');
  }

  const isCommunityResource = input.resourceId === COMMUNITY_RESOURCE_VALUE;
  const resource = !isCommunityResource && input.resourceId
    ? resourceMap.get(String(input.resourceId))
    : null;
  const eventType = input.eventTypeId ? eventTypeMap.get(String(input.eventTypeId)) : null;
  const community = isCommunityResource ? normalizeOptionalText(input.community) : null;
  const expectedAttendance = input.expectedAttendance ? Number(input.expectedAttendance) : null;

  return {
    title,
    summary: normalizeOptionalText(input.summary),
    description: normalizeOptionalText(input.description),
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    timezone: DEFAULT_TIMEZONE,
    is_all_day: Boolean(input.isAllDay),
    status,
    visibility,
    event_type_id: normalizeOptionalText(input.eventTypeId),
    community,
    category: eventType?.name || null,
    location_text: community || resource?.name || null,
    organizer_name: normalizeOptionalText(input.organizerName),
    organizer_phone: normalizeOptionalText(input.organizerPhone),
    organizer_email: normalizeOptionalText(input.organizerEmail),
    expected_attendance: Number.isFinite(expectedAttendance) ? expectedAttendance : null,
    recurrence_rule: normalizeOptionalText(input.recurrenceRule),
    booking_origin: 'manual',
    published_at:
      visibility === 'public' && VISIBLE_STATUSES.includes(status)
        ? new Date().toISOString()
        : null,
  };
};

const syncEventResource = async ({ eventId, resourceId, startsAt, endsAt }) => {
  const { data, error } = await withTimeout(
    supabase
      .from(CALENDAR_EVENT_RESOURCES_TABLE)
      .select('id, resource_id')
      .eq('event_id', eventId),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao carregar o espaco do evento.'
  );

  if (error) throw error;

  const existingLinks = data || [];

  if (!resourceId) {
    if (existingLinks.length > 0) {
      const { error: deleteError } = await withTimeout(
        supabase
          .from(CALENDAR_EVENT_RESOURCES_TABLE)
          .delete()
          .in('id', existingLinks.map((link) => link.id)),
        REQUEST_TIMEOUT_MS,
        'Tempo limite ao remover o espaco do evento.'
      );

      if (deleteError) throw deleteError;
    }
    return;
  }

  const matchingLink = existingLinks.find((link) => String(link.resource_id) === String(resourceId));
  const staleLinks = existingLinks.filter((link) => String(link.resource_id) !== String(resourceId));

  if (staleLinks.length > 0) {
    const { error: deleteError } = await withTimeout(
      supabase
        .from(CALENDAR_EVENT_RESOURCES_TABLE)
        .delete()
        .in('id', staleLinks.map((link) => link.id)),
      REQUEST_TIMEOUT_MS,
      'Tempo limite ao atualizar o espaco do evento.'
    );

    if (deleteError) throw deleteError;
  }

  if (matchingLink) {
    const { error: updateError } = await withTimeout(
      supabase
        .from(CALENDAR_EVENT_RESOURCES_TABLE)
        .update({
          starts_at: startsAt,
          ends_at: endsAt,
        })
        .eq('id', matchingLink.id),
      REQUEST_TIMEOUT_MS,
      'Tempo limite ao atualizar o vinculo do espaco.'
    );

    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await withTimeout(
    supabase
      .from(CALENDAR_EVENT_RESOURCES_TABLE)
      .insert({
        event_id: eventId,
        resource_id: resourceId,
        starts_at: startsAt,
        ends_at: endsAt,
      }),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao vincular o espaco ao evento.'
  );

  if (insertError) throw insertError;
};

export const loadPublicCalendarData = async () => {
  if (!isSupabaseReady) {
    return {
      events: [],
      eventTypes: [],
      resources: [],
      source: 'unavailable',
      error: new Error('Supabase nao configurado.'),
    };
  }

  try {
    const [eventTypes, resources, eventRows] = await Promise.all([
      fetchEventTypes({ publicOnly: true }),
      fetchResources({ publicOnly: true }),
      fetchEvents({ publicOnly: true }),
    ]);

    return {
      events: eventRows.map((row) =>
        normalizeCalendarEvent(row, {
          eventTypes,
          resources,
          eventResources: [],
        })
      ),
      eventTypes,
      resources,
      source: 'calendar',
      error: null,
    };
  } catch (error) {
    return {
      events: [],
      eventTypes: [],
      resources: [],
      source: 'calendar',
      error,
    };
  }
};

export const loadAdminCalendarData = async () => {
  if (!isSupabaseReady) {
    return {
      events: [],
      eventTypes: [],
      resources: [],
      error: new Error('Supabase nao configurado.'),
    };
  }

  try {
    const [eventTypes, resources, eventRows, eventResources] = await Promise.all([
      fetchEventTypes({ publicOnly: false }),
      fetchResources({ publicOnly: false }),
      fetchEvents({ publicOnly: false }),
      fetchEventResourceLinks(),
    ]);

    return {
      events: eventRows.map((row) =>
        normalizeCalendarEvent(row, {
          eventTypes,
          resources,
          eventResources,
        })
      ),
      eventTypes,
      resources,
      error: null,
    };
  } catch (error) {
    return {
      events: [],
      eventTypes: [],
      resources: [],
      error,
    };
  }
};

export const createCalendarEvent = async (input, resources = []) => {
  if (!isSupabaseReady) {
    throw new Error('Supabase nao configurado.');
  }

  const payload = buildEventPayload(input, resources);
  const { data, error } = await withTimeout(
    supabase
      .from(CALENDAR_EVENTS_TABLE)
      .insert(payload)
      .select(EVENT_SELECT_FIELDS)
      .single(),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao criar evento.'
  );

  if (error) throw error;

  await syncEventResource({
    eventId: data.id,
    resourceId: input.resourceId === COMMUNITY_RESOURCE_VALUE ? null : input.resourceId || null,
    startsAt: payload.starts_at,
    endsAt: payload.ends_at,
  });

  return data;
};

export const updateCalendarEvent = async (id, input, resources = []) => {
  if (!isSupabaseReady) {
    throw new Error('Supabase nao configurado.');
  }

  const payload = buildEventPayload(input, resources);
  const { data, error } = await withTimeout(
    supabase
      .from(CALENDAR_EVENTS_TABLE)
      .update(payload)
      .eq('id', id)
      .select(EVENT_SELECT_FIELDS)
      .single(),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao atualizar evento.'
  );

  if (error) throw error;

  await syncEventResource({
    eventId: id,
    resourceId: input.resourceId === COMMUNITY_RESOURCE_VALUE ? null : input.resourceId || null,
    startsAt: payload.starts_at,
    endsAt: payload.ends_at,
  });

  return data;
};

export const deleteCalendarEvent = async (id) => {
  if (!isSupabaseReady) {
    throw new Error('Supabase nao configurado.');
  }

  const { error } = await withTimeout(
    supabase.from(CALENDAR_EVENTS_TABLE).delete().eq('id', id),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao remover evento.'
  );

  if (error) throw error;
};
