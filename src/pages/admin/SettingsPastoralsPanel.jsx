import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { getPastoralCategoryLabel, normalizePastoralItem } from '@/lib/pastorals';

const showSyncWarning = (toast) => {
  toast({
    title: 'Aviso',
    description: 'Alterações salvas localmente, mas não foi possível sincronizar com o Supabase.',
  });
};

const CATEGORIES = {
  pastorais: 'Pastorais',
  movimentos: 'Movimentos',
  servicos: 'Serviços',
};

const ItemRow = ({ item, onEdit, onDelete }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, x: -10 }}
    className="rounded-2xl bg-gray-50 p-4"
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-semibold text-gray-900">{item.name}</p>
        <p className="mt-1 text-sm text-gray-500">
          {[item.contactName || item.responsible, item.meeting || item.location].filter(Boolean).join(' • ') ||
            'Sem detalhes complementares'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-full px-2 py-1 font-semibold ${
              item.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {item.active ? 'Ativo' : 'Oculto'}
          </span>
          {item.featured ? (
            <span className="rounded-full bg-blue-100 px-2 py-1 font-semibold text-blue-700">Destaque</span>
          ) : null}
          <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-600">
            Ordem {item.sortOrder}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(item)}>
          <Edit className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir item?</AlertDialogTitle>
              <AlertDialogDescription>Essa ação remove o item desta categoria.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => onDelete(item.id)}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  </motion.div>
);

const SettingsPastoralsPanel = () => {
  const { siteData, updateSiteData } = useData();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [currentItem, setCurrentItem] = useState(null);

  const openDialog = (category, item = null) => {
    setCurrentCategory(category);
    setCurrentItem(item);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setCurrentCategory(null);
    setCurrentItem(null);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    const currentItems = siteData.pastorals[currentCategory] || [];
    const currentIndex = currentItem
      ? currentItems.findIndex((item) => item.id === currentItem.id)
      : currentItems.length;

    const nextItem = normalizePastoralItem(
      {
        ...currentItem,
        ...data,
        responsible: data.contactName || currentItem?.responsible || '',
        active: formData.get('active') === 'on',
        featured: formData.get('featured') === 'on',
      },
      currentCategory,
      currentIndex >= 0 ? currentIndex : currentItems.length
    );

    const nextItems = currentItem
      ? currentItems.map((item) => (item.id === currentItem.id ? nextItem : item))
      : [...currentItems, nextItem];

    const result = await updateSiteData({
      ...siteData,
      pastorals: {
        ...siteData.pastorals,
        [currentCategory]: nextItems,
      },
    });

    if (!result.ok) {
      showSyncWarning(toast);
    } else {
      toast({
        title: 'Sucesso!',
        description: `Item ${currentItem ? 'atualizado' : 'criado'}.`,
      });
    }

    closeDialog();
  };

  const handleDelete = async (category, itemId) => {
    const nextItems = (siteData.pastorals[category] || []).filter((item) => item.id !== itemId);
    const result = await updateSiteData({
      ...siteData,
      pastorals: {
        ...siteData.pastorals,
        [category]: nextItems,
      },
    });

    if (!result.ok) {
      showSyncWarning(toast);
    } else {
      toast({ title: 'Sucesso!', description: 'Item excluído.' });
    }
  };

  return (
    <div className="space-y-8">
      {Object.entries(CATEGORIES).map(([category, title]) => (
        <section key={category} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Button type="button" onClick={() => openDialog(category)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-2">
            <AnimatePresence>
              {(siteData.pastorals[category] || []).map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onEdit={() => openDialog(category, item)}
                  onDelete={(itemId) => handleDelete(category, itemId)}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      ))}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
          } else {
            setIsDialogOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentItem ? 'Editar' : 'Novo'} Item</DialogTitle>
            <p className="text-sm text-gray-500">{getPastoralCategoryLabel(currentCategory)}</p>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="pastoral-name">Nome</Label>
              <Input id="pastoral-name" name="name" defaultValue={currentItem?.name} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pastoral-summary">Resumo curto</Label>
              <Textarea id="pastoral-summary" name="summary" defaultValue={currentItem?.summary} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pastoral-objective">Objetivo</Label>
              <Textarea id="pastoral-objective" name="objective" defaultValue={currentItem?.objective} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pastoral-audience">Para quem é indicado</Label>
              <Input id="pastoral-audience" name="audience" defaultValue={currentItem?.audience} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="pastoral-contact-name">Responsável principal</Label>
                <Input
                  id="pastoral-contact-name"
                  name="contactName"
                  defaultValue={currentItem?.contactName || currentItem?.responsible}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pastoral-phone">Telefone</Label>
                <Input id="pastoral-phone" name="contactPhone" defaultValue={currentItem?.contactPhone} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pastoral-whatsapp">WhatsApp</Label>
                <Input id="pastoral-whatsapp" name="contactWhatsapp" defaultValue={currentItem?.contactWhatsapp} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pastoral-email">E-mail</Label>
                <Input id="pastoral-email" name="contactEmail" defaultValue={currentItem?.contactEmail} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pastoral-participation">Como participar</Label>
              <Textarea
                id="pastoral-participation"
                name="howToParticipate"
                defaultValue={currentItem?.howToParticipate}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="pastoral-meeting">Dia e horário</Label>
                <Input id="pastoral-meeting" name="meeting" defaultValue={currentItem?.meeting} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pastoral-location">Local</Label>
                <Input id="pastoral-location" name="location" defaultValue={currentItem?.location} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pastoral-agenda-query">Termo para filtrar a agenda</Label>
              <Input
                id="pastoral-agenda-query"
                name="agendaQuery"
                defaultValue={currentItem?.agendaQuery || currentItem?.name}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pastoral-image">URL da imagem</Label>
              <Input id="pastoral-image" name="image" defaultValue={currentItem?.image} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pastoral-sort-order">Ordem de exibição</Label>
              <Input
                id="pastoral-sort-order"
                name="sortOrder"
                type="number"
                defaultValue={currentItem?.sortOrder ?? 10}
              />
            </div>

            <div className="flex flex-wrap gap-6 rounded-xl bg-gray-50 px-4 py-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={currentItem?.active ?? true}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Exibir no site
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked={currentItem?.featured ?? false}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Destacar na página
              </label>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPastoralsPanel;
