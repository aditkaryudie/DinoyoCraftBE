// ============================================================
//  src/routes/authRoutes.ts
//  Router Modular: Autentikasi
// ============================================================

import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  validateBody,
  registerValidationRules,
  loginValidationRules,
} from '../middlewares/validatorMiddleware.js';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Registrasi pengguna baru
 * @access  Public
 */
router.post(
  '/register',
  validateBody(registerValidationRules),
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login dan mendapatkan JWT token
 * @access  Public
 */
router.post(
  '/login',
  validateBody(loginValidationRules),
  authController.login
);

/**
 * @route   GET /api/auth/profile
 * @desc    Mendapatkan profil pengguna yang sedang login
 * @access  Protected (semua role)
 */
router.get(
  '/profile',
  verifyToken,
  authController.getProfile
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout dan invalidasi token
 * @access  Protected (semua role)
 */
router.post(
  '/logout',
  verifyToken,
  authController.logout
);

export default router;
