import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const destination = location.state?.from?.pathname || '/dashboard';
      navigate(destination);
    } else {
      toast({
        title: 'Erro no login',
        description: result.error || 'Nao foi possivel entrar.',
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

      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <img
              src="/assets/BRASAO_DA_PAROQUIA.png"
              alt="Brasão da Paróquia"
              className="h-24 w-24 mx-auto mb-4"
            />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Área de Login</h1>
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
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1"
                placeholder="********"
              />
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

