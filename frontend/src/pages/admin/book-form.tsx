import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, Save, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { FieldError, Label } from '../../components/ui/form-field';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { Textarea } from '../../components/ui/textarea';
import { authorsApi, booksApi, categoriesApi } from '../../features/api';
import { useToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';
import { isValidIsbn10, isValidIsbn13 } from '../../lib/isbn';
import type { Author, Book, BookFormValues, BookRef, Category } from '../../types/api';

const DUPLICATE_MESSAGE: Record<'isbn10' | 'isbn13', string> = {
  isbn10: 'Já existe um livro cadastrado com este ISBN-10.',
  isbn13: 'Já existe um livro cadastrado com este ISBN-13.',
};

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
  categories: z.array(z.object({ id: z.number().nullable(), name: z.string().trim().min(1) })),
  authors: z
    .array(z.object({ id: z.number().nullable(), name: z.string().trim().min(1) }))
    .min(1, 'Informe ao menos um autor'),
});

export function BookFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [book, setBook] = useState<Book | null>(null);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [coverState, setCoverState] = useState<'idle' | 'searching' | 'notfound'>('idle');
  const [duplicate, setDuplicate] = useState<{ field: 'isbn10' | 'isbn13'; book: BookRef } | null>(null);

  const { register, handleSubmit, setValue, watch, reset, setError, clearErrors, formState: { errors } } = useForm<BookFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '', subtitle: '', isbn10: '', isbn13: '', description: '', publisher: '',
      edition: '', publicationYear: '', language: 'Português', pages: '', coverUrl: '',
      categories: [], authors: [],
    },
  });

  useEffect(() => {
    Promise.all([authorsApi.all(), categoriesApi.all()])
      .then(([a, c]) => {
        setAuthors(a);
        setCategories(c);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    booksApi
      .get(Number(id))
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
          categories: b.categories.map((c) => ({ id: c.id, name: c.name })),
          authors: b.authors.map((a) => ({ id: a.author.id, name: a.author.name })),
        });
      })
      .catch((err) => {
        toast('error', 'Não foi possível carregar o livro', apiErrorMessage(err));
        navigate('/admin/livros');
      })
      .finally(() => setLoading(false));
  }, [id, isEdit, reset, navigate, toast]);

  const authorsField = watch('authors');
  const [authorInput, setAuthorInput] = useState('');
  const [authorOpen, setAuthorOpen] = useState(false);
  const categoriesField = watch('categories');
  const [categoryInput, setCategoryInput] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const selectedCategoryIds = useMemo(
    () => new Set(categoriesField.filter((c) => c.id != null).map((c) => c.id)),
    [categoriesField],
  );
  const categorySuggestions = useMemo(() => {
    const q = categoryInput.trim().toLowerCase();
    if (!q) return [];
    const rank = (c: Category) =>
      c.name.toLowerCase() === q ? 0 : c.name.toLowerCase().startsWith(q) ? 1 : 2;
    return categories
      .filter((c) => !selectedCategoryIds.has(c.id))
      .filter((c) => !categoriesField.some((s) => s.name.toLowerCase() === c.name.toLowerCase()))
      .filter((c) => c.name.toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [categories, categoryInput, selectedCategoryIds, categoriesField]);

  const addCategoryNames = (raw: string) => {
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      setCategoryOpen(false);
      return;
    }
    const next = [...categoriesField];
    for (const part of parts) {
      if (next.some((c) => c.name.toLowerCase() === part.toLowerCase())) continue;
      const matched = categories.find((c) => c.name.toLowerCase() === part.toLowerCase());
      next.push(matched ? { id: matched.id, name: matched.name } : { id: null as number | null, name: part });
    }
    setValue('categories', next);
    setCategoryInput('');
    setCategoryOpen(false);
  };

  const removeCategory = (index: number) => {
    setValue(
      'categories',
      categoriesField.filter((_, i) => i !== index),
    );
  };
  const selectedAuthorIds = useMemo(
    () => new Set(authorsField.filter((a) => a.id != null).map((a) => a.id)),
    [authorsField],
  );
  const suggestions = useMemo(() => {
    const q = authorInput.trim().toLowerCase();
    if (!q) return [];
    const rank = (a: Author) =>
      a.name.toLowerCase() === q ? 0 : a.name.toLowerCase().startsWith(q) ? 1 : 2;
    return authors
      .filter((a) => !selectedAuthorIds.has(a.id))
      .filter((a) => a.name.toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [authors, authorInput, selectedAuthorIds]);

  const addAuthorNames = (raw: string) => {
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      setAuthorOpen(false);
      return;
    }
    const next = [...authorsField];
    for (const part of parts) {
      if (next.some((a) => a.name.toLowerCase() === part.toLowerCase())) continue;
      const matched = authors.find((a) => a.name.toLowerCase() === part.toLowerCase());
      next.push(matched ? { id: matched.id, name: matched.name } : { id: null as number | null, name: part });
    }
    setValue('authors', next);
    setAuthorInput('');
    setAuthorOpen(false);
  };

  const removeAuthor = (index: number) => {
    setValue(
      'authors',
      authorsField.filter((_, i) => i !== index),
    );
  };

  const isbn10 = watch('isbn10');
  const isbn13 = watch('isbn13');
  const coverUrl = watch('coverUrl');

  useEffect(() => {
    const candidate = [isbn10, isbn13]
      .map((v) => v.trim())
      .find((v) => isValidIsbn10(v) || isValidIsbn13(v));
    if (!candidate || coverUrl.trim() !== '') return;
    setCoverState('idle');
    const timer = setTimeout(() => {
      setCoverState('searching');
      booksApi
        .cover(candidate)
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
              info.authors.slice(0, 6).map((name) => ({ id: null as number | null, name })),
            );
          }
          if (info.categories.length > 0 && watch('categories').length === 0) {
            setValue(
              'categories',
              info.categories.slice(0, 4).map((name) => ({ id: null as number | null, name })),
            );
          }
          setCoverState('idle');
        })
        .catch(() => setCoverState('notfound'));
    }, 900);
    return () => clearTimeout(timer);
  }, [isbn10, isbn13, coverUrl, setValue]);

  useEffect(() => {
    const check: Array<{ field: 'isbn10' | 'isbn13'; value: string }> = [
      { field: 'isbn10', value: isbn10 },
      { field: 'isbn13', value: isbn13 },
    ];
    const timer = setTimeout(() => {
      (async () => {
        let found: { field: 'isbn10' | 'isbn13'; book: BookRef } | null = null;
        for (const item of check) {
          const value = item.value.trim();
          if (!value) continue;
          const valid = item.field === 'isbn10' ? isValidIsbn10(value) : isValidIsbn13(value);
          if (!valid) continue;
          try {
            const { book } = await booksApi.exists(value, isEdit ? Number(id) : undefined);
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
    return () => clearTimeout(timer);
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
        await booksApi.update(Number(id), values);
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (authorInput.trim()) addAuthorNames(authorInput);
          if (categoryInput.trim()) addCategoryNames(categoryInput);
          void handleSubmit(submit)(e);
        }}
        className="space-y-5"
      >
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-primary-dark"
                >
                  <BookOpen className="size-4" /> Ver livro
                </Link>
              </div>
            )}
            <div className="sm:col-span-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" rows={4} placeholder="Sinopse do livro..." {...register('description')} />
            </div>
            <div>
              <Label htmlFor="publisher">Editora</Label>
              <Input id="publisher" placeholder="Companhia das Letras" {...register('publisher')} />
            </div>
            <div>
              <Label htmlFor="language">Idioma</Label>
              <Input id="language" placeholder="Português" {...register('language')} />
            </div>
            <div>
              <Label htmlFor="edition">Edição</Label>
              <Input id="edition" type="number" min={1} placeholder="1" {...register('edition')} />
            </div>
            <div>
              <Label htmlFor="publicationYear">Ano de publicação</Label>
              <Input id="publicationYear" type="number" min={1000} max={2100} placeholder="1899" {...register('publicationYear')} />
            </div>
            <div>
              <Label htmlFor="pages">Páginas</Label>
              <Input id="pages" type="number" min={1} placeholder="256" {...register('pages')} />
            </div>
            <div>
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

        <Card>
          <CardContent>
            <Label>Categorias</Label>
            <p className="mb-3 text-[12.5px] text-muted">
              Digite as categorias separadas por vírgulas (ex.: viagem, advocacia, ação). Categorias ainda
              não cadastradas são criadas ao salvar.
            </p>
            <div className="relative">
              <Input
                value={categoryInput}
                onChange={(e) => {
                  setCategoryInput(e.target.value);
                  setCategoryOpen(true);
                }}
                onFocus={() => setCategoryOpen(true)}
                onBlur={() => setTimeout(() => setCategoryOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (categorySuggestions.length > 0 && !categoryInput.includes(',')) addCategoryNames(categorySuggestions[0].name);
                    else addCategoryNames(categoryInput);
                  } else if (e.key === 'Escape') {
                    setCategoryOpen(false);
                  }
                }}
                placeholder="Nome da categoria..."
              />
              {categoryOpen && categorySuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-control bg-surface shadow-card hairline">
                  {categorySuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addCategoryNames(c.name);
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13.5px] font-semibold text-ink transition-colors duration-150 hover:bg-surfaceWarm"
                    >
                      <Check className="size-3.5 text-primary" />
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {categoriesField.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {categoriesField.map((c, i) => (
                  <span
                    key={`${c.name}-${i}`}
                    className={`inline-flex items-center gap-1.5 rounded-full py-1.5 pl-3.5 pr-1.5 text-[13px] font-semibold transition-all duration-200 [transition-timing-function:var(--ease)] ${
                      c.id == null
                        ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-300'
                        : 'bg-primary text-white shadow-card'
                    }`}
                  >
                    {c.name}
                    {c.id == null && (
                      <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-700">
                        novo
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeCategory(i)}
                      aria-label={`Remover categoria ${c.name}`}
                      className={`rounded-full p-1 transition-colors duration-150 ${
                        c.id == null ? 'hover:bg-amber-100' : 'hover:bg-primary-dark'
                      }`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Label>Autores</Label>
            <p className="mb-3 text-[12.5px] text-muted">
              Digite os autores separados por vírgulas (ex.: Shawn Peters, Vibrant Publishers). Nomes ainda não
              cadastrados são criados ao salvar.
            </p>
            <div className="relative">
              <Input
                value={authorInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.endsWith(',') || (v.includes(',') && v.trim().length > 1)) addAuthorNames(v);
                  else { setAuthorInput(v); setAuthorOpen(true); }
                }}
                onFocus={() => setAuthorOpen(true)}
                onBlur={() => setTimeout(() => setAuthorOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (suggestions.length > 0 && !authorInput.includes(',')) addAuthorNames(suggestions[0].name);
                    else addAuthorNames(authorInput);
                  } else if (e.key === 'Escape') {
                    setAuthorOpen(false);
                  }
                }}
                placeholder="Nome do autor..."
              />
              {authorOpen && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-control bg-surface shadow-card hairline">
                  {suggestions.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addAuthorNames(a.name);
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13.5px] font-semibold text-ink transition-colors duration-150 hover:bg-surfaceWarm"
                    >
                      <Check className="size-3.5 text-primary" />
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {authorsField.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {authorsField.map((a, i) => (
                  <span
                    key={`${a.name}-${i}`}
                    className={`inline-flex items-center gap-1.5 rounded-full py-1.5 pl-3.5 pr-1.5 text-[13px] font-semibold transition-all duration-200 [transition-timing-function:var(--ease)] ${
                      a.id == null
                        ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-300'
                        : 'bg-primary text-white shadow-card'
                    }`}
                  >
                    {a.name}
                    {a.id == null && (
                      <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-700">
                        novo
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAuthor(i)}
                      aria-label={`Remover autor ${a.name}`}
                      className={`rounded-full p-1 transition-colors duration-150 ${
                        a.id == null ? 'hover:bg-amber-100' : 'hover:bg-primary-dark'
                      }`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {errors.authors && <FieldError message={errors.authors.message ?? 'Informe ao menos um autor'} />}
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
