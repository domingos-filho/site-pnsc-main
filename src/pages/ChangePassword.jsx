import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const MIN_PASSWORD_LENGTH = 8;

const PasswordField = ({ id, label, value, onChange, show, onToggle, autoComplete }) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="pr-12"
        required
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center rounded-r-md text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={show}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  </div>
);

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, changePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const mustChangePassword = Boolean(user?.requiresPasswordChange);

  const resolveReturnPath = () => {
    const destination = location.state?.from?.pathname;
    if (!destination || destination === '/dashboard/password') {
      return '/dashboard';
    }
    return destination;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: 'Erro',
        description: `A nova senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        variant: 'destructive',
      });
      return;
    }

    if (currentPassword === newPassword) {
      toast({
        title: 'Erro',
        description: 'A nova senha precisa ser diferente da senha atual.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Erro',
        description: 'A confirmacao da senha nao confere.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const result = await changePassword(currentPassword, newPassword);

    if (result.success) {
      toast({
        title: 'Senha atualizada',
        description: mustChangePassword
          ? 'Sua senha provisoria foi substituida com sucesso.'
          : 'Sua senha foi atualizada com sucesso.',
      });
      navigate(resolveReturnPath(), { replace: true });
    } else {
      toast({
        title: 'Erro',
        description: result.error || 'Nao foi possivel trocar a senha.',
        variant: 'destructive',
      });
    }

    setIsSubmitting(false);
  };

  return (
    <>
      <Helmet>
        <title>Trocar Senha - Dashboard</title>
        <meta name="description" content="Atualize sua senha de acesso ao painel." />
      </Helmet>

      <div className="bg-gradient-to-br from-blue-600 to-blue-800 py-16 text-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold md:text-4xl">Trocar senha</h1>
            <p className="mt-3 text-sm text-blue-100 md:text-base">
              {mustChangePassword
                ? 'Sua conta esta com senha provisoria. Defina uma senha definitiva para continuar usando o painel.'
                : 'Atualize sua senha de acesso sem depender de e-mail ou fluxo externo.'}
            </p>
          </div>
        </div>
      </div>

      <section className="bg-slate-50 py-10 md:py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-lg md:p-8">
            {mustChangePassword ? (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                Enquanto a senha nao for trocada, as demais telas protegidas do painel ficam bloqueadas.
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <PasswordField
                id="current-password"
                label="Senha atual"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                show={showCurrentPassword}
                onToggle={() => setShowCurrentPassword((current) => !current)}
                autoComplete="current-password"
              />

              <PasswordField
                id="new-password"
                label="Nova senha"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                show={showNewPassword}
                onToggle={() => setShowNewPassword((current) => !current)}
                autoComplete="new-password"
              />

              <PasswordField
                id="confirm-password"
                label="Confirmar nova senha"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((current) => !current)}
                autoComplete="new-password"
              />

              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Use pelo menos 8 caracteres e escolha uma senha diferente da atual.
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                {!mustChangePassword ? (
                  <Button type="button" variant="outline" onClick={() => navigate(resolveReturnPath())}>
                    Voltar
                  </Button>
                ) : null}
                <Button type="submit" disabled={isSubmitting}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Salvando...' : 'Atualizar senha'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </>
  );
};

export default ChangePassword;
