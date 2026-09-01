import { getDoc, COLLECTIONS } from './store';

export interface LibrarySettings {
  loanLimit: number;
  defaultLoanDays: number;
  maxRenewals: number;
  libraryName: string;
  libraryAddress: string | null;
  libraryPhone: string | null;
  libraryEmail: string | null;
  libraryHours: string | null;
}

const DEFAULTS: LibrarySettings = {
  loanLimit: 4,
  defaultLoanDays: 15,
  maxRenewals: 1,
  libraryName: '',
  libraryAddress: null,
  libraryPhone: null,
  libraryEmail: null,
  libraryHours: null,
};

export async function getSettings(): Promise<LibrarySettings> {
  const s = await getDoc(COLLECTIONS.settings, 'singleton');
  if (!s) return { ...DEFAULTS };
  return {
    loanLimit: s.loanLimit ?? DEFAULTS.loanLimit,
    defaultLoanDays: s.defaultLoanDays ?? DEFAULTS.defaultLoanDays,
    maxRenewals: s.maxRenewals ?? DEFAULTS.maxRenewals,
    libraryName: s.libraryName ?? DEFAULTS.libraryName,
    libraryAddress: s.libraryAddress ?? DEFAULTS.libraryAddress,
    libraryPhone: s.libraryPhone ?? DEFAULTS.libraryPhone,
    libraryEmail: s.libraryEmail ?? DEFAULTS.libraryEmail,
    libraryHours: s.libraryHours ?? DEFAULTS.libraryHours,
  };
}
