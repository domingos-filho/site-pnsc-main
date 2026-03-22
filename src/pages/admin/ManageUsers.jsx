import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Edit, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseReady } from '@/lib/supabaseClient';

const roleLabels = {
  admin: 'Administrador',
  secretary: 'Secretario',
  member: 'Membro',
};

const roleBadgeClass = {
  admin: 'bg-red-100 text-red-800',
  secretary: 'bg-amber-100 text-amber-800',
  member: 'bg-blue-100 text-blue-800',
};

const ManageUsers = () => {
  const { toast } = useToast();
  const { user, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchProfiles = async () => {
    if (!isSupabaseReady) {
      toast({
        title: 'Supabase nao configurado',
        description: 'Defina as variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, email')
      .order('name');

    if (error) {
      toast({
        title: 'Erro',
        description: 'Nao foi possivel carregar os perfis.',
        variant: 'destructive',
      });
    } else {
      setProfiles(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const openDialog = (profile) => {
    setCurrentProfile(profile);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setCurrentProfile(null);
    setIsDialogOpen(false);
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    if (!currentProfile?.id) return;

    const formData = new FormData(event.target);
    const payload = {
      name: formData.get('name')?.trim() || null,
      role: formData.get('role'),
    };

    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', currentProfile.id);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Nao foi possivel atualizar o perfil.',
        variant: 'destructive',
      });
    } else {
      setProfiles((prev) =>
        prev.map((profile) =>
          profile.id === currentProfile.id ? { ...profile, ...payload } : profile
        )
      );
      if (currentProfile.id === user?.id) {
        await refreshProfile();
      }
      toast({ title: 'Sucesso!', description: 'Perfil atualizado.' });
      closeDialog();
    }

    setIsSaving(false);
  };

  return (
    <>
      <Helmet>
        <title>Gerenciar Perfis - Dashboard</title>
      </Helmet>
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Gerenciar Perfis</h1>
            <p className="text-sm text-gray-500">
              Crie usuarios no Supabase Auth. Quando fizerem login, o perfil aparece aqui para ajuste de papel.
            </p>
          </div>
          <Button variant="outline" onClick={fetchProfiles} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {isLoading ? 'Atualizando...' : 'Atualizar lista'}
          </Button>
        </div>

        <motion.div
          className="bg-white shadow-lg rounded-xl overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-3">
                    Nome
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Perfil
                  </th>
                  <th scope="col" className="px-6 py-3 text-right">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody>
                {profiles.length > 0 ? (
                  profiles.map((profile) => (
                    <tr key={profile.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                        {profile.name || 'Sem nome'}
                      </td>
                      <td className="px-6 py-4">{profile.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            roleBadgeClass[profile.role] || roleBadgeClass.member
                          }`}
                        >
                          {roleLabels[profile.role] || 'Membro'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Dialog open={isDialogOpen && currentProfile?.id === profile.id} onOpenChange={setIsDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => openDialog(profile)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar perfil</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSaveProfile} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="name">Nome</Label>
                                <Input id="name" name="name" defaultValue={currentProfile?.name || ''} />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" value={currentProfile?.email || ''} disabled />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="role">Perfil</Label>
                                <div className="relative">
                                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                  <select
                                    id="role"
                                    name="role"
                                    defaultValue={currentProfile?.role || 'member'}
                                    required
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-10"
                                  >
                                    <option value="member">Membro</option>
                                    <option value="secretary">Secretario</option>
                                    <option value="admin">Administrador</option>
                                  </select>
                                </div>
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
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-10 text-gray-500">
                      Nenhum perfil encontrado.
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

export default ManageUsers;
