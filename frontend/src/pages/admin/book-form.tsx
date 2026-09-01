import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, Save, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { FieldError, Label } from '../../components/ui/form-field';
import { Input } from '../../components/ui/input';
import { NativeSelect } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { Textarea } from '../../components/ui/textarea';
import { authorsApi, booksApi, subjectsApi, knowledgeAreasApi } from '../../features/api';
import { useToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';
import { isValidIsbn10, isValidIsbn13 } from '../../lib/isbn';
import type {
  Author,
  Book,
  BookFormValues,
  BookRef,
  Subject,
  KnowledgeArea,
} from '../../types/api';

const DUPLICATE_MESSAGE: Record<'isbn10' | 'isbn13', string> = {
  isbn10: 'Já existe um livro cadastrado com este ISBN-10.',
  isbn13: 'Já existe um livro cadastrado com este ISBN-13.',
};

const FORMAT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'CAPA', label: 'Capa' },
  { value: 'BROCHURA', label: 'Brochura' },
  { value: 'ESPIRAL', label: 'Espiral' },
];

const ACQUISITION_OPTIONS = [
  { value: '', label: '—' },
  { value: 'COMPRA', label: 'Compra' },
  { value: 'DOACAO', label: 'Doação' },
  { value: 'REPOSICAO', label: 'Reposição' },
  { value: 'PRODUCAO_INTERNA', label: 'Produção Interna' },
  { value: 'TROCA', label: 'Troca' },
  { value: 'EMPRESTIMO_BIBLIOTECAS', label: 'Empréstimo entre Bibliotecas' },
  { value: 'LICITACAO', label: 'Licitação' },
  { value: 'PERMUTA', label: 'Permuta' },
  { value: 'CONVENIO', label: 'Convênio' },
];

const tagValue = z.object({ id: z.string().nullable(), name: z.string().trim().min(1) });

const schema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  subtitle: z.string(),
  isbn10: z.string().refine((v) => v === '' || isValidIsbn10(v), 'Informe um ISBN-10 válido.'),
  isbn13: z.string().refine((v) => v === '' || isValidIsbn13(v), 'Informe um ISBN-13 válido.'),
  description: z.string(),
  publisher: z.string(),
  edition: z.string(),
  publicationYear: z.string(),
  language: z.string(),
  pages: z.string(),
  coverUrl: z.string(),
  format: z.enum(['', 'CAPA', 'BROCHURA', 'ESPIRAL']),
  volume: z.string(),
  cdd: z.string(),
  cutter: z.string(),
  physicalLocation: z.string(),
  availableCopies: z.string(),
  acquisitionType: z.enum([
    '',
    'COMPRA',
    'DOACAO',
    'REPOSICAO',
    'PRODUCAO_INTERNA',
    'TROCA',
    'EMPRESTIMO_BIBLIOTECAS',
    'LICITACAO',
    'PERMUTA',
    'CONVENIO',
  ]),
  subjects: z.array(tagValue),
  authors: z.array(tagValue).min(1, 'Informe ao menos um autor'),
  knowledgeAreas: z.array(tagValue),
});

interface TagOption {
  $id: string;
  name: string;
}

interface TagInputFieldProps {
  label: string;
  helpText?: string;
  placeholder: string;
  options: TagOption[];
  value: { id: string | null; name: string }[];
  onChange: (next: { id: string | null; name: string }[]) => void;
  error?: string;
}

function TagInputField({ label, helpText, placeholder, options, value, onChange, error }: TagInputFieldProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef('');
  inputRef.current = input;

  const selectedIds = useMemo(
    () => new Set(value.filter((v) => v.id != null).map((v) => v.id)),
    [value],
  );
  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    const rank = (o: TagOption) =>
      o.name.toLowerCase() === q ? 0 : o.name.toLowerCase().startsWith(q) ? 1 : 2;
    return options
      .filter((o) => !selectedIds.has(o.$id))
      .filter((o) => !value.some((v) => v.name.toLowerCase() === o.name.toLowerCase()))
      .filter((o) => o.name.toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [options, input, selectedIds, value]);

  const addNames = (raw: string) => {
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      setOpen(false);
      return;
    }
    const next = [...value];
    for (const part of parts) {
      if (next.some((v) => v.name.toLowerCase() === part.toLowerCase())) continue;
      const matched = options.find((o) => o.name.toLowerCase() === part.toLowerCase());
      next.push(matched ? { id: matched.$id, name: matched.name } : { id: null as string | null, name: part });
    }
    onChange(next);
    setInput('');
    setOpen(false);
  };

  const removeAt = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <div>
      <Label>{label}</Label>
      {helpText && <p className="mb-3 text-[12.5px] text-muted">{helpText}</p>}
      <div className="relative">
        <Input
          value={input}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(',') || (v.includes(',') && v.trim().length > 1)) addNames(v);
            else {
              setInput(v);
              setOpen(true);
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() =>
            setTimeout(() => {
              if (inputRef.current.trim()) addNames(inputRef.current);
              setOpen(false);
            }, 150)
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (suggestions.length > 0 && !input.includes(',')) addNames(suggestions[0].name);
              else addNames(input);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
        />
        {open && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-control bg-surface shadow-card hairline">
            {suggestions.map((o) => (
              <button
                key={o.$id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addNames(o.name);
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13.5px] font-semibold text-ink transition-colors duration-150 hover:bg-surfaceWarm"
              >
                <Check className="size-3.5 text-primary" />
                {o.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((v, i) => (
            <span
              key={`${v.name}-${i}`}
              className={`inline-flex items-center gap-1.5 rounded-full py-1.5 pl-3.5 pr-1.5 text-[13px] font-semibold transition-all duration-200 [transition-timing-function:var(--ease)] ${
                v.id == null
                  ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-300'
                  : 'bg-primary text-white shadow-card'
              }`}
            >
              {v.name}
              {v.id == null && (
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-700">
                  novo
                </span>
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remover ${v.name}`}
                className={`rounded-full p-1 transition-colors duration-150 ${
                  v.id == null ? 'hover:bg-amber-100' : 'hover:bg-primary-dark'
                }`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {error && <FieldError message={error} />}
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="mb-4 border-b border-black/5 pb-2 text-[15px] font-extrabold uppercase tracking-wide text-muted">
      {children}
    </h2>
  );
}

export function BookFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [book, setBook] = useState<Book | null>(null);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [knowledgeAreas, setKnowledgeAreas] = useState<KnowledgeArea[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [coverState, setCoverState] = useState<'idle' | 'searching' | 'notfound'>('idle');
  const [duplicate, setDuplicate] = useState<{ field: 'isbn10' | 'isbn13'; book: BookRef } | null>(null);

  const { register, handleSubmit, setValue, watch, reset, setError, clearErrors, formState: { errors } } = useForm<BookFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '', subtitle: '', isbn10: '', isbn13: '', description: '', publisher: '',
      edition: '', publicationYear: '', language: 'Português', pages: '', coverUrl: '',
      format: '', volume: '', cdd: '', cutter: '', physicalLocation: '',
      availableCopies: '', acquisitionType: '',
      subjects: [], authors: [], knowledgeAreas: [],
    },
  });

  useEffect(() => {
    Promise.all([authorsApi.all(), subjectsApi.all(), knowledgeAreasApi.all()])
      .then(([a, s, k]) => {
        setAuthors(a);
        setSubjects(s);
        setKnowledgeAreas(k);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    booksApi
      .get(id!)
      .then((b) => {
        setBook(b);
        reset({
          title: b.title,
          subtitle: b.subtitle ?? '',
          isbn10: b.isbn10 ?? '',
          isbn13: b.isbn13 ?? '',
          description: b.description ?? '',
          publisher: b.publisher ?? '',
          edition: b.edition ? String(b.edition) : '',
          publicationYear: b.publicationYear ? String(b.publicationYear) : '',
          language: b.language ?? 'Português',
          pages: b.pages ? String(b.pages) : '',
          coverUrl: b.coverUrl ?? '',
          format: b.format ?? '',
          volume: b.volume ?? '',
          cdd: b.cdd ?? '',
          cutter: b.cutter ?? '',
          physicalLocation: b.physicalLocation ?? '',
          availableCopies: b.availableCopies != null ? String(b.availableCopies) : '',
          acquisitionType: b.acquisitionType ?? '',
          subjects: b.subjectNames.map((name, i) => ({ id: b.subjectIds[i] ?? null, name })),
          authors: b.authorNames.map((name, i) => ({ id: b.authorIds[i] ?? null, name })),
          knowledgeAreas: b.knowledgeAreaNames.map((name, i) => ({ id: b.knowledgeAreaIds[i] ?? null, name })),
        });
      })
      .catch((err) => {
        toast('error', 'Não foi possível carregar o livro', apiErrorMessage(err));
        navigate('/admin/livros');
      })
      .finally(() => setLoading(false));
  }, [id, isEdit, reset, navigate, toast]);

  const authorsField = watch('authors');
  const subjectsField = watch('subjects');
  const knowledgeAreasField = watch('knowledgeAreas');

  const isbn10 = watch('isbn10');
  const isbn13 = watch('isbn13');
  const coverUrl = watch('coverUrl');
  const doneCache = useRef<Set<string>>(new Set());

  useEffect(() => {
    const candidate = [isbn10, isbn13]
      .map((v) => v.trim())
      .find((v) => isValidIsbn10(v) || isValidIsbn13(v));
    if (!candidate || coverUrl.trim() !== '') {
      setCoverState('idle');
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (doneCache.current.has(candidate)) return;
      doneCache.current.add(candidate);
      setCoverState('searching');
      booksApi
        .cover(candidate, controller.signal)
        .then((info) => {
          if (info.coverUrl && watch('coverUrl').trim() === '') {
            setValue('coverUrl', info.coverUrl);
          }
          if (info.title && watch('title').trim() === '') {
            setValue('title', info.title);
          }
          if (info.subtitle && watch('subtitle').trim() === '') {
            setValue('subtitle', info.subtitle);
          }
          if (info.isbn13 && watch('isbn13').trim() === '') {
            setValue('isbn13', info.isbn13);
          }
          if (info.description && watch('description').trim() === '') {
            setValue('description', info.description);
          }
          if (info.publisher && watch('publisher').trim() === '') {
            setValue('publisher', info.publisher);
          }
          if (info.publicationYear && watch('publicationYear').trim() === '') {
            setValue('publicationYear', String(info.publicationYear));
          }
          if (info.pages && watch('pages').trim() === '') {
            setValue('pages', String(info.pages));
          }
          if (info.authors.length > 0 && watch('authors').length === 0) {
            setValue(
              'authors',
              info.authors.slice(0, 6).map((name) => ({ id: null as string | null, name })),
            );
          }
          if (info.subjects.length > 0 && watch('subjects').length === 0) {
            setValue(
              'subjects',
              info.subjects.slice(0, 4).map((name) => ({ id: null as string | null, name })),
            );
          }
          setCoverState('idle');
        })
        .catch(() => {
          if (!controller.signal.aborted) setCoverState('notfound');
        });
    }, 1400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isbn10, isbn13, coverUrl, setValue]);

  useEffect(() => {
    const check: Array<{ field: 'isbn10' | 'isbn13'; value: string }> = [
      { field: 'isbn10', value: isbn10 },
      { field: 'isbn13', value: isbn13 },
    ];
    const controller = new AbortController();
    const timer = setTimeout(() => {
      (async () => {
        let found: { field: 'isbn10' | 'isbn13'; book: BookRef } | null = null;
        for (const item of check) {
          const value = item.value.trim();
          if (!value) continue;
          const valid = item.field === 'isbn10' ? isValidIsbn10(value) : isValidIsbn13(value);
          if (!valid) continue;
          try {
            const { book } = await booksApi.exists(value, isEdit ? id : undefined, controller.signal);
            if (book) {
              found = { field: item.field, book };
              break;
            }
          } catch {
            /* checagem falhou: segue sem bloquear */
          }
        }
        if (found) {
          setDuplicate((cur) =>
            cur && cur.field === found.field && cur.book.id === found.book.id ? cur : found,
          );
          setError(found.field, { type: 'custom', message: DUPLICATE_MESSAGE[found.field] });
        } else {
          setDuplicate((cur) => (cur ? null : cur));
          clearErrors(['isbn10', 'isbn13']);
        }
      })();
    }, 650);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isbn10, isbn13, isEdit, id, setError, clearErrors]);

  const submit = async (values: BookFormValues) => {
    if (duplicate) {
      toast(
        'error',
        'Livro já cadastrado',
        `${duplicate.book.title} já está no acervo com este ISBN. Verifique antes de salvar.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await booksApi.update(id!, values);
        toast('success', 'Livro atualizado');
      } else {
        await booksApi.create(values);
        toast('success', 'Livro cadastrado');
      }
      navigate('/admin/livros');
    } catch (err) {
      toast('error', 'Não foi possível salvar', apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {isEdit ? 'Editar livro' : 'Novo livro'}
          </h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {isEdit ? `Editando "${book?.title}"` : 'Cadastre um novo título no acervo.'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" /> Voltar
        </Button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(submit)(e); }} className="space-y-5">
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <SectionTitle>Identificação</SectionTitle>
            <div className="sm:col-span-2">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" placeholder="Dom Casmurro" error={errors.title?.message} {...register('title')} />
            </div>
            <div>
              <Label htmlFor="subtitle">Subtítulo</Label>
              <Input id="subtitle" placeholder="Memórias póstumas de um capítulo" {...register('subtitle')} />
            </div>
            <div>
              <Label htmlFor="isbn10">ISBN-10</Label>
              <Input id="isbn10" placeholder="85-359-0277-5" error={errors.isbn10?.message} {...register('isbn10')} />
            </div>
            <div>
              <Label htmlFor="isbn13">ISBN-13</Label>
              <Input id="isbn13" placeholder="978-85-359-0277-8" error={errors.isbn13?.message} {...register('isbn13')} />
            </div>
            {duplicate && (
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-card bg-surfaceBlue2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-extrabold text-ink">Livro já cadastrado</p>
                  <p className="line-clamp-1 text-[13.5px] font-bold text-primary-dark">{duplicate.book.title}</p>
                  <p className="text-[12.5px] text-muted">
                    {duplicate.field === 'isbn10'
                      ? `ISBN-10: ${duplicate.book.isbn10 ?? '—'}`
                      : `ISBN-13: ${duplicate.book.isbn13 ?? '—'}`}
                  </p>
                  <p className="mt-0.5 text-[12.5px] font-bold text-primary-dark">
                    {DUPLICATE_MESSAGE[duplicate.field]}
                  </p>
                </div>
                <Link
                  to={`/livros/${duplicate.book.id}`}
                  state={{ fromAdmin: true }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-primary-dark"
                >
                  <BookOpen className="size-4" /> Ver livro
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <SectionTitle>Publicação</SectionTitle>
            <div>
              <Label htmlFor="publisher">Editora</Label>
              <Input id="publisher" placeholder="Companhia das Letras" {...register('publisher')} />
            </div>
            <div>
              <Label htmlFor="publicationYear">Ano de publicação</Label>
              <Input id="publicationYear" type="number" min={1000} max={2100} placeholder="1899" {...register('publicationYear')} />
            </div>
            <div>
              <Label htmlFor="edition">Edição</Label>
              <Input id="edition" type="number" min={1} placeholder="1" {...register('edition')} />
            </div>
            <div>
              <Label htmlFor="volume">Volume</Label>
              <Input id="volume" placeholder="Vol. 1" {...register('volume')} />
            </div>
            <div>
              <Label htmlFor="language">Idioma</Label>
              <Input id="language" placeholder="Português" {...register('language')} />
            </div>
            <div>
              <Label htmlFor="pages">Páginas</Label>
              <Input id="pages" type="number" min={1} placeholder="256" {...register('pages')} />
            </div>
            <div>
              <Label htmlFor="format">Formato físico</Label>
              <NativeSelect
                value={watch('format')}
                onChange={(v) => setValue('format', v)}
                options={FORMAT_OPTIONS}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <SectionTitle>Catalogação</SectionTitle>
            <div>
              <Label htmlFor="cdd">CDD</Label>
              <Input id="cdd" placeholder="869.3" {...register('cdd')} />
            </div>
            <div>
              <Label htmlFor="cutter">Cutter</Label>
              <Input id="cutter" placeholder="M338d" {...register('cutter')} />
            </div>
            <div className="sm:col-span-2">
              <TagInputField
                label="Área de Conhecimento"
                helpText="Digite as áreas separadas por vírgulas (ex.: Ciências Humanas, Exatas). Áreas ainda não cadastradas são criadas ao salvar."
                placeholder="Nome da área..."
                options={knowledgeAreas}
                value={knowledgeAreasField}
                onChange={(next) => setValue('knowledgeAreas', next)}
              />
            </div>
            <TagInputField
              label="Autores *"
              helpText="Digite os autores separados por vírgulas. Nomes ainda não cadastrados são criados ao salvar."
              placeholder="Nome do autor..."
              options={authors}
              value={authorsField}
              onChange={(next) => setValue('authors', next)}
              error={errors.authors?.message ?? undefined}
            />
            <TagInputField
              label="Assuntos"
              helpText="Digite os assuntos separados por vírgulas. Assuntos ainda não cadastrados são criados ao salvar."
              placeholder="Nome do assunto..."
              options={subjects}
              value={subjectsField}
              onChange={(next) => setValue('subjects', next)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <SectionTitle>Acervo e Localização</SectionTitle>
            <div>
              <Label htmlFor="availableCopies">Cópias disponíveis</Label>
              <Input id="availableCopies" type="number" min={0} placeholder="1" {...register('availableCopies')} />
            </div>
            <div>
              <Label htmlFor="physicalLocation">Localização física</Label>
              <Input id="physicalLocation" placeholder="Prateleira B3, Corredor 2" {...register('physicalLocation')} />
            </div>
            <div>
              <Label htmlFor="acquisitionType">Tipo de aquisição</Label>
              <NativeSelect
                value={watch('acquisitionType')}
                onChange={(v) => setValue('acquisitionType', v)}
                options={ACQUISITION_OPTIONS}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <SectionTitle>Descrição e Capa</SectionTitle>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" rows={4} placeholder="Sinopse do livro..." {...register('description')} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="coverUrl">URL da capa</Label>
              <Input id="coverUrl" placeholder="https://covers.openlibrary.org/..." {...register('coverUrl')} />
              {coverState === 'searching' && (
                <p className="mt-1 text-[12px] text-muted">Buscando capa pelo ISBN na Amazon...</p>
              )}
              {coverState === 'notfound' && (
                <p className="mt-1 text-[12px] text-muted">
                  Capa não encontrada automaticamente. Preencha manualmente, se desejar.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/admin/livros')}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            <Save className="size-4" /> {isEdit ? 'Salvar alterações' : 'Cadastrar livro'}
          </Button>
        </div>
      </form>
    </div>
  );
}
