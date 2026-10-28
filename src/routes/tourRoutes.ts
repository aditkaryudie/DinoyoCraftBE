// ============================================================
//  src/routes/tourRoutes.ts
//  Router Wisata Edukasi Keramik & Master Data
// ============================================================

import { Router } from 'express';
import { getEducationalTours, getMasterData } from '../controllers/tourController.js';

const router = Router();

// Rute Publik (Mobile Workshop & Platform Settings)
router.get('/', getEducationalTours);
router.get('/master-data', getMasterData);

export default router;

