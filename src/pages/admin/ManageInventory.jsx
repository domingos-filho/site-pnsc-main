import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  Filter,
  Image,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
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
import {
  formatInventoryError,
  getInventorySignedUrl,
  removeInventoryStorageObject,
  uploadInventoryAttachmentFile,
} from '@/lib/inventory';

const orgUnitTypeLabels = {
  community: 'Comunidade',
  pastoral: 'Pastoral',
  movement: 'Movimento',
  service: 'Servico',
};

const inventoryTypeOptions = [
  { value: 'mixed', label: 'Misto' },
  { value: 'consumables', label: 'Consumo' },
  { value: 'assets', label: 'Patrimonio' },
  { value: 'documents', label: 'Documentos' },
  { value: 'other', label: 'Outro' },
];

const itemTypeOptions = [
  { value: 'consumable', label: 'Consumo' },
  { value: 'asset', label: 'Patrimonio' },
  { value: 'document', label: 'Documento' },
  { value: 'other', label: 'Outro' },
];

const trackingModeOptions = [
  { value: 'quantity', label: 'Quantidade' },
  { value: 'serial', label: 'Serial' },
];

const conditionStatusOptions = [
  { value: 'new', label: 'Novo' },
  { value: 'good', label: 'Bom' },
  { value: 'fair', label: 'Regular' },
  { value: 'repair', label: 'Em reparo' },
  { value: 'retired', label: 'Baixado' },
];

const movementTypeOptions = [
  { value: 'entry', label: 'Entrada' },
  { value: 'exit', label: 'Saida' },
  { value: 'adjustment', label: 'Ajuste' },
  { value: 'transfer_in', label: 'Transferencia recebida' },
  { value: 'transfer_out', label: 'Transferencia enviada' },
  { value: 'stocktake', label: 'Contagem' },
  { value: 'writeoff', label: 'Baixa' },
];

const attachmentKindOptions = [
  { value: 'image', label: 'Imagem' },
  { value: 'invoice', label: 'Nota fiscal' },
  { value: 'document', label: 'Documento' },
  { value: 'other', label: 'Outro' },
];

const movementReferenceSuggestions = [
  'compra',
  'doacao',
  'emprestimo',
  'evento',
  'inventario',
  'manutencao',
  'reposicao',
  'transferencia',
];

const createLocalDateTimeValue = () => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
};

const createEmptyInventoryForm = (orgUnitId = '') => ({
  orgUnitId,
  name: '',
  slug: '',
  description: '',
  inventoryType: 'mixed',
  isActive: true,
});

const createEmptyItemForm = () => ({
  sku: '',
  name: '',
  description: '',
  itemType: 'consumable',
  trackingMode: 'quantity',
  unitLabel: 'un',
  currentQuantity: '0',
  minimumQuantity: '0',
  idealQuantity: '',
  locationText: '',
  brand: '',
  model: '',
  serialNumber: '',
  conditionStatus: 'good',
  acquisitionDate: '',
  acquisitionCost: '',
  isActive: true,
  photoFile: null,
  photoPreviewUrl: '',
  removePhoto: false,
});

const createEmptyMovementForm = () => ({
  movementType: 'entry',
  quantity: '',
  referenceType: '',
  referenceCode: '',
  notes: '',
  occurredAt: createLocalDateTimeValue(),
});

const createEmptyAttachmentForm = () => ({
  file: null,
  kind: 'image',
  caption: '',
  isCover: false,
});

const normalizeNestedOrgUnit = (value) => (Array.isArray(value) ? value[0] : value || null);

const normalizeInventoryRow = (row) => ({
  ...row,
  orgUnit: normalizeNestedOrgUnit(row.org_units),
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

const normalizeSearch = (value) => String(value || '').trim().toLocaleLowerCase('pt-BR');

const formatQuantity = (value, unitLabel) => {
  const numeric = Number(value || 0);
  const formatted = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(3).replace(/\.?0+$/, '');
  return `${formatted} ${unitLabel || 'un'}`.trim();
};

const formatDateTime = (value) => {
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

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('Nao foi possivel ler a imagem.'));
    reader.readAsDataURL(file);
  });

const attachmentKindLabel = (kind) =>
  attachmentKindOptions.find((option) => option.value === kind)?.label || kind;

const movementTypeLabel = (type) =>
  movementTypeOptions.find((option) => option.value === type)?.label || type;

const buildMovementReferenceSummary = (movement) => {
  const referenceType = trimOrNull(movement.reference_type);
  const referenceCode = trimOrNull(movement.reference_code);

  if (referenceType && referenceCode) return `${referenceType} · ${referenceCode}`;
  if (referenceType) return referenceType;
  if (referenceCode) return referenceCode;
  return null;
};

const buildMovementDelta = (movementType, quantityInput) => {
  const parsed = Number(quantityInput);
  if (!Number.isFinite(parsed) || parsed === 0) return null;

  switch (movementType) {
    case 'entry':
    case 'transfer_in':
      return Math.abs(parsed);
    case 'exit':
    case 'transfer_out':
    case 'writeoff':
      return -Math.abs(parsed);
    case 'adjustment':
    case 'stocktake':
    default:
      return parsed;
  }
};

const movementHelpText = (movementType) => {
  if (movementType === 'adjustment' || movementType === 'stocktake') {
    return 'Use valor positivo para acrescentar saldo e negativo para reduzir.';
  }

  return 'Informe um valor positivo. O sistema aplica o sinal conforme o tipo de movimentacao.';
};

const isInventoryWritePolicyError = (error) =>
  error?.code === '42501' && /row-level security policy/i.test(error?.message || '');

const safeDownloadSegment = (value, fallback) => {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || fallback;
};

const buildAttachmentDownloadName = (attachment, item, inventory) => {
  const inventorySegment = safeDownloadSegment(inventory?.slug || inventory?.name, 'inventario');
  const itemSegment = safeDownloadSegment(item?.sku || item?.name, 'item');
  const originalName = safeDownloadSegment(attachment?.file_name, 'anexo');

  return `${inventorySegment}--${itemSegment}--${originalName}`;
};

const triggerBrowserDownload = (url, fileName) => {
  if (!url) return;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'anexo';
  link.target = '_blank';
  link.rel = 'noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const InventoryFormDialog = ({
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
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{mode === 'create' ? 'Novo inventario' : 'Editar inventario'}</DialogTitle>
        <DialogDescription>
          Cada inventario fica vinculado a uma unidade organizacional e segue as permissoes do modulo.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inventory-org-unit">Unidade</Label>
          <select
            id="inventory-org-unit"
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
          <Label htmlFor="inventory-type">Tipo</Label>
          <select
            id="inventory-type"
            value={formState.inventoryType}
            onChange={(event) =>
              setFormState((current) => ({ ...current, inventoryType: event.target.value }))
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {inventoryTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="inventory-name">Nome</Label>
          <Input
            id="inventory-name"
            value={formState.name}
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="inventory-slug">Slug opcional</Label>
          <Input
            id="inventory-slug"
            value={formState.slug}
            onChange={(event) => setFormState((current) => ({ ...current, slug: event.target.value }))}
            placeholder="Deixe vazio para gerar a partir do nome"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="inventory-description">Descricao</Label>
          <Textarea
            id="inventory-description"
            value={formState.description}
            onChange={(event) =>
              setFormState((current) => ({ ...current, description: event.target.value }))
            }
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
          <input
            type="checkbox"
            checked={formState.isActive}
            onChange={(event) => setFormState((current) => ({ ...current, isActive: event.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          Inventario ativo
        </label>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? 'Salvando...' : mode === 'create' ? 'Criar inventario' : 'Salvar ajustes'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const ItemFormDialog = ({
  open,
  onOpenChange,
  mode,
  formState,
  setFormState,
  photoInputKey,
  onSubmit,
  saving,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl gap-0 overflow-hidden p-0 sm:w-full">
      <div className="flex max-h-[90vh] flex-col">
        <DialogHeader className="shrink-0 border-b px-4 pb-4 pt-5 pr-14 sm:px-6 sm:pb-5 sm:pt-6 sm:pr-16">
          <DialogTitle>{mode === 'create' ? 'Novo item' : 'Editar item'}</DialogTitle>
          <DialogDescription>
            Cadastre a quantidade manualmente e, se quiser, adicione uma foto para identificacao visual do item.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="item-name">Nome</Label>
              <Input
                id="item-name"
                value={formState.name}
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-sku">SKU</Label>
              <Input
                id="item-sku"
                value={formState.sku}
                onChange={(event) => setFormState((current) => ({ ...current, sku: event.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="item-description">Descricao</Label>
              <Textarea
                id="item-description"
                className="min-h-[112px]"
                value={formState.description}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>

            <div className="space-y-3 md:col-span-2">
              <Label htmlFor="item-photo">Foto do item</Label>
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                {formState.photoPreviewUrl ? (
                  <img
                    src={formState.photoPreviewUrl}
                    alt={formState.name || 'Foto do item'}
                    className="h-48 w-full rounded-xl object-cover sm:h-64"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center rounded-xl bg-white text-sm text-slate-500">
                    Nenhuma foto selecionada.
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    key={photoInputKey}
                    id="item-photo"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={async (event) => {
                      const file = event.target.files?.[0] || null;
                      if (!file) return;

                      const previewUrl = await readFileAsDataUrl(file);
                      setFormState((current) => ({
                        ...current,
                        photoFile: file,
                        photoPreviewUrl: previewUrl,
                        removePhoto: false,
                      }));
                    }}
                  />

                  {formState.photoPreviewUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setFormState((current) => ({
                          ...current,
                          photoFile: null,
                          photoPreviewUrl: '',
                          removePhoto: true,
                        }))
                      }
                    >
                      Remover foto
                    </Button>
                  ) : null}
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  No celular, voce pode tirar a foto na hora. No desktop, pode carregar uma imagem existente.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-type">Tipo</Label>
              <select
                id="item-type"
                value={formState.itemType}
                onChange={(event) => setFormState((current) => ({ ...current, itemType: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {itemTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-label">Unidade</Label>
              <Input
                id="unit-label"
                value={formState.unitLabel}
                onChange={(event) => setFormState((current) => ({ ...current, unitLabel: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="condition-status">Estado</Label>
              <select
                id="condition-status"
                value={formState.conditionStatus}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, conditionStatus: event.target.value }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {conditionStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="current-quantity">Quantidade</Label>
              <Input
                id="current-quantity"
                type="number"
                step="0.001"
                value={formState.currentQuantity}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, currentQuantity: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-text">Localizacao</Label>
              <Input
                id="location-text"
                value={formState.locationText}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, locationText: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                value={formState.brand}
                onChange={(event) => setFormState((current) => ({ ...current, brand: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input
                id="model"
                value={formState.model}
                onChange={(event) => setFormState((current) => ({ ...current, model: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serial-number">Serial</Label>
              <Input
                id="serial-number"
                value={formState.serialNumber}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, serialNumber: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="acquisition-date">Data de aquisicao</Label>
              <Input
                id="acquisition-date"
                type="date"
                value={formState.acquisitionDate}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, acquisitionDate: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <Label htmlFor="acquisition-cost">Custo de aquisicao</Label>
              <Input
                id="acquisition-cost"
                type="number"
                step="0.01"
                value={formState.acquisitionCost}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, acquisitionCost: event.target.value }))
                }
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
              <input
                type="checkbox"
                checked={formState.isActive}
                onChange={(event) => setFormState((current) => ({ ...current, isActive: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Item ativo
            </label>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-4 py-4 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? 'Salvando...' : mode === 'create' ? 'Criar item' : 'Salvar item'}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
);

const ManageInventory = () => {
  const { inventoryId: inventoryIdParam } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, hasModuleAccess, refreshProfile } = useAuth();

  const [inventories, setInventories] = useState([]);
  const [availableOrgUnits, setAvailableOrgUnits] = useState([]);
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loadingInventories, setLoadingInventories] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingItemDetails, setLoadingItemDetails] = useState(false);

  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [inventoryDialogMode, setInventoryDialogMode] = useState('create');
  const [inventoryForm, setInventoryForm] = useState(createEmptyInventoryForm());
  const [editingInventoryId, setEditingInventoryId] = useState(null);
  const [savingInventory, setSavingInventory] = useState(false);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemDialogMode, setItemDialogMode] = useState('create');
  const [itemForm, setItemForm] = useState(createEmptyItemForm());
  const [editingItemId, setEditingItemId] = useState(null);
  const [savingItem, setSavingItem] = useState(false);
  const [itemPhotoInputKey, setItemPhotoInputKey] = useState(0);

  const [savingMovement, setSavingMovement] = useState(false);
  const [movementForm, setMovementForm] = useState(createEmptyMovementForm());

  const [savingAttachment, setSavingAttachment] = useState(false);
  const [attachmentForm, setAttachmentForm] = useState(createEmptyAttachmentForm());
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);

  const [inventorySearch, setInventorySearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState('all');
  const [itemStatusFilter, setItemStatusFilter] = useState('all');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('all');
  const [attachmentKindFilter, setAttachmentKindFilter] = useState('all');

  const [selectedInventoryId, setSelectedInventoryId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [activeInventoryAccess, setActiveInventoryAccess] = useState({
    loading: false,
    write: null,
    admin: null,
  });

  const canWriteInventory = hasModuleAccess('inventory', 'write');
  const canAdminInventory = hasModuleAccess('inventory', 'admin');
  const isDedicatedInventoryView = Boolean(inventoryIdParam);

  const activeInventory = useMemo(
    () => inventories.find((inventory) => inventory.id === selectedInventoryId) || null,
    [inventories, selectedInventoryId]
  );

  const activeItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) || null,
    [items, selectedItemId]
  );

  const coverPhotoAttachment = useMemo(
    () => attachments.find((attachment) => attachment.is_cover) || attachments[0] || null,
    [attachments]
  );

  const activeItemsCount = useMemo(() => items.filter((item) => item.is_active).length, [items]);

  const filteredInventories = useMemo(() => {
    const query = normalizeSearch(inventorySearch);
    if (!query) return inventories;

    return inventories.filter((inventory) =>
      [inventory.name, inventory.slug, inventory.description, inventory.orgUnit?.name, inventory.orgUnit?.type]
        .filter(Boolean)
        .some((value) => normalizeSearch(value).includes(query))
    );
  }, [inventories, inventorySearch]);

  const filteredItems = useMemo(() => {
    const query = normalizeSearch(itemSearch);

    return items.filter((item) => {
      const matchesQuery =
        !query ||
        [
          item.name,
          item.sku,
          item.description,
          item.location_text,
          item.brand,
          item.model,
          item.serial_number,
        ]
          .filter(Boolean)
          .some((value) => normalizeSearch(value).includes(query));

      const matchesType = itemTypeFilter === 'all' || item.item_type === itemTypeFilter;
      const matchesStatus =
        itemStatusFilter === 'all' ||
        (itemStatusFilter === 'active' && item.is_active) ||
        (itemStatusFilter === 'inactive' && !item.is_active);

      return matchesQuery && matchesType && matchesStatus;
    });
  }, [itemSearch, itemStatusFilter, itemTypeFilter, items]);

  const filteredMovements = useMemo(() => {
    const query = normalizeSearch(movementSearch);

    return movements.filter((movement) => {
      const matchesType = movementTypeFilter === 'all' || movement.movement_type === movementTypeFilter;
      const matchesQuery =
        !query ||
        [
          movement.movement_type,
          movement.reference_type,
          movement.reference_code,
          movement.notes,
          buildMovementReferenceSummary(movement),
        ]
          .filter(Boolean)
          .some((value) => normalizeSearch(value).includes(query));

      return matchesType && matchesQuery;
    });
  }, [movementSearch, movementTypeFilter, movements]);

  const filteredAttachments = useMemo(() => {
    return attachments.filter(
      (attachment) => attachmentKindFilter === 'all' || attachment.kind === attachmentKindFilter
    );
  }, [attachmentKindFilter, attachments]);

  const groupedAttachments = useMemo(() => {
    return filteredAttachments.reduce((accumulator, attachment) => {
      const key = attachment.kind || 'other';
      const currentGroup = accumulator[key] || [];
      currentGroup.push(attachment);
      accumulator[key] = currentGroup;
      return accumulator;
    }, {});
  }, [filteredAttachments]);

  const canWriteActiveInventory = Boolean(
    activeInventory &&
      (typeof activeInventoryAccess.write === 'boolean'
        ? activeInventoryAccess.write
        : user?.role === 'admin' || canWriteInventory)
  );

  const canAdminActiveInventory = Boolean(
    activeInventory &&
      (typeof activeInventoryAccess.admin === 'boolean'
        ? activeInventoryAccess.admin
        : user?.role === 'admin' || canAdminInventory)
  );

  const loadActiveInventoryAccess = async (inventoryId) => {
    if (!inventoryId || !isSupabaseReady) {
      setActiveInventoryAccess({ loading: false, write: null, admin: null });
      return;
    }

    setActiveInventoryAccess((current) => ({ ...current, loading: true }));

    try {
      const [writeResponse, adminResponse] = await Promise.all([
        supabase.rpc('inventory_can_access_inventory', {
          target_inventory_id: inventoryId,
          permission: 'write',
        }),
        supabase.rpc('inventory_can_access_inventory', {
          target_inventory_id: inventoryId,
          permission: 'admin',
        }),
      ]);

      if (writeResponse.error) throw writeResponse.error;
      if (adminResponse.error) throw adminResponse.error;

      setActiveInventoryAccess({
        loading: false,
        write: Boolean(writeResponse.data),
        admin: Boolean(adminResponse.data),
      });
    } catch (error) {
      console.error('Falha ao carregar acesso do inventario', { inventoryId, error });
      setActiveInventoryAccess({
        loading: false,
        write: user?.role === 'admin' || canWriteInventory,
        admin: user?.role === 'admin' || canAdminInventory,
      });
    }
  };

  const checkOrgUnitPermission = async (orgUnitId, permission) => {
    const { data, error } = await supabase.rpc('inventory_can_access_org_unit', {
      target_org_unit_id: orgUnitId,
      permission,
    });

    if (error) throw error;
    return Boolean(data);
  };

  const checkInventoryPermission = async (inventoryId, permission) => {
    const { data, error } = await supabase.rpc('inventory_can_access_inventory', {
      target_inventory_id: inventoryId,
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

  const buildUnexpectedWritePolicyMessage = (resourceLabel, error, context = {}) => {
    console.error('Inventory write denied despite local permissions', {
      resourceLabel,
      localUserId: user?.id || null,
      localUserEmail: user?.email || null,
      selectedInventoryId,
      activeInventoryId: activeInventory?.id || null,
      context,
      error,
    });

    return `O banco negou a gravacao de ${resourceLabel} embora a tela indique permissao de escrita. Isso normalmente aponta sessao divergente no navegador. Saia e entre novamente. Se persistir, publique o frontend mais recente e recarregue sem cache.`;
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
        .eq('module_key', 'inventory')
        .eq('is_enabled', true);

      if (enabledSettingsError) throw enabledSettingsError;

      const enabledOrgUnitIds = new Set((enabledSettings || []).map((row) => row.org_unit_id));

      return (user?.orgUnits || [])
        .map((link) => link.orgUnit)
        .filter((orgUnit) => orgUnit && enabledOrgUnitIds.has(orgUnit.id))
        .sort((a, b) => `${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`, 'pt-BR'));
    }

    return (user?.orgUnits || [])
      .map((link) => link.orgUnit)
      .filter(Boolean)
      .sort((a, b) => `${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`, 'pt-BR'));
  };

  const loadInventories = async () => {
    if (!isSupabaseReady || !user) return;

    setLoadingInventories(true);
    try {
      const [inventoriesResponse, orgUnitsResponse] = await Promise.all([
        supabase
          .from('inventories')
          .select(
            `
              id,
              org_unit_id,
              slug,
              name,
              description,
              inventory_type,
              manager_profile_id,
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
          .order('name', { ascending: true }),
        loadAvailableOrgUnits(),
      ]);

      if (inventoriesResponse.error) throw inventoriesResponse.error;

      setInventories((inventoriesResponse.data || []).map(normalizeInventoryRow));
      setAvailableOrgUnits(orgUnitsResponse);
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatInventoryError(error, 'Nao foi possivel carregar os inventarios.'),
        variant: 'destructive',
      });
    } finally {
      setLoadingInventories(false);
    }
  };

  const loadItems = async (inventoryId) => {
    if (!inventoryId || !isSupabaseReady) {
      setItems([]);
      return;
    }

    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('inventory_id', inventoryId)
        .order('name', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatInventoryError(error, 'Nao foi possivel carregar os itens do inventario.'),
        variant: 'destructive',
      });
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const loadItemImageAttachments = async (itemId) => {
    const { data, error } = await supabase
      .from('inventory_item_attachments')
      .select('*')
      .eq('inventory_item_id', itemId)
      .eq('kind', 'image')
      .order('is_cover', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return Promise.all(
      (data || []).map(async (attachment) => {
        try {
          const signedUrl = await getInventorySignedUrl(attachment.bucket_path);
          return { ...attachment, signedUrl };
        } catch {
          return { ...attachment, signedUrl: null };
        }
      })
    );
  };

  const removeItemImageAttachments = async (imageAttachments = []) => {
    if (!imageAttachments.length) return;

    const { error } = await supabase
      .from('inventory_item_attachments')
      .delete()
      .in(
        'id',
        imageAttachments.map((attachment) => attachment.id)
      );

    if (error) throw error;

    await Promise.allSettled(
      imageAttachments
        .map((attachment) => attachment.bucket_path)
        .filter(Boolean)
        .map((bucketPath) => removeInventoryStorageObject(bucketPath))
    );
  };

  const syncItemPhoto = async (itemId, photoFile, removePhoto) => {
    const existingImages = await loadItemImageAttachments(itemId);
    const shouldRemoveExistingImages = removePhoto || Boolean(photoFile);

    let uploadedPath = null;

    try {
      if (photoFile) {
        uploadedPath = await uploadInventoryAttachmentFile({
          inventoryItemId: itemId,
          file: photoFile,
        });
      }

      if (shouldRemoveExistingImages) {
        await removeItemImageAttachments(existingImages);
      }

      if (photoFile && uploadedPath) {
        const { error } = await supabase.from('inventory_item_attachments').insert({
          inventory_item_id: itemId,
          bucket_id: 'inventory-media',
          bucket_path: uploadedPath,
          file_name: photoFile.name,
          mime_type: photoFile.type || null,
          file_size_bytes: photoFile.size || null,
          kind: 'image',
          caption: null,
          is_cover: true,
        });

        if (error) throw error;
      }
    } catch (error) {
      if (uploadedPath) {
        await Promise.allSettled([removeInventoryStorageObject(uploadedPath)]);
      }
      throw error;
    }
  };

  const loadItemDetails = async (itemId) => {
    if (!itemId || !isSupabaseReady) {
      setMovements([]);
      setAttachments([]);
      return;
    }

    setLoadingItemDetails(true);
    try {
      const imageAttachments = await loadItemImageAttachments(itemId);
      setMovements([]);
      setAttachments(imageAttachments);
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatInventoryError(error, 'Nao foi possivel carregar a foto do item.'),
        variant: 'destructive',
      });
      setMovements([]);
      setAttachments([]);
    } finally {
      setLoadingItemDetails(false);
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
        description: 'Supabase nao configurado para o modulo de inventario.',
        variant: 'destructive',
      });
      return;
    }

    void loadInventories();
  }, [navigate, toast, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loadingInventories) return;

    if (inventoryIdParam) {
      const inventoryExists = inventories.some((inventory) => inventory.id === inventoryIdParam);
      if (inventoryExists) {
        setSelectedInventoryId(inventoryIdParam);
        return;
      }

      if (inventories.length > 0) {
        navigate(`/dashboard/inventory/${inventories[0].id}`, { replace: true });
      } else {
        setSelectedInventoryId(null);
      }
      return;
    }

    if (selectedInventoryId && inventories.some((inventory) => inventory.id === selectedInventoryId)) {
      return;
    }

    if (inventories.length > 0) {
      setSelectedInventoryId(inventories[0].id);
    } else {
      setSelectedInventoryId(null);
    }
  }, [inventoryIdParam, inventories, loadingInventories, navigate, selectedInventoryId]);

  useEffect(() => {
    if (!selectedInventoryId) {
      setItems([]);
      setSelectedItemId(null);
      setActiveInventoryAccess({ loading: false, write: null, admin: null });
      return;
    }

    void loadActiveInventoryAccess(selectedInventoryId);
    void loadItems(selectedInventoryId);
  }, [selectedInventoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!items.length) {
      setSelectedItemId(null);
      return;
    }

    if (selectedItemId && items.some((item) => item.id === selectedItemId)) {
      return;
    }

    setSelectedItemId(items[0].id);
  }, [items, selectedItemId]);

  useEffect(() => {
    if (!filteredItems.length) return;

    if (selectedItemId && filteredItems.some((item) => item.id === selectedItemId)) {
      return;
    }

    setSelectedItemId(filteredItems[0].id);
  }, [filteredItems, selectedItemId]);

  useEffect(() => {
    if (!selectedItemId) {
      setMovements([]);
      setAttachments([]);
      return;
    }

    void loadItemDetails(selectedItemId);
  }, [selectedItemId]);

  const openCreateInventoryDialog = () => {
    setInventoryDialogMode('create');
    setEditingInventoryId(null);
    setInventoryForm(createEmptyInventoryForm(availableOrgUnits[0]?.id || ''));
    setInventoryDialogOpen(true);
  };

  const openEditInventoryDialog = (inventory) => {
    setInventoryDialogMode('edit');
    setEditingInventoryId(inventory.id);
    setInventoryForm({
      orgUnitId: inventory.org_unit_id,
      name: inventory.name || '',
      slug: inventory.slug || '',
      description: inventory.description || '',
      inventoryType: inventory.inventory_type || 'mixed',
      isActive: Boolean(inventory.is_active),
    });
    setInventoryDialogOpen(true);
  };

  const saveInventory = async () => {
    if (!inventoryForm.orgUnitId || !inventoryForm.name.trim()) {
      toast({
        title: 'Erro',
        description: 'Informe a unidade e o nome do inventario.',
        variant: 'destructive',
      });
      return;
    }

    setSavingInventory(true);
    try {
      await ensureSupabaseWriteSession();
      const canWriteOrgUnit = await checkOrgUnitPermission(inventoryForm.orgUnitId, 'write');
      if (!canWriteOrgUnit) {
        throw new Error(
          'Seu perfil autenticado nao possui permissao de escrita nesta unidade para o modulo de inventario.'
        );
      }

      const payload = {
        org_unit_id: inventoryForm.orgUnitId,
        name: inventoryForm.name.trim(),
        slug: trimOrNull(inventoryForm.slug),
        description: trimOrNull(inventoryForm.description),
        inventory_type: inventoryForm.inventoryType,
        is_active: Boolean(inventoryForm.isActive),
      };

      let savedInventoryId = editingInventoryId;

      if (inventoryDialogMode === 'create') {
        const { error } = await supabase.from('inventories').insert(payload);
        if (error) throw error;
        const { data, error: lookupError } = await supabase
          .from('inventories')
          .select('id')
          .eq('org_unit_id', payload.org_unit_id)
          .eq('name', payload.name)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lookupError) throw lookupError;
        savedInventoryId = data?.id || null;
      } else {
        const { error } = await supabase.from('inventories').update(payload).eq('id', editingInventoryId);
        if (error) throw error;
      }

      await loadInventories();
      setInventoryDialogOpen(false);

      if (savedInventoryId) {
        setSelectedInventoryId(savedInventoryId);
        if (isDedicatedInventoryView) {
          navigate(`/dashboard/inventory/${savedInventoryId}`);
        }
      }

      toast({
        title: 'Sucesso!',
        description: `Inventario ${inventoryDialogMode === 'create' ? 'criado' : 'atualizado'}.`,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: isInventoryWritePolicyError(error)
          ? buildUnexpectedWritePolicyMessage('inventarios', error, {
              inventoryDialogMode,
              orgUnitId: inventoryForm.orgUnitId,
            })
          : formatInventoryError(error, 'Nao foi possivel salvar o inventario.'),
        variant: 'destructive',
      });
    } finally {
      setSavingInventory(false);
    }
  };

  const deleteInventory = async (inventory) => {
    if (!window.confirm(`Excluir o inventario "${inventory.name}"?`)) {
      return;
    }

    try {
      await ensureSupabaseWriteSession();

      const { error } = await supabase.from('inventories').delete().eq('id', inventory.id);
      if (error) throw error;

      await loadInventories();

      if (selectedInventoryId === inventory.id) {
        setSelectedInventoryId(null);
        navigate('/dashboard/inventory');
      }

      toast({ title: 'Sucesso!', description: 'Inventario excluido.' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: isInventoryWritePolicyError(error)
          ? buildUnexpectedWritePolicyMessage('inventarios', error, {
              inventoryId: inventory.id,
            })
          : formatInventoryError(
              error,
              'Nao foi possivel excluir o inventario. Se houver itens vinculados, remova-os antes.'
            ),
        variant: 'destructive',
      });
    }
  };

  const openCreateItemDialog = () => {
    if (!canWriteActiveInventory) {
      toast({
        title: 'Erro',
        description:
          'Voce nao tem permissao de escrita neste inventario. Verifique o vinculo com a unidade e a habilitacao do modulo inventory.',
        variant: 'destructive',
      });
      return;
    }

    setItemDialogMode('create');
    setEditingItemId(null);
    setItemForm(createEmptyItemForm());
    setItemPhotoInputKey((current) => current + 1);
    setItemDialogOpen(true);
  };

  const openEditItemDialog = async (item) => {
    setItemDialogMode('edit');
    setEditingItemId(item.id);
    setSelectedItemId(item.id);
    setItemForm({
      sku: item.sku || '',
      name: item.name || '',
      description: item.description || '',
      itemType: item.item_type || 'consumable',
      trackingMode: item.tracking_mode || 'quantity',
      unitLabel: item.unit_label || 'un',
      currentQuantity: String(item.current_quantity ?? 0),
      minimumQuantity: String(item.minimum_quantity ?? 0),
      idealQuantity: item.ideal_quantity ?? '',
      locationText: item.location_text || '',
      brand: item.brand || '',
      model: item.model || '',
      serialNumber: item.serial_number || '',
      conditionStatus: item.condition_status || 'good',
      acquisitionDate: item.acquisition_date || '',
      acquisitionCost: item.acquisition_cost ?? '',
      isActive: Boolean(item.is_active),
      photoFile: null,
      photoPreviewUrl: '',
      removePhoto: false,
    });
    setItemPhotoInputKey((current) => current + 1);
    setItemDialogOpen(true);

    try {
      const imageAttachments = await loadItemImageAttachments(item.id);
      const coverPhoto = imageAttachments.find((attachment) => attachment.is_cover) || imageAttachments[0] || null;

      setItemForm((current) => ({
        ...current,
        photoPreviewUrl: coverPhoto?.signedUrl || '',
      }));
    } catch {
      // keep form available even if photo loading fails
    }
  };

  const saveItem = async () => {
    if (!selectedInventoryId || !itemForm.name.trim()) {
      toast({
        title: 'Erro',
        description: 'Informe ao menos o nome do item.',
        variant: 'destructive',
      });
      return;
    }

    if (!canWriteActiveInventory) {
      toast({
        title: 'Erro',
        description:
          'Seu usuario nao pode gravar itens neste inventario. Verifique se o modulo inventory esta habilitado para a unidade e se voce tem permissao de escrita nela.',
        variant: 'destructive',
      });
      return;
    }

    setSavingItem(true);
    try {
      await ensureSupabaseWriteSession();
      const canWriteInventoryNow = await checkInventoryPermission(selectedInventoryId, 'write');
      if (!canWriteInventoryNow) {
        throw new Error(
          'Seu perfil autenticado nao possui permissao de escrita neste inventario. Atualize a sessao e confira os acessos do modulo.'
        );
      }

      const payload = {
        inventory_id: selectedInventoryId,
        sku: trimOrNull(itemForm.sku),
        name: itemForm.name.trim(),
        description: trimOrNull(itemForm.description),
        item_type: itemForm.itemType,
        tracking_mode: 'quantity',
        unit_label: trimOrNull(itemForm.unitLabel) || 'un',
        current_quantity: parseNumberOrZero(itemForm.currentQuantity),
        minimum_quantity: parseNumberOrZero(itemForm.minimumQuantity),
        ideal_quantity: parseNumberOrNull(itemForm.idealQuantity),
        location_text: trimOrNull(itemForm.locationText),
        brand: trimOrNull(itemForm.brand),
        model: trimOrNull(itemForm.model),
        serial_number: trimOrNull(itemForm.serialNumber),
        condition_status: itemForm.conditionStatus,
        acquisition_date: trimOrNull(itemForm.acquisitionDate),
        acquisition_cost: parseNumberOrNull(itemForm.acquisitionCost),
        is_active: Boolean(itemForm.isActive),
      };

      let savedItemId = editingItemId;

      if (itemDialogMode === 'create') {
        const { error } = await supabase.from('inventory_items').insert(payload);
        if (error) throw error;
        const { data, error: lookupError } = await supabase
          .from('inventory_items')
          .select('id')
          .eq('inventory_id', selectedInventoryId)
          .eq('name', payload.name)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lookupError) throw lookupError;
        savedItemId = data?.id || null;
      } else {
        const { error } = await supabase.from('inventory_items').update(payload).eq('id', editingItemId);
        if (error) throw error;
      }

      if (savedItemId && (itemForm.photoFile || itemForm.removePhoto)) {
        await syncItemPhoto(savedItemId, itemForm.photoFile, itemForm.removePhoto);
      }

      await loadItems(selectedInventoryId);
      if (savedItemId) {
        await loadItemDetails(savedItemId);
      }
      setItemDialogOpen(false);
      setItemPhotoInputKey((current) => current + 1);

      if (savedItemId) {
        setSelectedItemId(savedItemId);
      }

      toast({
        title: 'Sucesso!',
        description: `Item ${itemDialogMode === 'create' ? 'criado' : 'atualizado'}.`,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: isInventoryWritePolicyError(error)
          ? buildUnexpectedWritePolicyMessage('itens', error, {
              itemDialogMode,
              inventoryId: selectedInventoryId,
              editingItemId,
            })
          : formatInventoryError(error, 'Nao foi possivel salvar o item.'),
        variant: 'destructive',
      });
    } finally {
      setSavingItem(false);
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Excluir o item "${item.name}"?`)) {
      return;
    }

    try {
      await ensureSupabaseWriteSession();

      const { error } = await supabase.from('inventory_items').delete().eq('id', item.id);
      if (error) throw error;

      await loadItems(selectedInventoryId);

      if (selectedItemId === item.id) {
        setSelectedItemId(null);
      }

      toast({ title: 'Sucesso!', description: 'Item excluido.' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: isInventoryWritePolicyError(error)
          ? buildUnexpectedWritePolicyMessage('itens', error, {
              itemId: item.id,
            })
          : formatInventoryError(
              error,
              'Nao foi possivel excluir o item. Se houver historico de movimentacoes, o item deve permanecer.'
            ),
        variant: 'destructive',
      });
    }
  };

  const submitMovement = async () => {
    if (!activeItem) return;

    const quantityDelta = buildMovementDelta(movementForm.movementType, movementForm.quantity);
    if (!quantityDelta) {
      toast({
        title: 'Erro',
        description: 'Informe uma quantidade valida para a movimentacao.',
        variant: 'destructive',
      });
      return;
    }

    setSavingMovement(true);
    try {
      await ensureSupabaseWriteSession();
      const canWriteInventoryNow = await checkInventoryPermission(selectedInventoryId, 'write');
      if (!canWriteInventoryNow) {
        throw new Error(
          'Seu perfil autenticado nao possui permissao de escrita neste inventario. Atualize a sessao e confira os acessos do modulo.'
        );
      }

      const { error } = await supabase.from('inventory_movements').insert({
        inventory_item_id: activeItem.id,
        movement_type: movementForm.movementType,
        quantity_delta: quantityDelta,
        reference_type: trimOrNull(movementForm.referenceType),
        reference_code: trimOrNull(movementForm.referenceCode),
        notes: trimOrNull(movementForm.notes),
        occurred_at: movementForm.occurredAt ? new Date(movementForm.occurredAt).toISOString() : null,
      });

      if (error) throw error;

      await Promise.all([loadItems(selectedInventoryId), loadItemDetails(activeItem.id)]);
      setMovementForm(createEmptyMovementForm());
      toast({ title: 'Sucesso!', description: 'Movimentacao registrada.' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: isInventoryWritePolicyError(error)
          ? buildUnexpectedWritePolicyMessage('movimentacoes', error, {
              inventoryItemId: activeItem.id,
            })
          : formatInventoryError(error, 'Nao foi possivel registrar a movimentacao.'),
        variant: 'destructive',
      });
    } finally {
      setSavingMovement(false);
    }
  };

  const clearExistingCoverIfNeeded = async (shouldSetCover) => {
    if (!shouldSetCover || !activeItem) return;

    const { error } = await supabase
      .from('inventory_item_attachments')
      .update({ is_cover: false })
      .eq('inventory_item_id', activeItem.id)
      .eq('is_cover', true);

    if (error) throw error;
  };

  const submitAttachment = async () => {
    if (!activeItem || !attachmentForm.file) {
      toast({
        title: 'Erro',
        description: 'Selecione um arquivo antes de enviar o anexo.',
        variant: 'destructive',
      });
      return;
    }

    setSavingAttachment(true);
    let uploadedPath = null;

    try {
      await ensureSupabaseWriteSession();
      const canWriteInventoryNow = await checkInventoryPermission(selectedInventoryId, 'write');
      if (!canWriteInventoryNow) {
        throw new Error(
          'Seu perfil autenticado nao possui permissao de escrita neste inventario. Atualize a sessao e confira os acessos do modulo.'
        );
      }

      const shouldSetCover = attachmentForm.isCover || attachments.length === 0;
      await clearExistingCoverIfNeeded(shouldSetCover);

      uploadedPath = await uploadInventoryAttachmentFile({
        inventoryItemId: activeItem.id,
        file: attachmentForm.file,
      });

      const { error } = await supabase.from('inventory_item_attachments').insert({
        inventory_item_id: activeItem.id,
        bucket_id: 'inventory-media',
        bucket_path: uploadedPath,
        file_name: attachmentForm.file.name,
        mime_type: attachmentForm.file.type || null,
        file_size_bytes: attachmentForm.file.size || null,
        kind: attachmentForm.kind,
        caption: trimOrNull(attachmentForm.caption),
        is_cover: shouldSetCover,
      });

      if (error) throw error;

      await loadItemDetails(activeItem.id);
      setAttachmentForm(createEmptyAttachmentForm());
      setAttachmentInputKey((current) => current + 1);
      toast({ title: 'Sucesso!', description: 'Anexo enviado.' });
    } catch (error) {
      if (uploadedPath) {
        try {
          await removeInventoryStorageObject(uploadedPath);
        } catch {
          // keep original error
        }
      }

      toast({
        title: 'Erro',
        description: isInventoryWritePolicyError(error)
          ? buildUnexpectedWritePolicyMessage('anexos', error, {
              inventoryItemId: activeItem.id,
              uploadedPath,
            })
          : formatInventoryError(error, 'Nao foi possivel enviar o anexo.'),
        variant: 'destructive',
      });
    } finally {
      setSavingAttachment(false);
    }
  };

  const setAttachmentAsCover = async (attachment) => {
    if (!activeItem) return;

    try {
      await ensureSupabaseWriteSession();

      await clearExistingCoverIfNeeded(true);

      const { error } = await supabase
        .from('inventory_item_attachments')
        .update({ is_cover: true })
        .eq('id', attachment.id);

      if (error) throw error;

      await loadItemDetails(activeItem.id);
      toast({ title: 'Sucesso!', description: 'Capa do item atualizada.' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: isInventoryWritePolicyError(error)
          ? buildUnexpectedWritePolicyMessage('anexos', error, {
              attachmentId: attachment.id,
            })
          : formatInventoryError(error, 'Nao foi possivel atualizar a capa do item.'),
        variant: 'destructive',
      });
    }
  };

  const deleteAttachment = async (attachment) => {
    if (!window.confirm(`Remover o anexo "${attachment.file_name}"?`)) {
      return;
    }

    try {
      await ensureSupabaseWriteSession();

      const { error } = await supabase.from('inventory_item_attachments').delete().eq('id', attachment.id);
      if (error) throw error;

      try {
        await removeInventoryStorageObject(attachment.bucket_path);
      } catch {
        toast({
          title: 'Aviso',
          description: 'O registro foi removido, mas nao foi possivel excluir o arquivo do Storage.',
        });
      }

      await loadItemDetails(activeItem.id);
      toast({ title: 'Sucesso!', description: 'Anexo removido.' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: isInventoryWritePolicyError(error)
          ? buildUnexpectedWritePolicyMessage('anexos', error, {
              attachmentId: attachment.id,
            })
          : formatInventoryError(error, 'Nao foi possivel remover o anexo.'),
        variant: 'destructive',
      });
    }
  };

  const downloadAttachment = async (attachment) => {
    try {
      const signedUrl = attachment.signedUrl || (await getInventorySignedUrl(attachment.bucket_path));
      triggerBrowserDownload(
        signedUrl,
        buildAttachmentDownloadName(attachment, activeItem, activeInventory)
      );
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatInventoryError(error, 'Nao foi possivel gerar o download do anexo.'),
        variant: 'destructive',
      });
    }
  };

  const downloadAttachmentGroup = async (attachmentGroup = []) => {
    for (const attachment of attachmentGroup) {
      await downloadAttachment(attachment);
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
  };

  const handleInventorySelection = (inventoryId) => {
    setSelectedInventoryId(inventoryId);
    if (isDedicatedInventoryView) {
      navigate(`/dashboard/inventory/${inventoryId}`);
    }
  };

  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>Inventario - Paroquia de Nossa Senhora da Conceicao</title>
        <meta
          name="description"
          content="Lista de itens por unidade institucional, com quantidade manual e foto de identificacao."
        />
      </Helmet>

      <InventoryFormDialog
        open={inventoryDialogOpen}
        onOpenChange={setInventoryDialogOpen}
        mode={inventoryDialogMode}
        formState={inventoryForm}
        setFormState={setInventoryForm}
        onSubmit={saveInventory}
        availableOrgUnits={availableOrgUnits}
        saving={savingInventory}
      />

      <ItemFormDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        mode={itemDialogMode}
        formState={itemForm}
        setFormState={setItemForm}
        photoInputKey={itemPhotoInputKey}
        onSubmit={saveItem}
        saving={savingItem}
      />

      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 py-14 text-white">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-slate-100">
              <Boxes className="h-4 w-4" />
              Operacoes internas
            </div>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Inventario</h1>
                <p className="mt-3 max-w-3xl text-base text-slate-200 md:text-lg">
                  Lista de itens por unidade, com quantidade manual e foto para identificacao visual.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => void loadInventories()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
                {canWriteInventory ? (
                  <Button onClick={openCreateInventoryDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo inventario
                  </Button>
                ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <section className="bg-slate-50 py-10">
        <div className="container mx-auto px-4">
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-slate-500">Inventarios visiveis</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{inventories.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-slate-500">Itens no inventario selecionado</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{items.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-slate-500">Itens ativos</div>
              <div className="mt-2 text-3xl font-bold text-emerald-600">{activeItemsCount}</div>
            </div>
          </div>

          {isDedicatedInventoryView && activeInventory ? (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                    Modo dedicado do inventario
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">
                    {activeInventory.name} · {activeInventory.orgUnit?.name || 'Unidade'}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Use esta rota para trabalhar diretamente em um inventario especifico sem depender da lista geral.
                  </p>
                </div>
                <Button variant="outline" onClick={() => navigate('/dashboard/inventory')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para todos os inventarios
                </Button>
              </div>
            </div>
          ) : null}

          <div className={`grid gap-6 ${isDedicatedInventoryView ? '' : 'xl:grid-cols-[340px_minmax(0,1fr)]'}`}>
            {!isDedicatedInventoryView ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">Inventarios</h2>
                  <p className="text-sm text-slate-500">Selecione a unidade que deseja operar.</p>
                </div>

                <div className="mb-4">
                  <Input
                    value={inventorySearch}
                    onChange={(event) => setInventorySearch(event.target.value)}
                    placeholder="Buscar por inventario, unidade ou slug"
                  />
                </div>

                {loadingInventories ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                    Carregando inventarios...
                  </div>
                ) : inventories.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                    Nenhum inventario disponivel. Crie o primeiro quando o modulo estiver habilitado para a unidade.
                  </div>
                ) : filteredInventories.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                    Nenhum inventario encontrado para o filtro informado.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredInventories.map((inventory) => {
                      const isActive = inventory.id === selectedInventoryId;
                      return (
                        <button
                          key={inventory.id}
                          type="button"
                          onClick={() => handleInventorySelection(inventory.id)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            isActive
                              ? 'border-blue-300 bg-blue-50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">{inventory.name}</div>
                              <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                                {orgUnitTypeLabels[inventory.orgUnit?.type] || inventory.orgUnit?.type} ·{' '}
                                {inventory.orgUnit?.name || 'Unidade'}
                              </div>
                              {inventory.description ? (
                                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{inventory.description}</p>
                              ) : null}
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                inventory.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {inventory.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                {activeInventory ? (
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                        {orgUnitTypeLabels[activeInventory.orgUnit?.type] || activeInventory.orgUnit?.type}
                      </div>
                      <h2 className="mt-2 text-2xl font-bold text-slate-900">{activeInventory.name}</h2>
                      <p className="mt-2 text-sm text-slate-600">
                        {activeInventory.description || 'Sem descricao cadastrada.'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1">Slug: {activeInventory.slug}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Tipo:{' '}
                          {inventoryTypeOptions.find((option) => option.value === activeInventory.inventory_type)?.label ||
                            activeInventory.inventory_type}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Unidade: {activeInventory.orgUnit?.name || '-'}
                        </span>
                      </div>
                    </div>

                    {(canWriteActiveInventory || canAdminActiveInventory) && (
                      <div className="flex flex-wrap gap-2">
                        {!isDedicatedInventoryView ? (
                          <Button variant="outline" onClick={() => navigate(`/dashboard/inventory/${activeInventory.id}`)}>
                            Foco neste inventario
                          </Button>
                        ) : null}
                        {canWriteActiveInventory ? (
                          <Button variant="outline" onClick={() => openEditInventoryDialog(activeInventory)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                        ) : null}
                        {canAdminActiveInventory ? (
                          <Button variant="destructive" onClick={() => void deleteInventory(activeInventory)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                    Selecione um inventario para gerenciar os itens.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Itens</h3>
                    <p className="text-sm text-slate-500">
                      Cadastro simples de itens do grupo, com quantidade e foto de identificacao.
                    </p>
                  </div>
                  {activeInventory && canWriteActiveInventory ? (
                    <Button onClick={openCreateItemDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      Novo item
                    </Button>
                  ) : null}
                </div>

                {activeInventory ? (
                  <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Filter className="h-4 w-4" />
                      Filtros e busca
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Input
                        value={itemSearch}
                        onChange={(event) => setItemSearch(event.target.value)}
                        placeholder="Buscar item, SKU, localizacao..."
                        className="md:col-span-2"
                      />
                      <select
                        value={itemTypeFilter}
                        onChange={(event) => setItemTypeFilter(event.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="all">Todos os tipos</option>
                        {itemTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={itemStatusFilter}
                        onChange={(event) => setItemStatusFilter(event.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="all">Todos os registros</option>
                        <option value="active">Somente ativos</option>
                        <option value="inactive">Somente inativos</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {!activeInventory ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                    Escolha um inventario para carregar os itens.
                  </div>
                ) : loadingItems ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                    Carregando itens...
                  </div>
                ) : items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                    Nenhum item cadastrado neste inventario.
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                    Nenhum item corresponde aos filtros atuais.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Tipo</th>
                          <th className="px-4 py-3">Quantidade</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3">Localizacao</th>
                          <th className="px-4 py-3 text-right">Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map((item) => {
                          const isSelected = item.id === selectedItemId;

                          return (
                            <tr
                              key={item.id}
                              className={`border-b transition ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                            >
                              <td className="px-4 py-4">
                                <button
                                  type="button"
                                  className="text-left"
                                  onClick={() => setSelectedItemId(item.id)}
                                >
                                  <div className="font-medium text-slate-900">{item.name}</div>
                                  <div className="text-xs text-slate-500">
                                    {item.sku || 'Sem SKU'}
                                    {item.serial_number ? ` · Serial ${item.serial_number}` : ''}
                                  </div>
                                </button>
                              </td>
                              <td className="px-4 py-4 text-slate-600">
                                {itemTypeOptions.find((option) => option.value === item.item_type)?.label || item.item_type}
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-slate-700">{formatQuantity(item.current_quantity, item.unit_label)}</span>
                              </td>
                              <td className="px-4 py-4 text-slate-600">
                                {conditionStatusOptions.find((option) => option.value === item.condition_status)?.label ||
                                  item.condition_status}
                              </td>
                              <td className="px-4 py-4 text-slate-600">{item.location_text || '-'}</td>
                              <td className="px-4 py-4">
                                <div className="flex justify-end gap-2">
                                  {canWriteActiveInventory ? (
                                    <>
                                      <Button variant="outline" size="icon" onClick={() => void openEditItemDialog(item)}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button variant="destructive" size="icon" onClick={() => void deleteItem(item)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <Button variant="outline" size="icon" onClick={() => setSelectedItemId(item.id)}>
                                      <Image className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Resumo do item</h3>
                    <p className="text-sm text-slate-500">
                      {activeItem ? `Detalhes do item ${activeItem.name}.` : 'Selecione um item para ver os detalhes.'}
                    </p>
                  </div>

                  {!activeItem ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                      Selecione um item para visualizar as informacoes principais.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quantidade</div>
                          <div className="mt-2 text-xl font-semibold text-slate-900">
                            {formatQuantity(activeItem.current_quantity, activeItem.unit_label)}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</div>
                          <div className="mt-2 text-base font-semibold text-slate-900">
                            {conditionStatusOptions.find((option) => option.value === activeItem.condition_status)?.label ||
                              activeItem.condition_status}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</div>
                          <div className="mt-2 text-base font-semibold text-slate-900">
                            {itemTypeOptions.find((option) => option.value === activeItem.item_type)?.label ||
                              activeItem.item_type}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Localizacao</div>
                          <div className="mt-2 text-sm text-slate-700">{activeItem.location_text || '-'}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Marca e modelo</div>
                          <div className="mt-2 text-sm text-slate-700">
                            {[activeItem.brand, activeItem.model].filter(Boolean).join(' · ') || '-'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Serial</div>
                          <div className="mt-2 text-sm text-slate-700">{activeItem.serial_number || '-'}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data de aquisicao</div>
                          <div className="mt-2 text-sm text-slate-700">{activeItem.acquisition_date || '-'}</div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descricao</div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {activeItem.description || 'Sem descricao cadastrada.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Foto do item</h3>
                    <p className="text-sm text-slate-500">
                      Uma foto principal para identificacao visual. Edite o item para trocar, adicionar ou remover.
                    </p>
                  </div>

                  {!activeItem ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                      Selecione um item para visualizar a foto.
                    </div>
                  ) : loadingItemDetails ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                      Carregando foto...
                    </div>
                  ) : coverPhotoAttachment?.signedUrl ? (
                    <div className="space-y-4">
                      <img
                        src={coverPhotoAttachment.signedUrl}
                        alt={activeItem.name}
                        className="h-72 w-full rounded-2xl border border-slate-200 object-cover"
                      />
                      <div className="text-xs text-slate-500">{coverPhotoAttachment.file_name || 'Foto do item'}</div>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={coverPhotoAttachment.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Abrir foto
                        </a>
                        {canWriteActiveInventory ? (
                          <Button variant="outline" onClick={() => void openEditItemDialog(activeItem)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Trocar foto
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex h-72 w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
                        <div className="flex flex-col items-center gap-3 text-center">
                          <Image className="h-8 w-8" />
                          <div className="text-sm">Nenhuma foto cadastrada para este item.</div>
                        </div>
                      </div>
                      {canWriteActiveInventory ? (
                        <Button variant="outline" onClick={() => void openEditItemDialog(activeItem)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Adicionar foto
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {false ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Movimentacoes</h3>
                    <p className="text-sm text-slate-500">
                      {activeItem ? `Historico do item ${activeItem.name}.` : 'Selecione um item para registrar movimentacoes.'}
                    </p>
                  </div>

                  {activeItem ? (
                    <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Filter className="h-4 w-4" />
                        Busca do historico
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Input
                          value={movementSearch}
                          onChange={(event) => setMovementSearch(event.target.value)}
                          placeholder="Buscar por referencia, nota ou observacao"
                          className="md:col-span-2"
                        />
                        <select
                          value={movementTypeFilter}
                          onChange={(event) => setMovementTypeFilter(event.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="all">Todos os tipos</option>
                          {movementTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : null}

                  {activeItem && canWriteActiveInventory ? (
                    <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="movement-type">Tipo</Label>
                          <select
                            id="movement-type"
                            value={movementForm.movementType}
                            onChange={(event) =>
                              setMovementForm((current) => ({ ...current, movementType: event.target.value }))
                            }
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            {movementTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="movement-quantity">Quantidade</Label>
                          <Input
                            id="movement-quantity"
                            type="number"
                            step="0.001"
                            value={movementForm.quantity}
                            onChange={(event) =>
                              setMovementForm((current) => ({ ...current, quantity: event.target.value }))
                            }
                          />
                          <p className="text-xs text-slate-500">{movementHelpText(movementForm.movementType)}</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="movement-reference-type">Tipo de referencia</Label>
                          <Input
                            id="movement-reference-type"
                            list="movement-reference-types"
                            value={movementForm.referenceType}
                            onChange={(event) =>
                              setMovementForm((current) => ({ ...current, referenceType: event.target.value }))
                            }
                            placeholder="Ex.: compra, emprestimo, inventario"
                          />
                          <datalist id="movement-reference-types">
                            {movementReferenceSuggestions.map((option) => (
                              <option key={option} value={option} />
                            ))}
                          </datalist>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="movement-reference-code">Codigo de referencia</Label>
                          <Input
                            id="movement-reference-code"
                            value={movementForm.referenceCode}
                            onChange={(event) =>
                              setMovementForm((current) => ({ ...current, referenceCode: event.target.value }))
                            }
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="movement-notes">Observacoes</Label>
                          <Textarea
                            id="movement-notes"
                            value={movementForm.notes}
                            onChange={(event) =>
                              setMovementForm((current) => ({ ...current, notes: event.target.value }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="movement-occurred-at">Data e hora</Label>
                          <Input
                            id="movement-occurred-at"
                            type="datetime-local"
                            value={movementForm.occurredAt}
                            onChange={(event) =>
                              setMovementForm((current) => ({ ...current, occurredAt: event.target.value }))
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <Button onClick={() => void submitMovement()} disabled={savingMovement}>
                          {savingMovement ? 'Salvando...' : 'Registrar movimentacao'}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {!activeItem ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                      Selecione um item para ver o historico.
                    </div>
                  ) : loadingItemDetails ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                      Carregando movimentacoes...
                    </div>
                  ) : movements.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                      Nenhuma movimentacao registrada para este item.
                    </div>
                  ) : filteredMovements.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                      Nenhuma movimentacao corresponde aos filtros atuais.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredMovements.map((movement) => (
                        <div key={movement.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-medium text-slate-900">{movementTypeLabel(movement.movement_type)}</div>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                  {movement.quantity_delta > 0 ? 'Credito' : 'Debito'}
                                </span>
                                {buildMovementReferenceSummary(movement) ? (
                                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                    {buildMovementReferenceSummary(movement)}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 text-sm text-slate-600">
                                Delta: {formatQuantity(movement.quantity_delta, activeItem.unit_label)} · Saldo:{' '}
                                {formatQuantity(movement.resulting_quantity, activeItem.unit_label)}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                {movement.reference_type ? (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                    Tipo ref.: {movement.reference_type}
                                  </span>
                                ) : null}
                                {movement.reference_code ? (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                    Codigo: {movement.reference_code}
                                  </span>
                                ) : null}
                              </div>
                              {movement.notes ? <p className="mt-2 text-sm text-slate-600">{movement.notes}</p> : null}
                            </div>
                            <div className="text-xs text-slate-500">{formatDateTime(movement.occurred_at)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Fotos e anexos</h3>
                    <p className="text-sm text-slate-500">
                      Bucket privado com URL assinada. O path sempre comeca pelo ID do item.
                    </p>
                  </div>

                  {activeItem ? (
                    <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Filter className="h-4 w-4" />
                        Organizacao dos anexos
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <select
                          value={attachmentKindFilter}
                          onChange={(event) => setAttachmentKindFilter(event.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="all">Todos os tipos</option>
                          {attachmentKindOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center text-sm text-slate-500">
                          {filteredAttachments.length} anexo(s) visivel(is) para o item selecionado.
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeItem && canWriteActiveInventory ? (
                    <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="attachment-file">Arquivo</Label>
                          <Input
                            key={attachmentInputKey}
                            id="attachment-file"
                            type="file"
                            onChange={(event) =>
                              setAttachmentForm((current) => ({
                                ...current,
                                file: event.target.files?.[0] || null,
                              }))
                            }
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="attachment-kind">Tipo</Label>
                            <select
                              id="attachment-kind"
                              value={attachmentForm.kind}
                              onChange={(event) =>
                                setAttachmentForm((current) => ({ ...current, kind: event.target.value }))
                              }
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {attachmentKindOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="attachment-caption">Legenda</Label>
                            <Input
                              id="attachment-caption"
                              value={attachmentForm.caption}
                              onChange={(event) =>
                                setAttachmentForm((current) => ({ ...current, caption: event.target.value }))
                              }
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={attachmentForm.isCover}
                            onChange={(event) =>
                              setAttachmentForm((current) => ({ ...current, isCover: event.target.checked }))
                            }
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          />
                          Definir como capa do item
                        </label>

                        <Button onClick={() => void submitAttachment()} disabled={savingAttachment}>
                          {savingAttachment ? 'Enviando...' : 'Enviar anexo'}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {!activeItem ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                      Selecione um item para listar anexos.
                    </div>
                  ) : loadingItemDetails ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                      Carregando anexos...
                    </div>
                  ) : attachments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                      Nenhum anexo vinculado a este item.
                    </div>
                  ) : filteredAttachments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                      Nenhum anexo corresponde ao filtro atual.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(groupedAttachments).map(([kind, attachmentGroup]) => (
                        <div key={kind} className="space-y-3">
                          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{attachmentKindLabel(kind)}</div>
                              <div className="text-xs text-slate-500">{attachmentGroup.length} arquivo(s) neste grupo.</div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => void downloadAttachmentGroup(attachmentGroup)}>
                              <Download className="mr-2 h-4 w-4" />
                              Baixar grupo
                            </Button>
                          </div>

                          {attachmentGroup.map((attachment) => (
                            <div key={attachment.id} className="rounded-xl border border-slate-200 p-4">
                              {attachment.kind === 'image' && attachment.signedUrl ? (
                                <img
                                  src={attachment.signedUrl}
                                  alt={attachment.caption || attachment.file_name}
                                  className="mb-3 h-40 w-full rounded-lg object-cover"
                                />
                              ) : (
                                <div className="mb-3 flex h-32 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                  <Image className="mr-2 h-5 w-5" />
                                  {attachment.kind}
                                </div>
                              )}

                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-900">{attachment.file_name}</div>
                                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                      {attachmentKindLabel(attachment.kind)}
                                    </span>
                                    {attachment.is_cover ? (
                                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                                        Capa
                                      </span>
                                    ) : null}
                                  </div>
                                  {attachment.caption ? (
                                    <p className="mt-2 text-sm text-slate-600">{attachment.caption}</p>
                                  ) : null}
                                  <div className="mt-2 break-all text-xs text-slate-500">
                                    Path: {attachment.bucket_path}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button variant="outline" size="sm" onClick={() => void downloadAttachment(attachment)}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Baixar
                                  </Button>
                                  {canWriteActiveInventory ? (
                                    <>
                                      {!attachment.is_cover ? (
                                        <Button variant="outline" size="sm" onClick={() => void setAttachmentAsCover(attachment)}>
                                          Definir capa
                                        </Button>
                                      ) : null}
                                      <Button variant="destructive" size="sm" onClick={() => void deleteAttachment(attachment)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Remover
                                      </Button>
                                    </>
                                  ) : null}
                                </div>
                              </div>

                              {attachment.signedUrl ? (
                                <a
                                  href={attachment.signedUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 inline-flex text-sm font-medium text-blue-700 hover:text-blue-900"
                                >
                                  Abrir arquivo
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ManageInventory;
