import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Pencil, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseReady, supabase } from '@/lib/supabaseClient';

const orgUnitTypeLabels = {
  community: 'Comunidade',
  pastoral: 'Pastoral',
  movement: 'Movimento',
  service: 'Servico',
};

const eventStatusOptions = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'open', label: 'Aberto' },
  { value: 'closed', label: 'Fechado' },
  { value: 'archived', label: 'Arquivado' },
];

const tableStatusOptions = [
  { value: 'available', label: 'Disponivel' },
  { value: 'blocked', label: 'Bloqueada' },
];

const reservationStatusOptions = [
  { value: 'pending', label: 'Pendente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'expired', label: 'Expirada' },
];

const paymentStatusOptions = [
  { value: 'pending', label: 'Pendente' },
  { value: 'partial', label: 'Parcial' },
  { value: 'paid', label: 'Pago' },
  { value: 'refunded', label: 'Estornado' },
];

const createEmptyEventForm = (orgUnitId = '') => ({
  orgUnitId,
  name: '',
  slug: '',
  description: '',
  eventDate: '',
  salesStartsAt: '',
  salesEndsAt: '',
  defaultTablePrice: '0',
  locationText: '',
  contactName: '',
  contactPhone: '',
  salesStatus: 'draft',
  isActive: true,
});

const createEmptyTableForm = () => ({
  tableNumber: '',
  displayName: '',
  sector: '',
  capacity: '4',
  basePrice: '',
  status: 'available',
  notes: '',
});

const createEmptyTableBatchForm = (startNumber = '1') => ({
  startNumber,
  quantity: '10',
  sector: '',
  capacity: '4',
  basePrice: '',
});

const createEmptyReservationForm = () => ({
  tableId: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  groupName: '',
  status: 'pending',
  paymentStatus: 'pending',
  amountDue: '',
  amountPaid: '0',
  paymentMethod: '',
  expiresAt: '',
  notes: '',
});

const normalizeNestedRelation = (value) => (Array.isArray(value) ? value[0] : value || null);

const normalizeEventRow = (row) => ({
  ...row,
  orgUnit: normalizeNestedRelation(row.org_units),
});

const normalizeReservationRow = (row) => ({
  ...row,
  table: normalizeNestedRelation(row.table_sales_tables),
});

const trimOrNull = (value) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const parseNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseNumberOrZero = (value) => {
  const parsed = parseNumberOrNull(value);
  return parsed === null ? 0 : parsed;
};

const parsePositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeSearch = (value) => String(value || '').trim().toLocaleLowerCase('pt-BR');

const formatTableSalesError = (error, fallback = 'Nao foi possivel concluir a operacao.') =>
  error?.message || fallback;

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));

const formatDateLabel = (value) => {
  if (!value) return '-';

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
    }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
};

const formatDateTimeLabel = (value) => {
  if (!value) return '-';

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatDateTimeLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
};

const getEventStatusBadgeClass = (status) => {
  switch (status) {
    case 'open':
      return 'bg-emerald-100 text-emerald-800';
    case 'closed':
      return 'bg-slate-200 text-slate-700';
    case 'archived':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-blue-100 text-blue-800';
  }
};

const getAvailabilityBadgeClass = (status) => {
  switch (status) {
    case 'reserved':
      return 'bg-amber-100 text-amber-800';
    case 'blocked':
      return 'bg-rose-100 text-rose-800';
    default:
      return 'bg-emerald-100 text-emerald-800';
  }
};

const getReservationStatusBadgeClass = (status) => {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-100 text-emerald-800';
    case 'cancelled':
      return 'bg-rose-100 text-rose-800';
    case 'expired':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-blue-100 text-blue-800';
  }
};

const EventFormDialog = ({
  open,
  onOpenChange,
  mode,
  formState,
  setFormState,
  onSubmit,
  availableOrgUnits,
  saving,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{mode === 'create' ? 'Novo evento de mesas' : 'Editar evento de mesas'}</DialogTitle>
        <DialogDescription>
          Cadastre o evento comercial, a data principal e a janela de venda das mesas.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="table-sales-org-unit">Unidade</Label>
          <select
            id="table-sales-org-unit"
            value={formState.orgUnitId}
            onChange={(event) => setFormState((current) => ({ ...current, orgUnitId: event.target.value }))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecione</option>
            {availableOrgUnits.map((orgUnit) => (
              <option key={orgUnit.id} value={orgUnit.id}>
                [{orgUnitTypeLabels[orgUnit.type] || orgUnit.type}] {orgUnit.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-sales-status">Status comercial</Label>
          <select
            id="table-sales-status"
            value={formState.salesStatus}
            onChange={(event) => setFormState((current) => ({ ...current, salesStatus: event.target.value }))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {eventStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="table-sales-name">Nome</Label>
          <Input
            id="table-sales-name"
            value={formState.name}
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="table-sales-slug">Slug opcional</Label>
          <Input
            id="table-sales-slug"
            value={formState.slug}
            onChange={(event) => setFormState((current) => ({ ...current, slug: event.target.value }))}
            placeholder="Deixe vazio para gerar a partir do nome"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-sales-event-date">Data do evento</Label>
          <Input
            id="table-sales-event-date"
            type="date"
            value={formState.eventDate}
            onChange={(event) => setFormState((current) => ({ ...current, eventDate: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-sales-default-price">Preco padrao da mesa</Label>
          <Input
            id="table-sales-default-price"
            type="number"
            min="0"
            step="0.01"
            value={formState.defaultTablePrice}
            onChange={(event) =>
              setFormState((current) => ({ ...current, defaultTablePrice: event.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-sales-start">Inicio da venda</Label>
          <Input
            id="table-sales-start"
            type="datetime-local"
            value={formState.salesStartsAt}
            onChange={(event) => setFormState((current) => ({ ...current, salesStartsAt: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-sales-end">Fim da venda</Label>
          <Input
            id="table-sales-end"
            type="datetime-local"
            value={formState.salesEndsAt}
            onChange={(event) => setFormState((current) => ({ ...current, salesEndsAt: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-sales-location">Local</Label>
          <Input
            id="table-sales-location"
            value={formState.locationText}
            onChange={(event) => setFormState((current) => ({ ...current, locationText: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-sales-contact-name">Contato responsavel</Label>
          <Input
            id="table-sales-contact-name"
            value={formState.contactName}
            onChange={(event) => setFormState((current) => ({ ...current, contactName: event.target.value }))}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="table-sales-contact-phone">Telefone do contato</Label>
          <Input
            id="table-sales-contact-phone"
            value={formState.contactPhone}
            onChange={(event) => setFormState((current) => ({ ...current, contactPhone: event.target.value }))}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="table-sales-description">Descricao</Label>
          <Textarea
            id="table-sales-description"
            value={formState.description}
            onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
          <input
            type="checkbox"
            checked={formState.isActive}
            onChange={(event) => setFormState((current) => ({ ...current, isActive: event.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          Evento ativo
        </label>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? 'Salvando...' : mode === 'create' ? 'Criar evento' : 'Salvar evento'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const TableFormDialog = ({ open, onOpenChange, mode, formState, setFormState, onSubmit, saving }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{mode === 'create' ? 'Nova mesa' : 'Editar mesa'}</DialogTitle>
        <DialogDescription>
          Cada mesa pertence a um evento e pode ser bloqueada quando nao estiver disponivel para venda.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="table-number">Numero da mesa</Label>
          <Input
            id="table-number"
            value={formState.tableNumber}
            onChange={(event) => setFormState((current) => ({ ...current, tableNumber: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-display-name">Nome exibido</Label>
          <Input
            id="table-display-name"
            value={formState.displayName}
            onChange={(event) => setFormState((current) => ({ ...current, displayName: event.target.value }))}
            placeholder="Opcional"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-sector">Setor</Label>
          <Input
            id="table-sector"
            value={formState.sector}
            onChange={(event) => setFormState((current) => ({ ...current, sector: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-capacity">Capacidade</Label>
          <Input
            id="table-capacity"
            type="number"
            min="1"
            step="1"
            value={formState.capacity}
            onChange={(event) => setFormState((current) => ({ ...current, capacity: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-price">Preco da mesa</Label>
          <Input
            id="table-price"
            type="number"
            min="0"
            step="0.01"
            value={formState.basePrice}
            onChange={(event) => setFormState((current) => ({ ...current, basePrice: event.target.value }))}
            placeholder="Vazio = usar preco padrao do evento"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-status">Status manual</Label>
          <select
            id="table-status"
            value={formState.status}
            onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {tableStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="table-notes">Observacoes</Label>
          <Textarea
            id="table-notes"
            value={formState.notes}
            onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? 'Salvando...' : mode === 'create' ? 'Criar mesa' : 'Salvar mesa'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const BatchTableFormDialog = ({ open, onOpenChange, formState, setFormState, onSubmit, saving }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Gerar mesas em lote</DialogTitle>
        <DialogDescription>
          Informe a numeracao inicial e os dados padrao. O sistema cria a sequencia automaticamente.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="table-batch-start-number">Numero inicial</Label>
          <Input
            id="table-batch-start-number"
            type="number"
            min="1"
            step="1"
            value={formState.startNumber}
            onChange={(event) => setFormState((current) => ({ ...current, startNumber: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-batch-quantity">Quantidade de mesas</Label>
          <Input
            id="table-batch-quantity"
            type="number"
            min="1"
            step="1"
            value={formState.quantity}
            onChange={(event) => setFormState((current) => ({ ...current, quantity: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-batch-sector">Setor</Label>
          <Input
            id="table-batch-sector"
            value={formState.sector}
            onChange={(event) => setFormState((current) => ({ ...current, sector: event.target.value }))}
            placeholder="Opcional"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-batch-capacity">Capacidade padrao</Label>
          <Input
            id="table-batch-capacity"
            type="number"
            min="1"
            step="1"
            value={formState.capacity}
            onChange={(event) => setFormState((current) => ({ ...current, capacity: event.target.value }))}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="table-batch-price">Preco padrao da mesa</Label>
          <Input
            id="table-batch-price"
            type="number"
            min="0"
            step="0.01"
            value={formState.basePrice}
            onChange={(event) => setFormState((current) => ({ ...current, basePrice: event.target.value }))}
            placeholder="Vazio = usar preco padrao do evento"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? 'Gerando...' : 'Gerar mesas'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const ReservationFormDialog = ({
  open,
  onOpenChange,
  mode,
  formState,
  setFormState,
  onSubmit,
  saving,
  tableOptions,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{mode === 'create' ? 'Nova reserva' : 'Editar reserva'}</DialogTitle>
        <DialogDescription>
          Registre o responsavel pela mesa, a situacao da reserva e o pagamento.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="reservation-table">Mesa</Label>
          <select
            id="reservation-table"
            value={formState.tableId}
            onChange={(event) => setFormState((current) => ({ ...current, tableId: event.target.value }))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecione</option>
            {tableOptions.map((table) => (
              <option key={table.table_id} value={table.table_id}>
                Mesa {table.table_number}
                {table.display_name ? ` · ${table.display_name}` : ''}
                {table.sector ? ` · ${table.sector}` : ''}
                {` · ${formatCurrency(table.effective_price)}`}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reservation-customer-name">Responsavel</Label>
          <Input
            id="reservation-customer-name"
            value={formState.customerName}
            onChange={(event) => setFormState((current) => ({ ...current, customerName: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reservation-customer-phone">Telefone</Label>
          <Input
            id="reservation-customer-phone"
            value={formState.customerPhone}
            onChange={(event) => setFormState((current) => ({ ...current, customerPhone: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reservation-customer-email">E-mail</Label>
          <Input
            id="reservation-customer-email"
            type="email"
            value={formState.customerEmail}
            onChange={(event) => setFormState((current) => ({ ...current, customerEmail: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reservation-group-name">Grupo / comunidade</Label>
          <Input
            id="reservation-group-name"
            value={formState.groupName}
            onChange={(event) => setFormState((current) => ({ ...current, groupName: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reservation-status">Status da reserva</Label>
          <select
            id="reservation-status"
            value={formState.status}
            onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {reservationStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reservation-payment-status">Status do pagamento</Label>
          <select
            id="reservation-payment-status"
            value={formState.paymentStatus}
            onChange={(event) => setFormState((current) => ({ ...current, paymentStatus: event.target.value }))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {paymentStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reservation-amount-due">Valor da mesa</Label>
          <Input
            id="reservation-amount-due"
            type="number"
            min="0"
            step="0.01"
            value={formState.amountDue}
            onChange={(event) => setFormState((current) => ({ ...current, amountDue: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reservation-amount-paid">Valor pago</Label>
          <Input
            id="reservation-amount-paid"
            type="number"
            min="0"
            step="0.01"
            value={formState.amountPaid}
            onChange={(event) => setFormState((current) => ({ ...current, amountPaid: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reservation-payment-method">Forma de pagamento</Label>
          <Input
            id="reservation-payment-method"
            value={formState.paymentMethod}
            onChange={(event) => setFormState((current) => ({ ...current, paymentMethod: event.target.value }))}
            placeholder="Pix, dinheiro, cartao..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reservation-expires-at">Expira em</Label>
          <Input
            id="reservation-expires-at"
            type="datetime-local"
            value={formState.expiresAt}
            onChange={(event) => setFormState((current) => ({ ...current, expiresAt: event.target.value }))}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="reservation-notes">Observacoes</Label>
          <Textarea
            id="reservation-notes"
            value={formState.notes}
            onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? 'Salvando...' : mode === 'create' ? 'Criar reserva' : 'Salvar reserva'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const ManageTableSales = () => {
  const [events, setEvents] = useState([]);
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [availableOrgUnits, setAvailableOrgUnits] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventSearch, setEventSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [reservationSearch, setReservationSearch] = useState('');
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventDialogMode, setEventDialogMode] = useState('create');
  const [eventForm, setEventForm] = useState(createEmptyEventForm());
  const [editingEventId, setEditingEventId] = useState(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [tableDialogMode, setTableDialogMode] = useState('create');
  const [tableForm, setTableForm] = useState(createEmptyTableForm());
  const [editingTableId, setEditingTableId] = useState(null);
  const [savingTable, setSavingTable] = useState(false);
  const [tableBatchDialogOpen, setTableBatchDialogOpen] = useState(false);
  const [tableBatchForm, setTableBatchForm] = useState(createEmptyTableBatchForm());
  const [savingTableBatch, setSavingTableBatch] = useState(false);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [reservationDialogMode, setReservationDialogMode] = useState('create');
  const [reservationForm, setReservationForm] = useState(createEmptyReservationForm());
  const [editingReservationId, setEditingReservationId] = useState(null);
  const [savingReservation, setSavingReservation] = useState(false);
  const [activeEventAccess, setActiveEventAccess] = useState({ loading: false, write: null, admin: null });
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, hasModuleAccess, refreshProfile } = useAuth();

  const canWriteTableSales = hasModuleAccess('table_sales', 'write');
  const canAdminTableSales = hasModuleAccess('table_sales', 'admin');

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const filteredEvents = useMemo(() => {
    const term = normalizeSearch(eventSearch);
    if (!term) return events;
    return events.filter((event) => {
      const haystack = [
        event.name,
        event.slug,
        event.description,
        event.orgUnit?.name,
        event.location_text,
      ]
        .filter(Boolean)
        .join(' ');
      return normalizeSearch(haystack).includes(term);
    });
  }, [eventSearch, events]);

  const filteredTables = useMemo(() => {
    const term = normalizeSearch(tableSearch);
    if (!term) return tables;
    return tables.filter((table) => {
      const haystack = [table.table_number, table.display_name, table.sector, table.customer_name, table.notes]
        .filter(Boolean)
        .join(' ');
      return normalizeSearch(haystack).includes(term);
    });
  }, [tableSearch, tables]);

  const filteredReservations = useMemo(() => {
    const term = normalizeSearch(reservationSearch);
    if (!term) return reservations;
    return reservations.filter((reservation) => {
      const haystack = [
        reservation.reservation_code,
        reservation.customer_name,
        reservation.customer_phone,
        reservation.customer_email,
        reservation.group_name,
        reservation.table?.table_number,
      ]
        .filter(Boolean)
        .join(' ');
      return normalizeSearch(haystack).includes(term);
    });
  }, [reservationSearch, reservations]);

  const selectableTablesForReservation = useMemo(() => {
    const editingReservation = reservations.find((reservation) => reservation.id === editingReservationId) || null;

    return tables.filter((table) => {
      if (table.manual_status === 'blocked') {
        return editingReservation?.table_id === table.table_id;
      }
      if (table.availability_status === 'available') return true;
      return editingReservation?.table_id === table.table_id;
    });
  }, [editingReservationId, reservations, tables]);

  const activeReservationsCount = useMemo(
    () => reservations.filter((reservation) => ['pending', 'confirmed'].includes(reservation.status)).length,
    [reservations]
  );

  const nextSuggestedTableNumber = useMemo(() => {
    const maxNumericTableNumber = tables.reduce((maxValue, table) => {
      const parsed = Number.parseInt(String(table.table_number || '').trim(), 10);
      return Number.isInteger(parsed) && parsed > maxValue ? parsed : maxValue;
    }, 0);

    return String(maxNumericTableNumber + 1);
  }, [tables]);

  const totalReceived = useMemo(
    () => reservations.reduce((sum, reservation) => sum + Number(reservation.amount_paid || 0), 0),
    [reservations]
  );

  const totalReservedValue = useMemo(
    () =>
      reservations
        .filter((reservation) => ['pending', 'confirmed'].includes(reservation.status))
        .reduce((sum, reservation) => sum + Number(reservation.amount_due || 0), 0),
    [reservations]
  );

  const availableTablesCount = useMemo(
    () => tables.filter((table) => table.availability_status === 'available').length,
    [tables]
  );

  const loadActiveEventAccess = async (eventId) => {
    if (!eventId || !isSupabaseReady) {
      setActiveEventAccess({ loading: false, write: null, admin: null });
      return;
    }

    setActiveEventAccess((current) => ({ ...current, loading: true }));

    try {
      const [writeResponse, adminResponse] = await Promise.all([
        supabase.rpc('table_sales_can_access_event', {
          target_event_id: eventId,
          permission: 'write',
        }),
        supabase.rpc('table_sales_can_access_event', {
          target_event_id: eventId,
          permission: 'admin',
        }),
      ]);

      if (writeResponse.error) throw writeResponse.error;
      if (adminResponse.error) throw adminResponse.error;

      setActiveEventAccess({
        loading: false,
        write: Boolean(writeResponse.data),
        admin: Boolean(adminResponse.data),
      });
    } catch (error) {
      console.error('Falha ao carregar acesso de mesas', { eventId, error });
      setActiveEventAccess({
        loading: false,
        write: user?.role === 'admin' || canWriteTableSales,
        admin: user?.role === 'admin' || canAdminTableSales,
      });
    }
  };

  const checkOrgUnitPermission = async (orgUnitId, permission) => {
    const { data, error } = await supabase.rpc('table_sales_can_access_org_unit', {
      target_org_unit_id: orgUnitId,
      permission,
    });

    if (error) throw error;
    return Boolean(data);
  };

  const checkEventPermission = async (eventId, permission) => {
    const { data, error } = await supabase.rpc('table_sales_can_access_event', {
      target_event_id: eventId,
      permission,
    });

    if (error) throw error;
    return Boolean(data);
  };

  const ensureSupabaseWriteSession = async () => {
    const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);

    if (sessionError) throw sessionError;
    if (userError) throw userError;

    const sessionUser = sessionData?.session?.user || null;
    const authUser = userData?.user || sessionUser;

    if (!authUser?.id) {
      throw new Error('Sua sessao expirou. Entre novamente para continuar.');
    }

    if (user?.id && authUser.id !== user.id) {
      await refreshProfile?.();
      throw new Error(
        'A sessao autenticada do navegador nao corresponde ao perfil carregado nesta tela. Saia e entre novamente.'
      );
    }

    return authUser;
  };

  const loadAvailableOrgUnits = async () => {
    if (user?.role === 'admin') {
      const { data, error } = await supabase
        .from('org_units')
        .select('id, type, slug, name')
        .eq('is_active', true)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    }

    if (user) {
      const { data: enabledSettings, error: enabledSettingsError } = await supabase
        .from('org_unit_module_settings')
        .select('org_unit_id')
        .eq('module_key', 'table_sales')
        .eq('is_enabled', true);

      if (enabledSettingsError) throw enabledSettingsError;

      const enabledOrgUnitIds = new Set((enabledSettings || []).map((row) => row.org_unit_id));

      return (user.orgUnits || [])
        .map((link) => link.orgUnit)
        .filter((orgUnit) => orgUnit && enabledOrgUnitIds.has(orgUnit.id))
        .sort((a, b) => `${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`, 'pt-BR'));
    }

    return [];
  };

  const loadEvents = async () => {
    if (!isSupabaseReady || !user) return;

    setLoadingEvents(true);
    try {
      const [eventsResponse, orgUnitsResponse] = await Promise.all([
        supabase
          .from('table_sales_events')
          .select(
            `
              id,
              org_unit_id,
              slug,
              name,
              description,
              event_date,
              sales_starts_at,
              sales_ends_at,
              default_table_price,
              location_text,
              contact_name,
              contact_phone,
              sales_status,
              is_active,
              created_at,
              updated_at,
              org_units (
                id,
                type,
                slug,
                name
              )
            `
          )
          .order('event_date', { ascending: false })
          .order('name', { ascending: true }),
        loadAvailableOrgUnits(),
      ]);

      if (eventsResponse.error) throw eventsResponse.error;

      setEvents((eventsResponse.data || []).map(normalizeEventRow));
      setAvailableOrgUnits(orgUnitsResponse);
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatTableSalesError(error, 'Nao foi possivel carregar os eventos de mesas.'),
        variant: 'destructive',
      });
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadTables = async (eventId) => {
    if (!eventId || !isSupabaseReady) {
      setTables([]);
      return;
    }

    setLoadingTables(true);
    try {
      const { data, error } = await supabase.rpc('table_sales_event_tables', {
        target_event_id: eventId,
      });

      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatTableSalesError(error, 'Nao foi possivel carregar as mesas do evento.'),
        variant: 'destructive',
      });
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  const loadReservations = async (eventId) => {
    if (!eventId || !isSupabaseReady) {
      setReservations([]);
      return;
    }

    setLoadingReservations(true);
    try {
      const { data, error } = await supabase
        .from('table_sales_reservations')
        .select(
          `
            id,
            table_sales_event_id,
            table_id,
            reservation_code,
            status,
            customer_name,
            customer_phone,
            customer_email,
            group_name,
            payment_status,
            amount_due,
            amount_paid,
            payment_method,
            expires_at,
            confirmed_at,
            notes,
            created_at,
            updated_at,
            table_sales_tables (
              id,
              table_number,
              display_name,
              sector
            )
          `
        )
        .eq('table_sales_event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReservations((data || []).map(normalizeReservationRow));
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatTableSalesError(error, 'Nao foi possivel carregar as reservas do evento.'),
        variant: 'destructive',
      });
      setReservations([]);
    } finally {
      setLoadingReservations(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!isSupabaseReady) {
      toast({
        title: 'Erro',
        description: 'Supabase nao configurado para o modulo de mesas.',
        variant: 'destructive',
      });
      return;
    }

    void loadEvents();
  }, [navigate, toast, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!events.length) {
      setSelectedEventId(null);
      return;
    }

    if (selectedEventId && events.some((event) => event.id === selectedEventId)) {
      return;
    }

    setSelectedEventId(events[0].id);
  }, [events, selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) {
      setTables([]);
      setReservations([]);
      setActiveEventAccess({ loading: false, write: null, admin: null });
      return;
    }

    void loadActiveEventAccess(selectedEventId);
    void loadTables(selectedEventId);
    void loadReservations(selectedEventId);
  }, [selectedEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateEventDialog = () => {
    setEventDialogMode('create');
    setEditingEventId(null);
    setEventForm(createEmptyEventForm(availableOrgUnits[0]?.id || ''));
    setEventDialogOpen(true);
  };

  const openEditEventDialog = (event) => {
    setEventDialogMode('edit');
    setEditingEventId(event.id);
    setEventForm({
      orgUnitId: event.org_unit_id,
      name: event.name || '',
      slug: event.slug || '',
      description: event.description || '',
      eventDate: event.event_date || '',
      salesStartsAt: formatDateTimeLocalInput(event.sales_starts_at),
      salesEndsAt: formatDateTimeLocalInput(event.sales_ends_at),
      defaultTablePrice: String(event.default_table_price ?? 0),
      locationText: event.location_text || '',
      contactName: event.contact_name || '',
      contactPhone: event.contact_phone || '',
      salesStatus: event.sales_status || 'draft',
      isActive: Boolean(event.is_active),
    });
    setEventDialogOpen(true);
  };

  const saveEvent = async () => {
    if (!eventForm.orgUnitId || !eventForm.name.trim() || !eventForm.eventDate) {
      toast({
        title: 'Erro',
        description: 'Informe a unidade, o nome e a data do evento.',
        variant: 'destructive',
      });
      return;
    }

    setSavingEvent(true);
    try {
      await ensureSupabaseWriteSession();

      if (eventDialogMode === 'create') {
        const canWriteOrgUnit = await checkOrgUnitPermission(eventForm.orgUnitId, 'write');
        if (!canWriteOrgUnit) {
          throw new Error('Seu perfil nao possui permissao de escrita nesta unidade para o modulo de mesas.');
        }
      } else {
        const canWriteEvent = await checkEventPermission(editingEventId, 'write');
        if (!canWriteEvent) {
          throw new Error('Seu perfil nao possui permissao de escrita neste evento de mesas.');
        }
      }

      const payload = {
        org_unit_id: eventForm.orgUnitId,
        name: eventForm.name.trim(),
        slug: trimOrNull(eventForm.slug),
        description: trimOrNull(eventForm.description),
        event_date: eventForm.eventDate,
        sales_starts_at: trimOrNull(eventForm.salesStartsAt),
        sales_ends_at: trimOrNull(eventForm.salesEndsAt),
        default_table_price: parseNumberOrZero(eventForm.defaultTablePrice),
        location_text: trimOrNull(eventForm.locationText),
        contact_name: trimOrNull(eventForm.contactName),
        contact_phone: trimOrNull(eventForm.contactPhone),
        sales_status: eventForm.salesStatus,
        is_active: Boolean(eventForm.isActive),
      };

      const response =
        eventDialogMode === 'create'
          ? await supabase.from('table_sales_events').insert(payload).select('id').single()
          : await supabase.from('table_sales_events').update(payload).eq('id', editingEventId).select('id').single();

      if (response.error) throw response.error;

      await loadEvents();
      setEventDialogOpen(false);

      if (response.data?.id) {
        setSelectedEventId(response.data.id);
      }

      toast({
        title: 'Sucesso!',
        description: `Evento ${eventDialogMode === 'create' ? 'criado' : 'atualizado'}.`,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatTableSalesError(error, 'Nao foi possivel salvar o evento.'),
        variant: 'destructive',
      });
    } finally {
      setSavingEvent(false);
    }
  };

  const deleteEvent = async (event) => {
    if (!window.confirm(`Excluir o evento "${event.name}"? Isso removera mesas e reservas vinculadas.`)) {
      return;
    }

    try {
      await ensureSupabaseWriteSession();
      const { error } = await supabase.from('table_sales_events').delete().eq('id', event.id);
      if (error) throw error;

      await loadEvents();
      if (selectedEventId === event.id) {
        setSelectedEventId(null);
      }

      toast({ title: 'Sucesso!', description: 'Evento excluido.' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatTableSalesError(error, 'Nao foi possivel excluir o evento.'),
        variant: 'destructive',
      });
    }
  };

  const openCreateTableDialog = () => {
    if (!selectedEventId) return;
    setTableDialogMode('create');
    setEditingTableId(null);
    setTableForm(createEmptyTableForm());
    setTableDialogOpen(true);
  };

  const openBatchTableDialog = () => {
    if (!selectedEventId) return;
    setTableBatchForm(createEmptyTableBatchForm(nextSuggestedTableNumber));
    setTableBatchDialogOpen(true);
  };

  const openEditTableDialog = (table) => {
    setTableDialogMode('edit');
    setEditingTableId(table.table_id);
    setTableForm({
      tableNumber: table.table_number || '',
      displayName: table.display_name || '',
      sector: table.sector || '',
      capacity: String(table.capacity ?? 4),
      basePrice: table.base_price ?? '',
      status: table.manual_status || 'available',
      notes: table.notes || '',
    });
    setTableDialogOpen(true);
  };

  const saveTable = async () => {
    if (!selectedEventId || !tableForm.tableNumber.trim()) {
      toast({
        title: 'Erro',
        description: 'Informe ao menos o numero da mesa.',
        variant: 'destructive',
      });
      return;
    }

    setSavingTable(true);
    try {
      await ensureSupabaseWriteSession();
      const canWriteEvent = await checkEventPermission(selectedEventId, 'write');
      if (!canWriteEvent) {
        throw new Error('Seu perfil nao possui permissao de escrita neste evento de mesas.');
      }

      const payload = {
        table_sales_event_id: selectedEventId,
        table_number: tableForm.tableNumber.trim(),
        display_name: trimOrNull(tableForm.displayName),
        sector: trimOrNull(tableForm.sector),
        capacity: parseNumberOrZero(tableForm.capacity),
        base_price: parseNumberOrNull(tableForm.basePrice),
        status: tableForm.status,
        notes: trimOrNull(tableForm.notes),
      };

      const response =
        tableDialogMode === 'create'
          ? await supabase.from('table_sales_tables').insert(payload).select('id').single()
          : await supabase.from('table_sales_tables').update(payload).eq('id', editingTableId).select('id').single();

      if (response.error) throw response.error;

      await loadTables(selectedEventId);
      setTableDialogOpen(false);

      toast({
        title: 'Sucesso!',
        description: `Mesa ${tableDialogMode === 'create' ? 'criada' : 'atualizada'}.`,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatTableSalesError(error, 'Nao foi possivel salvar a mesa.'),
        variant: 'destructive',
      });
    } finally {
      setSavingTable(false);
    }
  };

  const saveTableBatch = async () => {
    if (!selectedEventId) return;

    const startNumber = parsePositiveInteger(tableBatchForm.startNumber);
    const quantity = parsePositiveInteger(tableBatchForm.quantity);
    const capacity = parsePositiveInteger(tableBatchForm.capacity);

    if (!startNumber || !quantity || !capacity) {
      toast({
        title: 'Erro',
        description: 'Informe numero inicial, quantidade e capacidade com valores inteiros maiores que zero.',
        variant: 'destructive',
      });
      return;
    }

    if (quantity > 500) {
      toast({
        title: 'Erro',
        description: 'A geracao em lote aceita no maximo 500 mesas por vez.',
        variant: 'destructive',
      });
      return;
    }

    setSavingTableBatch(true);
    try {
      await ensureSupabaseWriteSession();
      const canWriteEvent = await checkEventPermission(selectedEventId, 'write');
      if (!canWriteEvent) {
        throw new Error('Seu perfil nao possui permissao de escrita neste evento de mesas.');
      }

      const generatedNumbers = Array.from({ length: quantity }, (_, index) => String(startNumber + index));
      const { data: existingTables, error: existingTablesError } = await supabase
        .from('table_sales_tables')
        .select('table_number')
        .eq('table_sales_event_id', selectedEventId)
        .in('table_number', generatedNumbers);

      if (existingTablesError) throw existingTablesError;

      if (existingTables?.length) {
        const duplicatedNumbers = existingTables.map((table) => table.table_number).filter(Boolean);
        const preview = duplicatedNumbers.slice(0, 6).join(', ');
        const suffix = duplicatedNumbers.length > 6 ? '...' : '';
        throw new Error(`Ja existem mesas com esta numeracao neste evento: ${preview}${suffix}`);
      }

      const batchPayload = generatedNumbers.map((tableNumber) => ({
        table_sales_event_id: selectedEventId,
        table_number: tableNumber,
        display_name: null,
        sector: trimOrNull(tableBatchForm.sector),
        capacity,
        base_price: parseNumberOrNull(tableBatchForm.basePrice),
        status: 'available',
        notes: null,
      }));

      const { error } = await supabase.from('table_sales_tables').insert(batchPayload);
      if (error) throw error;

      await loadTables(selectedEventId);
      setTableBatchDialogOpen(false);

      toast({
        title: 'Sucesso!',
        description: `${quantity} mesa${quantity > 1 ? 's foram criadas' : ' foi criada'} em lote.`,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatTableSalesError(error, 'Nao foi possivel gerar as mesas em lote.'),
        variant: 'destructive',
      });
    } finally {
      setSavingTableBatch(false);
    }
  };

  const deleteTable = async (table) => {
    if (!window.confirm(`Excluir a mesa ${table.table_number}?`)) {
      return;
    }

    try {
      await ensureSupabaseWriteSession();
      const { error } = await supabase.from('table_sales_tables').delete().eq('id', table.table_id);
      if (error) throw error;

      await loadTables(selectedEventId);
      await loadReservations(selectedEventId);

      toast({ title: 'Sucesso!', description: 'Mesa excluida.' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatTableSalesError(
          error,
          'Nao foi possivel excluir a mesa. Se houver reserva ativa vinculada, cancele-a primeiro.'
        ),
        variant: 'destructive',
      });
    }
  };

  const openCreateReservationDialog = (prefilledTable = null) => {
    if (!selectedEventId) return;

    setReservationDialogMode('create');
    setEditingReservationId(null);
    setReservationForm({
      ...createEmptyReservationForm(),
      tableId: prefilledTable?.table_id || '',
      amountDue: prefilledTable ? String(prefilledTable.effective_price ?? 0) : '',
    });
    setReservationDialogOpen(true);
  };

  const openEditReservationDialog = (reservation) => {
    setReservationDialogMode('edit');
    setEditingReservationId(reservation.id);
    setReservationForm({
      tableId: reservation.table_id || '',
      customerName: reservation.customer_name || '',
      customerPhone: reservation.customer_phone || '',
      customerEmail: reservation.customer_email || '',
      groupName: reservation.group_name || '',
      status: reservation.status || 'pending',
      paymentStatus: reservation.payment_status || 'pending',
      amountDue: String(reservation.amount_due ?? 0),
      amountPaid: String(reservation.amount_paid ?? 0),
      paymentMethod: reservation.payment_method || '',
      expiresAt: formatDateTimeLocalInput(reservation.expires_at),
      notes: reservation.notes || '',
    });
    setReservationDialogOpen(true);
  };

  const saveReservation = async () => {
    if (!selectedEventId || !reservationForm.tableId || !reservationForm.customerName.trim()) {
      toast({
        title: 'Erro',
        description: 'Informe a mesa e o responsavel pela reserva.',
        variant: 'destructive',
      });
      return;
    }

    setSavingReservation(true);
    try {
      await ensureSupabaseWriteSession();
      const canWriteEvent = await checkEventPermission(selectedEventId, 'write');
      if (!canWriteEvent) {
        throw new Error('Seu perfil nao possui permissao de escrita neste evento de mesas.');
      }

      const payload = {
        table_sales_event_id: selectedEventId,
        table_id: reservationForm.tableId,
        customer_name: reservationForm.customerName.trim(),
        customer_phone: trimOrNull(reservationForm.customerPhone),
        customer_email: trimOrNull(reservationForm.customerEmail),
        group_name: trimOrNull(reservationForm.groupName),
        status: reservationForm.status,
        payment_status: reservationForm.paymentStatus,
        amount_due: parseNumberOrNull(reservationForm.amountDue),
        amount_paid: parseNumberOrZero(reservationForm.amountPaid),
        payment_method: trimOrNull(reservationForm.paymentMethod),
        expires_at: trimOrNull(reservationForm.expiresAt),
        notes: trimOrNull(reservationForm.notes),
      };

      const response =
        reservationDialogMode === 'create'
          ? await supabase.from('table_sales_reservations').insert(payload).select('id').single()
          : await supabase
              .from('table_sales_reservations')
              .update(payload)
              .eq('id', editingReservationId)
              .select('id')
              .single();

      if (response.error) throw response.error;

      await Promise.all([loadTables(selectedEventId), loadReservations(selectedEventId)]);
      setReservationDialogOpen(false);

      toast({
        title: 'Sucesso!',
        description: `Reserva ${reservationDialogMode === 'create' ? 'criada' : 'atualizada'}.`,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatTableSalesError(error, 'Nao foi possivel salvar a reserva.'),
        variant: 'destructive',
      });
    } finally {
      setSavingReservation(false);
    }
  };

  const deleteReservation = async (reservation) => {
    if (!window.confirm(`Excluir a reserva ${reservation.reservation_code}?`)) {
      return;
    }

    try {
      await ensureSupabaseWriteSession();
      const { error } = await supabase.from('table_sales_reservations').delete().eq('id', reservation.id);
      if (error) throw error;

      await Promise.all([loadTables(selectedEventId), loadReservations(selectedEventId)]);

      toast({ title: 'Sucesso!', description: 'Reserva excluida.' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatTableSalesError(error, 'Nao foi possivel excluir a reserva.'),
        variant: 'destructive',
      });
    }
  };

  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>Mesas - Dashboard</title>
        <meta
          name="description"
          content="Gerencie eventos, mesas e reservas com operacao simples por unidade."
        />
      </Helmet>

      <EventFormDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        mode={eventDialogMode}
        formState={eventForm}
        setFormState={setEventForm}
        onSubmit={() => void saveEvent()}
        availableOrgUnits={availableOrgUnits}
        saving={savingEvent}
      />

      <TableFormDialog
        open={tableDialogOpen}
        onOpenChange={setTableDialogOpen}
        mode={tableDialogMode}
        formState={tableForm}
        setFormState={setTableForm}
        onSubmit={() => void saveTable()}
        saving={savingTable}
      />

      <BatchTableFormDialog
        open={tableBatchDialogOpen}
        onOpenChange={setTableBatchDialogOpen}
        formState={tableBatchForm}
        setFormState={setTableBatchForm}
        onSubmit={() => void saveTableBatch()}
        saving={savingTableBatch}
      />

      <ReservationFormDialog
        open={reservationDialogOpen}
        onOpenChange={setReservationDialogOpen}
        mode={reservationDialogMode}
        formState={reservationForm}
        setFormState={setReservationForm}
        onSubmit={() => void saveReservation()}
        saving={savingReservation}
        tableOptions={selectableTablesForReservation}
      />

      <div className="min-h-screen bg-slate-50">
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white">
          <div className="container mx-auto px-4 py-10 md:px-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
                <Users className="h-3.5 w-3.5" />
                Reserva de Mesas
              </div>
              <h1 className="mt-4 text-3xl font-bold md:text-5xl">Mesas por evento e unidade</h1>
              <p className="mt-3 max-w-2xl text-sm text-blue-100 md:text-base">
                Operacao simples para cadastrar eventos, distribuir mesas e controlar reservas com status e
                pagamento.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => void loadEvents()} disabled={loadingEvents}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {loadingEvents ? 'Atualizando...' : 'Atualizar'}
                </Button>
                {canWriteTableSales ? (
                  <Button onClick={openCreateEventDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo evento
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto space-y-6 px-4 py-6 md:px-6 md:py-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-slate-500">Eventos visiveis</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{events.length}</div>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-slate-500">Mesas do evento</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{tables.length}</div>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-slate-500">Reservas ativas</div>
              <div className="mt-2 text-3xl font-bold text-amber-600">{activeReservationsCount}</div>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-slate-500">Valor recebido</div>
              <div className="mt-2 text-3xl font-bold text-emerald-600">{formatCurrency(totalReceived)}</div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <motion.section
              className="rounded-2xl border bg-white p-5 shadow-sm"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Eventos</h2>
                  <p className="text-sm text-slate-500">Escolha um evento para administrar mesas e reservas.</p>
                </div>
              </div>

              <div className="mt-4">
                <Input
                  value={eventSearch}
                  onChange={(event) => setEventSearch(event.target.value)}
                  placeholder="Buscar por evento, unidade ou local"
                />
              </div>

              <div className="mt-4 space-y-3">
                {loadingEvents ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    Carregando eventos...
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    Nenhum evento encontrado.
                  </div>
                ) : (
                  filteredEvents.map((event) => {
                    const isSelected = event.id === selectedEventId;

                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => setSelectedEventId(event.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? 'border-blue-300 bg-blue-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                              {event.orgUnit?.type || 'Unidade'}
                            </div>
                            <div className="mt-1 truncate text-lg font-semibold text-slate-900">{event.name}</div>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getEventStatusBadgeClass(
                              event.sales_status
                            )}`}
                          >
                            {eventStatusOptions.find((option) => option.value === event.sales_status)?.label ||
                              event.sales_status}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-slate-600">{event.orgUnit?.name || '-'}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-1">{formatDateLabel(event.event_date)}</span>
                          {event.location_text ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1">{event.location_text}</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.section>

            <motion.section
              className="rounded-2xl border bg-white p-5 shadow-sm"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              {!selectedEvent ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  Selecione um evento para administrar mesas e reservas.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getEventStatusBadgeClass(
                            selectedEvent.sales_status
                          )}`}
                        >
                          {eventStatusOptions.find((option) => option.value === selectedEvent.sales_status)?.label ||
                            selectedEvent.sales_status}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {selectedEvent.orgUnit?.name || '-'}
                        </span>
                      </div>
                      <h2 className="mt-3 text-2xl font-bold text-slate-900">{selectedEvent.name}</h2>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                          <CalendarDays className="h-4 w-4" />
                          {formatDateLabel(selectedEvent.event_date)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Padrao por mesa: {formatCurrency(selectedEvent.default_table_price)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Livres: {availableTablesCount}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Previsto: {formatCurrency(totalReservedValue)}
                        </span>
                      </div>
                      <p className="mt-4 max-w-3xl text-sm text-slate-600">
                        {selectedEvent.description || 'Sem descricao cadastrada.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {activeEventAccess.write ? (
                        <>
                          <Button variant="outline" onClick={() => openEditEventDialog(selectedEvent)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar evento
                          </Button>
                          <Button onClick={openCreateTableDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nova mesa
                          </Button>
                          <Button variant="outline" onClick={openBatchTableDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Gerar mesas
                          </Button>
                          <Button variant="secondary" onClick={() => openCreateReservationDialog()}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nova reserva
                          </Button>
                        </>
                      ) : null}
                      {activeEventAccess.admin ? (
                        <Button variant="destructive" onClick={() => void deleteEvent(selectedEvent)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir evento
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Janela de venda</div>
                      <div className="mt-2 text-sm text-slate-700">
                        {selectedEvent.sales_starts_at ? formatDateTimeLabel(selectedEvent.sales_starts_at) : 'Sem inicio'}
                      </div>
                      <div className="text-sm text-slate-700">
                        {selectedEvent.sales_ends_at ? formatDateTimeLabel(selectedEvent.sales_ends_at) : 'Sem encerramento'}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Local</div>
                      <div className="mt-2 text-sm text-slate-700">{selectedEvent.location_text || '-'}</div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Contato</div>
                      <div className="mt-2 text-sm text-slate-700">{selectedEvent.contact_name || '-'}</div>
                      <div className="text-sm text-slate-700">{selectedEvent.contact_phone || '-'}</div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recebido</div>
                      <div className="mt-2 text-lg font-semibold text-emerald-700">{formatCurrency(totalReceived)}</div>
                    </div>
                  </div>
                </>
              )}
            </motion.section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <motion.section
              className="rounded-2xl border bg-white p-5 shadow-sm"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Mesas</h2>
                  <p className="text-sm text-slate-500">Controle de disponibilidade e preco por mesa.</p>
                </div>
                {selectedEvent && activeEventAccess.write ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" onClick={openBatchTableDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      Gerar mesas
                    </Button>
                    <Button onClick={openCreateTableDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nova mesa
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4">
                <Input
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder="Buscar por mesa, setor ou observacao"
                />
              </div>

              {!selectedEvent ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Escolha um evento para carregar as mesas.
                </div>
              ) : loadingTables ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Carregando mesas...
                </div>
              ) : filteredTables.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Nenhuma mesa cadastrada para este evento.
                </div>
              ) : (
                <>
                  <div className="mt-4 hidden overflow-x-auto lg:block">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
                        <tr>
                          <th className="pb-3">Mesa</th>
                          <th className="pb-3">Setor</th>
                          <th className="pb-3">Cap.</th>
                          <th className="pb-3">Preco</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3 text-right">Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTables.map((table) => (
                          <tr key={table.table_id} className="border-t border-slate-100">
                            <td className="py-3">
                              <div className="font-semibold text-slate-900">Mesa {table.table_number}</div>
                              <div className="text-xs text-slate-500">{table.display_name || '-'}</div>
                            </td>
                            <td className="py-3 text-slate-700">{table.sector || '-'}</td>
                            <td className="py-3 text-slate-700">{table.capacity}</td>
                            <td className="py-3 text-slate-700">{formatCurrency(table.effective_price)}</td>
                            <td className="py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getAvailabilityBadgeClass(
                                  table.availability_status
                                )}`}
                              >
                                {table.availability_status === 'reserved'
                                  ? 'Reservada'
                                  : table.availability_status === 'blocked'
                                    ? 'Bloqueada'
                                    : 'Disponivel'}
                              </span>
                            </td>
                            <td className="py-3">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditTableDialog(table)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => openCreateReservationDialog(table)}
                                  disabled={table.availability_status !== 'available'}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => void deleteTable(table)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 space-y-3 lg:hidden">
                    {filteredTables.map((table) => (
                      <div key={table.table_id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-slate-900">Mesa {table.table_number}</div>
                            <div className="text-sm text-slate-500">{table.display_name || table.sector || '-'}</div>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getAvailabilityBadgeClass(
                              table.availability_status
                            )}`}
                          >
                            {table.availability_status === 'reserved'
                              ? 'Reservada'
                              : table.availability_status === 'blocked'
                                ? 'Bloqueada'
                                : 'Disponivel'}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
                          <div>Capacidade: {table.capacity}</div>
                          <div>Preco: {formatCurrency(table.effective_price)}</div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditTableDialog(table)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openCreateReservationDialog(table)}
                            disabled={table.availability_status !== 'available'}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Reservar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => void deleteTable(table)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.section>

            <motion.section
              className="rounded-2xl border bg-white p-5 shadow-sm"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Reservas</h2>
                  <p className="text-sm text-slate-500">Controle responsavel, status e pagamento.</p>
                </div>
                {selectedEvent && activeEventAccess.write ? (
                  <Button onClick={() => openCreateReservationDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova reserva
                  </Button>
                ) : null}
              </div>

              <div className="mt-4">
                <Input
                  value={reservationSearch}
                  onChange={(event) => setReservationSearch(event.target.value)}
                  placeholder="Buscar por codigo, responsavel ou mesa"
                />
              </div>

              {!selectedEvent ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Escolha um evento para carregar as reservas.
                </div>
              ) : loadingReservations ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Carregando reservas...
                </div>
              ) : filteredReservations.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Nenhuma reserva registrada para este evento.
                </div>
              ) : (
                <>
                  <div className="mt-4 hidden overflow-x-auto lg:block">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
                        <tr>
                          <th className="pb-3">Codigo</th>
                          <th className="pb-3">Mesa</th>
                          <th className="pb-3">Responsavel</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3">Pagamento</th>
                          <th className="pb-3 text-right">Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReservations.map((reservation) => (
                          <tr key={reservation.id} className="border-t border-slate-100">
                            <td className="py-3 font-mono text-xs text-slate-700">{reservation.reservation_code}</td>
                            <td className="py-3 text-slate-700">Mesa {reservation.table?.table_number || '-'}</td>
                            <td className="py-3">
                              <div className="font-semibold text-slate-900">{reservation.customer_name}</div>
                              <div className="text-xs text-slate-500">{reservation.customer_phone || '-'}</div>
                            </td>
                            <td className="py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getReservationStatusBadgeClass(
                                  reservation.status
                                )}`}
                              >
                                {reservationStatusOptions.find((option) => option.value === reservation.status)?.label ||
                                  reservation.status}
                              </span>
                            </td>
                            <td className="py-3 text-slate-700">
                              {formatCurrency(reservation.amount_paid)} / {formatCurrency(reservation.amount_due)}
                            </td>
                            <td className="py-3">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditReservationDialog(reservation)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => void deleteReservation(reservation)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 space-y-3 lg:hidden">
                    {filteredReservations.map((reservation) => (
                      <div key={reservation.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-mono text-xs text-slate-500">{reservation.reservation_code}</div>
                            <div className="mt-1 text-base font-semibold text-slate-900">
                              {reservation.customer_name}
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getReservationStatusBadgeClass(
                              reservation.status
                            )}`}
                          >
                            {reservationStatusOptions.find((option) => option.value === reservation.status)?.label ||
                              reservation.status}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-slate-600">
                          <div>Mesa {reservation.table?.table_number || '-'}</div>
                          <div>{reservation.customer_phone || '-'}</div>
                          <div>
                            Pago {formatCurrency(reservation.amount_paid)} de {formatCurrency(reservation.amount_due)}
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditReservationDialog(reservation)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => void deleteReservation(reservation)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.section>
          </div>
        </div>
      </div>
    </>
  );
};

export default ManageTableSales;
