import { Router } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { cleanNull, parse, settingsSchema } from '../validation';

export const settingsRouter = Router();

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const s = await prisma.setting.findUnique({ where: { id: 1 } });
    res.json({
      loanLimit: s?.loanLimit ?? 4,
      defaultLoanDays: s?.defaultLoanDays ?? 15,
      maxRenewals: s?.maxRenewals ?? 1,
      libraryName: s?.libraryName ?? '',
      libraryAddress: s?.libraryAddress ?? null,
      libraryPhone: s?.libraryPhone ?? null,
      libraryEmail: s?.libraryEmail ?? null,
      libraryHours: s?.libraryHours ?? null,
    });
  }),
);

settingsRouter.put(
  '/',
  requireAuth,
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = parse(settingsSchema, req.body);
    const payload = {
      loanLimit: data.loanLimit,
      defaultLoanDays: data.defaultLoanDays,
      maxRenewals: data.maxRenewals,
      libraryName: data.libraryName,
      libraryAddress: cleanNull(data.libraryAddress),
      libraryPhone: cleanNull(data.libraryPhone),
      libraryEmail: cleanNull(data.libraryEmail),
      libraryHours: cleanNull(data.libraryHours),
    };
    const s = await prisma.setting.upsert({
      where: { id: 1 },
      update: payload,
      create: { id: 1, ...payload },
    });
    await writeAudit(req.user?.id, 'SETTINGS_UPDATED', 'Setting', 1, data, req.ip);
    res.json(s);
  }),
);