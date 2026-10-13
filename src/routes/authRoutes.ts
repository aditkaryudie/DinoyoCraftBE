// ============================================================
//  src/routes/authRoutes.ts
//  Router Modular: Autentikasi
// ============================================================

import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { register, login, googleLogin } from '../controllers/authController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  validateBody,
  registerValidationRules,
  loginValidationRules,
} from '../middlewares/validatorMiddleware.js';
import { uploadRegistrationDocs } from '../middlewares/uploadMiddleware.js';

const router = Router();

/**
 * @route   POST /api/auth/google-login
 * @desc    Login/Register dengan Google OAuth
 * @access  Public
 */
router.post(
  '/google-login',
  authController.googleLogin
);

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

/**
 * @route   POST /api/auth/upload-documents
 * @desc    Upload dokumen registrasi mitra (KTP, NIB, foto produk)
 * @access  Protected (mitra baru)
 */
router.post(
  '/upload-documents',
  verifyToken,
  uploadRegistrationDocs,
  authController.uploadRegistrationDocuments
);

export default router;
