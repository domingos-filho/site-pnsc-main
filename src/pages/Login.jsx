import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await login(email, password);

    if (result.success) {
      toast({
        title: 'Login realizado!',
        description: 'Bem-vindo de volta!',
      });
      const destination = result.requiresPasswordChange
        ? '/dashboard/password'
        : location.state?.from?.pathname || '/dashboard';
      navigate(destination);
    } else {
      toast({
        title: 'Erro no login',
        description: result.error || 'Não foi possível entrar.',
        variant: 'destructive',
      });
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <Helmet>
        <title>Login - Paróquia de Nossa Senhora da Conceição</title>
        <meta name="description" content="Área de login para membros e administradores da paróquia." />
      </Helmet>

      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 px-4 py-6 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
        >
          <div className="mb-8 text-center">
            <img
              src="/assets/BRASAO_DA_PAROQUIA.png"
              alt="Brasão da Paróquia"
              className="mx-auto mb-4 h-20 w-20 sm:h-24 sm:w-24"
            />
            <h1 className="mb-2 text-2xl font-bold text-gray-800 sm:text-3xl">Área de Login</h1>
            <p className="text-gray-600">Acesse sua conta</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-12"
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center rounded-r-md text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
              <LogIn className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700 font-semibold mb-2">Importante:</p>
            <p className="text-xs text-gray-600">
              Você coordenador/articulador que precisa gerenciar o site, entre em contato com a nossa
              PASCOM para adquirir suas credenciais!
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Login;
