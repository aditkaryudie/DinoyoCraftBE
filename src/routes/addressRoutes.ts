// ============================================================
//  src/routes/addressRoutes.ts
//  Router Buku Alamat Pengguna
// ============================================================

import { Router } from 'express';
import {
  getUserAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/addressController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import { createAddressSchema, updateAddressSchema } from '../validators/schemas.js';

const router = Router();

// Semua rute alamat wajib login
router.use(verifyToken);

router.get('/', getUserAddresses);
router.get('/:id', getAddressById);
router.post('/', validateZod(createAddressSchema), createAddress);
router.put('/:id', validateZod(updateAddressSchema), updateAddress);
router.delete('/:id', deleteAddress);
router.patch('/:id/default', setDefaultAddress);

export default router;
