import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Edit, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { deleteStoragePaths, isSupabaseReady, uploadImageFile } from '@/lib/supabaseStorage';
import {
  fetchOrgUnitSiteContentRows,
  fetchOrgUnits,
  ORG_UNIT_TYPE_LABELS,
  ORG_UNIT_TYPE_SHORT_LABELS,
  upsertOrgUnitSiteContent,
} from '@/lib/orgUnitSiteContent';

const FILTER_OPTIONS = [
  { key: 'all', label: 'Todas' },
  { key: 'community', label: 'Comunidades' },
  { key: 'pastoral', label: 'Pastorais' },
  { key: 'movement', label: 'Movimentos' },
  { key: 'service', label: 'Serviços' },
];

const normalizeGalleryImages = (images, unitName) =>
  (Array.isArray(images) ? images : [])
    .map((image, index) => {
      if (!image) return null;
      if (typeof image === 'string') {
        return {
          src: image,
          alt: `${unitName} - Foto ${index + 1}`,
        };
      }

      const src = image.src || image.url || '';
      if (!src) return null;

      return {
        ...image,
        src,
        alt: image.alt || `${unitName} - Foto ${index + 1}`,
      };
    })
    .filter(Boolean);

const toPreviewFile = (file) =>
  Object.assign(file, {
    preview: URL.createObjectURL(file),
  });

const getRowSummary = (record) => {
  if (!record.content) {
    return 'Conteúdo institucional ainda não configurado.';
  }

  if (record.orgUnit.type === 'community') {
    return record.content.description || record.content.summary || 'Sem descrição cadastrada.';
  }

  return record.content.summary || record.content.objective || 'Sem resumo cadastrado.';
};

const getRowMeta = (record) => {
  if (record.orgUnit.type === 'community') {
    return [record.content?.addressText, record.content?.massTimes].filter(Boolean).join(' • ') || 'Sem informações complementares';
  }

  return [record.content?.contactName || record.content?.responsible, record.content?.meetingInfo || record.content?.locationText]
    .filter(Boolean)
    .join(' • ') || 'Sem informações complementares';
};

const SettingsOrgUnitsPanel = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [communityImages, setCommunityImages] = useState([]);
  const [removedCommunityImages, setRemovedCommunityImages] = useState([]);
  const [communityFiles, setCommunityFiles] = useState([]);

  const isCoordinator = user?.role === 'member';
  const linkedOrgUnitIds = useMemo(
    () =>
      (user?.orgUnits || [])
        .map((link) => link.orgUnit)
        .filter((orgUnit) => orgUnit && ['community', 'pastoral', 'movement', 'service'].includes(orgUnit.type))
        .map((orgUnit) => orgUnit.id),
    [user?.orgUnits]
  );
  const editableOrgUnitIds = useMemo(() => new Set(linkedOrgUnitIds), [linkedOrgUnitIds]);

  const cleanupCommunityFiles = useCallback((files) => {
    (files || []).forEach((file) => {
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
  }, []);

  const resetDialogState = useCallback(() => {
    cleanupCommunityFiles(communityFiles);
    setCommunityFiles([]);
    setCommunityImages([]);
    setRemovedCommunityImages([]);
    setCurrentRecord(null);
    setIsDialogOpen(false);
  }, [cleanupCommunityFiles, communityFiles]);

  const loadRecords = useCallback(async () => {
    if (!isSupabaseReady) {
      setLoading(false);
      toast({
        title: 'Supabase não configurado',
        description: 'A aba de unidades exige conexão com o Supabase.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const [orgUnits, contentRows] = await Promise.all([
        fetchOrgUnits(),
        fetchOrgUnitSiteContentRows(),
      ]);

      const contentByUnitId = new Map(contentRows.map((row) => [row.orgUnitId, row]));

      const mergedRecords = orgUnits.map((orgUnit) => ({
        orgUnit,
        content: contentByUnitId.get(orgUnit.id) || null,
      }));

      setRecords(
        mergedRecords.sort((left, right) => {
          const typeCompare = left.orgUnit.type.localeCompare(right.orgUnit.type);
          if (typeCompare !== 0) return typeCompare;

          const featuredCompare =
            Number(Boolean(right.content?.isFeatured)) - Number(Boolean(left.content?.isFeatured));
          if (featuredCompare !== 0) return featuredCompare;

          const orderCompare = (left.content?.sortOrder || 0) - (right.content?.sortOrder || 0);
          if (orderCompare !== 0) return orderCompare;

          return left.orgUnit.name.localeCompare(right.orgUnit.name);
        })
      );
    } catch (error) {
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível carregar as unidades institucionais.',
        variant: 'destructive',
      });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const onCommunityDrop = useCallback((acceptedFiles) => {
    setCommunityFiles((prev) => [...prev, ...acceptedFiles.map(toPreviewFile)]);
  }, []);

  const {
    getRootProps: getCommunityRootProps,
    getInputProps: getCommunityInputProps,
    isDragActive: isCommunityDragActive,
  } = useDropzone({
    onDrop: onCommunityDrop,
    accept: { 'image/*': [] },
    multiple: true,
  });

  const visibleRecords = useMemo(() => {
    return records.filter((record) => {
      if (filterType !== 'all' && record.orgUnit.type !== filterType) {
        return false;
      }

      const searchTerm = search.trim().toLowerCase();
      if (!searchTerm) {
        return true;
      }

      const haystack = [
        record.orgUnit.name,
        record.content?.summary,
        record.content?.description,
        record.content?.objective,
        record.content?.contactName,
        record.content?.responsible,
        record.content?.meetingInfo,
        record.content?.locationText,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchTerm);
    });
  }, [filterType, records, search]);

  const groupedRecords = useMemo(() => {
    return visibleRecords.reduce(
      (groups, record) => {
        groups[record.orgUnit.type].push(record);
        return groups;
      },
      { community: [], pastoral: [], movement: [], service: [] }
    );
  }, [visibleRecords]);

  const canEditRecord = useCallback(
    (record) => !isCoordinator || editableOrgUnitIds.has(record.orgUnit.id),
    [editableOrgUnitIds, isCoordinator]
  );

  const openDialog = (record) => {
    cleanupCommunityFiles(communityFiles);
    setCommunityFiles([]);
    setRemovedCommunityImages([]);
    setCurrentRecord(record);
    setCommunityImages(normalizeGalleryImages(record.content?.gallery || [], record.orgUnit.name));
    setIsDialogOpen(true);
  };

  const removeCommunityImage = (imageToRemove) => {
    setCommunityImages((prev) => prev.filter((image) => image !== imageToRemove));

    if (imageToRemove?.preview) {
      URL.revokeObjectURL(imageToRemove.preview);
      setCommunityFiles((prev) => prev.filter((file) => file.preview !== imageToRemove.preview));
      return;
    }

    setRemovedCommunityImages((prev) => [...prev, imageToRemove]);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!currentRecord) {
      return;
    }

    if (isCoordinator && !currentRecord.content) {
      toast({
        title: 'Conteúdo indisponível',
        description: 'A criação inicial do conteúdo desta unidade deve ser feita por um administrador ou articulador.',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData(event.target);
    const orgUnit = currentRecord.orgUnit;
    const currentContent = currentRecord.content;

    setIsSaving(true);

    try {
      let nextGallery = currentContent?.gallery || [];

      if (orgUnit.type === 'community') {
        const uploadedImages = [];
        for (const file of communityFiles) {
          const uploadResult = await uploadImageFile({
            file,
            folder: `org-units/${orgUnit.slug}/gallery`,
            generateThumbnail: true,
            generateMedium: true,
          });

          uploadedImages.push({
            src: uploadResult.mediumUrl || uploadResult.originalUrl || uploadResult.publicUrl,
            thumbSrc: uploadResult.thumbUrl || uploadResult.mediumUrl || uploadResult.publicUrl,
            path: uploadResult.mediumPath || uploadResult.originalPath || uploadResult.path,
            thumbPath: uploadResult.thumbPath || null,
            originalPath: uploadResult.originalPath || uploadResult.path,
            alt: `${orgUnit.name} - Foto ${communityImages.length + uploadedImages.length + 1}`,
          });
        }

        nextGallery = [...communityImages.filter((image) => !image.preview), ...uploadedImages];
      }

      const payload = {
        org_unit_id: orgUnit.id,
        summary: formData.get('summary') || null,
        description: formData.get('description') || null,
        objective: formData.get('objective') || null,
        audience: formData.get('audience') || null,
        responsible: formData.get('responsible') || null,
        contact_name: formData.get('contactName') || null,
        contact_phone: formData.get('contactPhone') || null,
        contact_whatsapp: formData.get('contactWhatsapp') || null,
        contact_email: formData.get('contactEmail') || null,
        how_to_participate: formData.get('howToParticipate') || null,
        meeting_info: formData.get('meetingInfo') || null,
        location_text: formData.get('locationText') || null,
        address_text: formData.get('addressText') || null,
        mass_times: formData.get('massTimes') || null,
        agenda_query: formData.get('agendaQuery') || null,
        cover_image_url: formData.get('coverImageUrl') || null,
        gallery: nextGallery,
        is_public: isCoordinator ? currentContent?.isPublic ?? true : formData.get('isPublic') === 'on',
        is_featured: isCoordinator ? currentContent?.isFeatured ?? false : formData.get('isFeatured') === 'on',
        sort_order: isCoordinator ? currentContent?.sortOrder ?? 0 : Number(formData.get('sortOrder') || 0),
        metadata: currentContent?.metadata || {},
      };

      await upsertOrgUnitSiteContent(payload);

      const removedPaths = removedCommunityImages
        .flatMap((image) => [image.path, image.thumbPath, image.originalPath])
        .filter(Boolean);

      if (removedPaths.length > 0 && isSupabaseReady) {
        try {
          await deleteStoragePaths([...new Set(removedPaths)]);
        } catch (error) {
          toast({
            title: 'Aviso',
            description: 'O conteúdo foi salvo, mas algumas imagens antigas não puderam ser removidas do storage.',
          });
        }
      }

      toast({
        title: 'Sucesso!',
        description: `${ORG_UNIT_TYPE_SHORT_LABELS[orgUnit.type]} atualizada com sucesso.`,
      });

      resetDialogState();
      await loadRecords();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível salvar o conteúdo da unidade.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Unidades Institucionais - Dashboard</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Unidades institucionais</h3>
            <p className="text-sm text-gray-500">
              {isCoordinator
                ? 'Você pode visualizar todas as unidades e editar apenas as que estiverem vinculadas ao seu perfil.'
                : 'Gerencie comunidades, pastorais, movimentos e serviços em uma base relacional única.'}
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar unidade..."
              className="min-w-[220px]"
            />
            <Button type="button" variant="outline" onClick={() => void loadRecords()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {loading ? 'Atualizando...' : 'Atualizar'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <Button
              key={option.key}
              type="button"
              variant={filterType === option.key ? 'default' : 'outline'}
              onClick={() => setFilterType(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
            Carregando unidades...
          </div>
        ) : visibleRecords.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
            Nenhuma unidade disponível para este perfil.
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedRecords).map(([type, items]) => {
              if (items.length === 0) return null;

              return (
                <section key={type} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-semibold text-gray-900">{ORG_UNIT_TYPE_LABELS[type]}</h4>
                    <span className="text-sm text-gray-500">
                      {items.length} registro{items.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {items.map((record) => (
                      <motion.div
                        key={record.orgUnit.id}
                        layout
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-gray-900">{record.orgUnit.name}</p>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                {ORG_UNIT_TYPE_SHORT_LABELS[record.orgUnit.type]}
                              </span>
                              {record.content?.isFeatured ? (
                                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                                  Destaque
                                </span>
                              ) : null}
                              {record.content?.isPublic === false ? (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                                  Oculto
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm text-gray-600">{getRowSummary(record)}</p>
                            <p className="text-sm text-gray-500">{getRowMeta(record)}</p>
                            {record.orgUnit.type === 'community' ? (
                              <p className="text-xs text-gray-500">
                                Galeria: {record.content?.gallery?.length || 0} imagem{record.content?.gallery?.length === 1 ? '' : 'ns'}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => openDialog(record)}
                              disabled={!canEditRecord(record)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              {canEditRecord(record)
                                ? record.content
                                  ? 'Editar'
                                  : 'Configurar'
                                : 'Sem permissão'}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetDialogState();
          } else {
            setIsDialogOpen(true);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {currentRecord ? (
            <>
              <DialogHeader>
                <DialogTitle>{currentRecord.orgUnit.name}</DialogTitle>
                <DialogDescription>
                  {ORG_UNIT_TYPE_LABELS[currentRecord.orgUnit.type]}. O nome e o tipo estrutural continuam controlados por
                  `org_units`.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Slug da unidade</Label>
                    <Input value={currentRecord.orgUnit.slug} readOnly />
                  </div>
                  <div className="space-y-1">
                    <Label>Tipo</Label>
                    <Input value={ORG_UNIT_TYPE_SHORT_LABELS[currentRecord.orgUnit.type]} readOnly />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="summary">Resumo curto</Label>
                    <Textarea id="summary" name="summary" defaultValue={currentRecord.content?.summary} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea id="description" name="description" defaultValue={currentRecord.content?.description} />
                  </div>
                </div>

                {currentRecord.orgUnit.type !== 'community' ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="objective">Objetivo</Label>
                        <Textarea id="objective" name="objective" defaultValue={currentRecord.content?.objective} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="audience">Público / perfil</Label>
                        <Textarea id="audience" name="audience" defaultValue={currentRecord.content?.audience} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="howToParticipate">Como participar</Label>
                      <Textarea
                        id="howToParticipate"
                        name="howToParticipate"
                        defaultValue={currentRecord.content?.howToParticipate}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="meetingInfo">Dia e horário</Label>
                        <Input id="meetingInfo" name="meetingInfo" defaultValue={currentRecord.content?.meetingInfo} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="locationText">Local</Label>
                        <Input id="locationText" name="locationText" defaultValue={currentRecord.content?.locationText} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="addressText">Endereço</Label>
                        <Textarea id="addressText" name="addressText" defaultValue={currentRecord.content?.addressText} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="massTimes">Horários de missas</Label>
                        <Textarea id="massTimes" name="massTimes" defaultValue={currentRecord.content?.massTimes} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Galeria da comunidade</Label>
                      <div
                        {...getCommunityRootProps()}
                        className="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 p-5 text-center transition-colors hover:border-blue-500"
                      >
                        <input {...getCommunityInputProps()} />
                        <ImagePlus className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                        {isCommunityDragActive ? (
                          <p>Solte as imagens aqui...</p>
                        ) : (
                          <p>Arraste imagens ou clique para selecionar</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {communityImages.map((image, index) => (
                          <div key={image.path || image.src || index} className="relative rounded-lg border bg-gray-50 p-1">
                            <img
                              src={image.thumbSrc || image.src}
                              alt={image.alt || `${currentRecord.orgUnit.name} - Foto ${index + 1}`}
                              className="h-24 w-full rounded object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeCommunityImage(image)}
                              className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-red-600 shadow-sm"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        {communityFiles.map((file, index) => (
                          <div key={file.preview || index} className="relative rounded-lg border bg-gray-50 p-1">
                            <img src={file.preview} alt={file.name} className="h-24 w-full rounded object-cover" />
                            <button
                              type="button"
                              onClick={() => removeCommunityImage(file)}
                              className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-red-600 shadow-sm"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="responsible">Responsável</Label>
                    <Input id="responsible" name="responsible" defaultValue={currentRecord.content?.responsible} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="contactName">Nome de contato</Label>
                    <Input id="contactName" name="contactName" defaultValue={currentRecord.content?.contactName} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="contactPhone">Telefone</Label>
                    <Input id="contactPhone" name="contactPhone" defaultValue={currentRecord.content?.contactPhone} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="contactWhatsapp">WhatsApp</Label>
                    <Input
                      id="contactWhatsapp"
                      name="contactWhatsapp"
                      defaultValue={currentRecord.content?.contactWhatsapp}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="contactEmail">E-mail</Label>
                    <Input id="contactEmail" name="contactEmail" defaultValue={currentRecord.content?.contactEmail} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="agendaQuery">Termo da agenda</Label>
                    <Input id="agendaQuery" name="agendaQuery" defaultValue={currentRecord.content?.agendaQuery} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="coverImageUrl">URL da imagem de capa</Label>
                    <Input
                      id="coverImageUrl"
                      name="coverImageUrl"
                      defaultValue={currentRecord.content?.coverImageUrl}
                    />
                  </div>
                </div>

                {!isCoordinator ? (
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="sortOrder">Ordem</Label>
                        <Input
                          id="sortOrder"
                          name="sortOrder"
                          type="number"
                          defaultValue={currentRecord.content?.sortOrder ?? 0}
                        />
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 md:pt-7">
                        <input
                          type="checkbox"
                          name="isPublic"
                          defaultChecked={currentRecord.content?.isPublic ?? true}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        Exibir no site
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 md:pt-7">
                        <input
                          type="checkbox"
                          name="isFeatured"
                          defaultChecked={currentRecord.content?.isFeatured ?? false}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        Destacar
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                    Como coordenador, você pode editar apenas o conteúdo da sua unidade. Visibilidade, destaque e
                    ordenação continuam restritos ao articulador ou administrador.
                  </div>
                )}

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary" onClick={resetDialogState}>
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SettingsOrgUnitsPanel;
