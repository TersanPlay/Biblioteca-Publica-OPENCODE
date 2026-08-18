import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/form-field';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../features/auth/auth-provider';
import { useToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';

export function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      toast('success', `Bem-vindo(a), ${user.name.split(' ')[0]}!`);
      navigate('/admin');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(700px 300px at 50% -5%, rgba(8,127,140,.12), transparent 60%)',
        }}
      />
      <div className="shell w-full max-w-md">
        <div className="hairline rounded-[15px] bg-surface p-7 sm:p-8">
          <Link to="/" className="mb-6 flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-control bg-primary text-white shadow-card">
              <BookOpen className="size-5" />
            </span>
            <span>
              <span className="block text-[15px] font-extrabold tracking-tight text-ink">
                Biblioteca Pública
              </span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                Área da equipe
              </span>
            </span>
          </Link>

          <h1 className="text-xl font-extrabold tracking-tight text-ink">Entrar</h1>
          <p className="mt-1 text-[13px] text-muted">
            Acesse com suas credenciais de administrador ou atendente.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@biblioteca.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="rounded-card bg-destructive-soft px-4 py-3 text-[13px] font-semibold text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" loading={loading} className="w-full" size="lg">
              <KeyRound className="size-4" />
              Entrar
            </Button>
          </form>

          

          <p className="mt-6 text-center text-[12.5px] text-muted">
            <Link to="/" className="font-semibold text-primary transition-colors hover:text-primary-dark">
              ← Voltar ao catálogo
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
