import { useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Label } from '../../components/ui/form-field';
import { NativeSelect } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { TD, TH, TBody, THead, TR, Table } from '../../components/ui/table';
import { reportsApi } from '../../features/api';
import { useApiToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';
import { formatDateTime, formatDate } from '../../lib/format';
import type { ReportResult, ReportType } from '../../types/api';

const REPORT_TYPES: { value: ReportType; label: string; desc: string }[] = [
  { value: 'acervo', label: 'Acervo completo', desc: 'Visão geral do catálogo' },
  { value: 'available', label: 'Livros disponíveis', desc: 'Prontos para empréstimo' },
  { value: 'loaned', label: 'Livros emprestados', desc: 'Fora da estante' },
  { value: 'overdue', label: 'Empréstimos atrasados', desc: 'Devoluções em atraso' },
  { value: 'loans-period', label: 'Empréstimos por período', desc: 'Filtre por data de saída' },
  { value: 'returns-period', label: 'Devoluções por período', desc: 'Filtre por data de retorno' },
  { value: 'active-readers', label: 'Leitores ativos', desc: 'Cadastros em pleno uso' },
  { value: 'top-books', label: 'Livros mais emprestados', desc: 'Ranking de popularidade' },
  { value: 'subjects', label: 'Distribuição por assunto', desc: 'Acervo agrupado por assunto' },
];

const WEEKS: Record<'7d' | '30d' | '90d', { label: string; days: number }> = {
  '7d': { label: '7 dias', days: 7 },
  '30d': { label: '30 dias', days: 30 },
  '90d': { label: '90 dias', days: 90 },
};

export function ReportsPage() {
  const [type, setType] = useState<ReportType>('acervo');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useApiToast();

  const needsPeriod = type === 'loans-period' || type === 'returns-period';

  const generate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const params = needsPeriod
        ? {
            start: new Date(Date.now() - WEEKS[period].days * 86400000).toISOString(),
            end: new Date().toISOString(),
          }
        : undefined;
      setResult(await reportsApi.generate(type, params));
    } catch (err) {
      toast.error('Não foi possível gerar o relatório', apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!result) return;
    const header = result.columns.join(';');
    const lines = result.rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${type}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formattedColumn = (value: string | number | null) => {
    if (value === null || value === undefined || value === '') return '—';
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return formatDateTime(s);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDate(s);
    return s;
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Gerar relatório</CardTitle>
          <p className="text-[13px] text-muted">
            Escolha um modelo e clique em gerar. Os dados podem ser exportados em CSV.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Label>Modelo</Label>
            <NativeSelect
              value={type}
              onChange={(v) => setType(v as ReportType)}
              options={REPORT_TYPES.map((r) => ({ value: r.value, label: r.label }))}
            />
            <p className="mt-1.5 text-[12px] text-muted">
              {REPORT_TYPES.find((r) => r.value === type)?.desc}
            </p>
          </div>
          {needsPeriod && (
            <div className="w-36">
              <Label>Período</Label>
              <NativeSelect
                value={period}
                onChange={(v) => setPeriod(v as '7d' | '30d' | '90d')}
                options={Object.entries(WEEKS).map(([v, w]) => ({ value: v, label: w.label }))}
              />
            </div>
          )}
          <Button onClick={generate} loading={loading}>
            <BarChart3 className="size-4" /> Gerar relatório
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="p-4">
          <Skeleton className="mb-4 h-6 w-56" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="mb-2.5 h-10" />
          ))}
        </Card>
      ) : result ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 p-5 pb-4">
            <div>
              <h2 className="text-[15px] font-bold text-ink">
                {REPORT_TYPES.find((r) => r.value === result.type)?.label ?? result.type}
              </h2>
              <p className="mt-0.5 text-[12px] text-muted">
                Gerado em {formatDateTime(result.generatedAt)} · {result.rows.length} linha{result.rows.length === 1 ? '' : 's'}
                {needsPeriod ? ` · período de ${WEEKS[period].label}` : ''}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={downloadCSV}>
              <Download className="size-4" /> Exportar CSV
            </Button>
          </div>
          {result.rows.length === 0 ? (
            <EmptyState compact title="Sem dados para o período selecionado" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    {result.columns.map((c) => (
                      <TH key={c}>{c}</TH>
                    ))}
                  </TR>
                </THead>
                <TBody>
                  {result.rows.map((row, i) => (
                    <TR key={i}>
                      {row.map((cell, j) => (
                        <TD key={j} className="whitespace-nowrap">
                          {formattedColumn(cell)}
                        </TD>
                      ))}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </Card>
      ) : (
        <Card variant="blue">
          <EmptyState
            compact
            title="Nenhum relatório gerado"
            description="Selecione um modelo acima e clique em gerar."
          />
        </Card>
      )}
    </div>
  );
}