import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
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
import { createEvent, deleteEvent, loadEvents, updateEvent } from '@/lib/supabaseData';

const ManageEvents = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchEvents = async () => {
      const { events: loaded, error } = await loadEvents({ syncPending: true });
      if (!isMounted) return;
      setEvents(loaded);
      if (error) {
        toast({
          title: 'Aviso',
          description: 'Falha ao carregar eventos do Supabase. Usando dados locais.',
        });
      }
    };

    fetchEvents();
    return () => {
      isMounted = false;
    };
  }, [toast]);

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.target);
    const eventData = Object.fromEntries(formData.entries());

    try {
      let result;

      if (currentEvent?.id) {
        result = await updateEvent(currentEvent.id, eventData);
        setEvents(result.events);
        toast({
          title: result.synced ? 'Sucesso!' : 'Aviso',
          description: result.synced
            ? 'Evento atualizado com sucesso.'
            : 'Evento atualizado localmente, mas não foi possível sincronizar com o Supabase.',
        });
      } else {
        result = await createEvent(eventData);
        setEvents(result.events);
        toast({
          title: result.synced ? 'Sucesso!' : 'Aviso',
          description: result.synced
            ? 'Evento adicionado com sucesso.'
            : 'Evento salvo localmente, mas não foi possível sincronizar com o Supabase.',
        });
      }

      closeDialog();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao salvar o evento.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    const result = await deleteEvent(id);
    setEvents(result.events);
    toast({
      title: result.error ? 'Aviso' : 'Sucesso!',
      description: result.error
        ? 'Evento removido localmente, mas não foi possível atualizar o Supabase.'
        : 'Evento excluído com sucesso.',
    });
  };

  const openDialog = (event = null) => {
    setCurrentEvent(event);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setCurrentEvent(null);
    setIsDialogOpen(false);
  };

  return (
    <>
      <Helmet>
        <title>Gerenciar Eventos - Dashboard</title>
      </Helmet>
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Gerenciar Eventos</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Evento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {currentEvent ? 'Editar Evento' : 'Adicionar Novo Evento'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveEvent} className="space-y-4">
                <div>
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" name="title" defaultValue={currentEvent?.title} required />
                </div>
                <div>
                  <Label htmlFor="date">Data</Label>
                  <Input id="date" name="date" type="date" defaultValue={currentEvent?.date} required />
                </div>
                <div>
                  <Label htmlFor="time">Hora</Label>
                  <Input id="time" name="time" type="time" defaultValue={currentEvent?.time} required />
                </div>
                <div>
                  <Label htmlFor="location">Local</Label>
                  <Input
                    id="location"
                    name="location"
                    defaultValue={currentEvent?.location}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={currentEvent?.description}
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary" onClick={closeDialog}>
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <motion.div
          className="bg-white rounded-lg shadow-md overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Título
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Data
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Local
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.length > 0 ? (
                  events.map((event) => (
                    <tr key={event.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {event.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR')} às{' '}
                        {event.time}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {event.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => openDialog(event)}>
                          <Edit className="h-4 w-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Essa ação não pode ser desfeita. Isso excluirá permanentemente o evento.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteEvent(event.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Sim, excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-10 text-gray-500">
                      Nenhum evento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default ManageEvents;
