import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/form-field';
import { Input } from '../../components/ui/input';
import { readersApi } from '../../features/api';
import { useApiToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';
import { formatCPF, formatPhone, onlyDigits } from '../../lib/format';
import type { Reader } from '../../types/api';

const schema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  cpf: z
    .string()
    .refine((v) => onlyDigits(v).length === 11, 'CPF deve ter 11 dígitos'),
  birthDate: z.string(),
  phone: z.string(),
  email: z.string().email('E-mail inválido').or(z.literal('')),
  cep: z.string(),
  address: z.string(),
  number: z.string(),
  neighborhood: z.string(),
  city: z.string(),
  state: z.string(),
});

export type ReaderFormValues = z.infer<typeof schema>;

const EMPTY: ReaderFormValues = {
  name: '', cpf: '', birthDate: '', phone: '', email: '',
  cep: '', address: '', number: '', neighborhood: '', city: '', state: '',
};

interface ReaderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reader?: Reader | null;
  onSaved?: () => void;
}

export function ReaderFormDialog({ open, onOpenChange, reader, onSaved }: ReaderFormDialogProps) {
  const isEdit = !!reader;
  const [busy, setBusy] = useState(false);
  const { toast } = useApiToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReaderFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    if (reader) {
      reset({
        name: reader.name,
        cpf: formatCPF(reader.cpf),
        birthDate: reader.birthDate ? reader.birthDate.slice(0, 10) : '',
        phone: reader.phone ? formatPhone(reader.phone) : '',
        email: reader.email ?? '',
        cep: reader.cep ?? '',
        address: reader.address ?? '',
        number: reader.number ?? '',
        neighborhood: reader.neighborhood ?? '',
        city: reader.city ?? '',
        state: reader.state ?? '',
      });
    } else {
      reset(EMPTY);
    }
  }, [open, reader, reset]);

  const submit = async (v: ReaderFormValues) => {
    const payload = {
      name: v.name,
      cpf: onlyDigits(v.cpf),
      birthDate: v.birthDate || undefined,
      phone: v.phone || undefined,
      email: v.email || undefined,
      cep: v.cep ? onlyDigits(v.cep) : undefined,
      address: v.address || undefined,
      number: v.number || undefined,
      neighborhood: v.neighborhood || undefined,
      city: v.city || undefined,
      state: v.state || undefined,
    };
    setBusy(true);
    try {
      if (isEdit && reader) await readersApi.update(reader.$id, payload);
      else await readersApi.create(payload);
      toast.success(isEdit ? 'Leitor atualizado' : 'Leitor cadastrado');
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error('Não foi possível salvar', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader
          title={isEdit ? 'Editar leitor' : 'Novo leitor'}
          description="Dados de identificação e contato."
        />
        <form onSubmit={handleSubmit(submit)}>
          <DialogBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Nome completo *</Label>
                <Input placeholder="Maria da Silva" error={errors.name?.message} {...register('name')} />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input
                  placeholder="123.456.789-00"
                  error={errors.cpf?.message}
                  inputMode="numeric"
                  {...register('cpf')}
                />
              </div>
              <div>
                <Label>Data de nascimento</Label>
                <Input type="date" {...register('birthDate')} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input placeholder="(11) 99999-9999" {...register('phone')} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" placeholder="maria@email.com" error={errors.email?.message} {...register('email')} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input placeholder="01234-000" {...register('cep')} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input placeholder="SP" {...register('state')} />
              </div>
              <div className="sm:col-span-2">
                <Label>Endereço</Label>
                <Input placeholder="Rua das Flores, 100" {...register('address')} />
              </div>
              <div>
                <Label>Número</Label>
                <Input placeholder="100" {...register('number')} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input placeholder="Centro" {...register('neighborhood')} />
              </div>
              <div className="sm:col-span-2">
                <Label>Cidade</Label>
                <Input placeholder="São Paulo" {...register('city')} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>{isEdit ? 'Salvar alterações' : 'Cadastrar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
