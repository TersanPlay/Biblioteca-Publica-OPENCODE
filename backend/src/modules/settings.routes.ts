import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { cleanNull, parse, settingsSchema } from '../validation';
import { getSettings } from '../lib/settings';
import { getDoc, updateDoc, createDoc, COLLECTIONS } from '../lib/store';

export const settingsRouter = Router();

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json(settings);
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
    const existing = await getDoc(COLLECTIONS.settings, 'singleton');
    const s = existing
      ? await updateDoc(COLLECTIONS.settings, 'singleton', payload)
      : await createDoc(COLLECTIONS.settings, payload, 'singleton');
    await writeAudit(req.user?.id, 'SETTINGS_UPDATED', 'Setting', 'singleton', data, req.ip);
    res.json(s);
  }),
);
