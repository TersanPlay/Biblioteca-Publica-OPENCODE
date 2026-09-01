import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-shell bg-surface text-primary shadow-card">
        <Compass className="size-6" />
      </span>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-muted">
        O endereço que você tentou acessar não existe ou foi movido.
      </p>
      <div className="flex gap-2">
        <Link to="/">
          <Button variant="primary">Ir para o início</Button>
        </Link>
        <Link to="/catalogo">
          <Button variant="secondary">Ver catálogo</Button>
        </Link>
      </div>
    </div>
  );
}
