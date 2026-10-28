"use strict";
// ============================================================
//  src/routes/addressRoutes.ts
//  Router Buku Alamat Pengguna
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const addressController_js_1 = require("../controllers/addressController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const validatorMiddleware_js_1 = require("../middlewares/validatorMiddleware.js");
const schemas_js_1 = require("../validators/schemas.js");
const router = (0, express_1.Router)();
// Semua rute alamat wajib login
router.use(authMiddleware_js_1.verifyToken);
router.get('/', addressController_js_1.getUserAddresses);
router.get('/:id', addressController_js_1.getAddressById);
router.post('/', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.createAddressSchema), addressController_js_1.createAddress);
router.put('/:id', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.updateAddressSchema), addressController_js_1.updateAddress);
router.delete('/:id', addressController_js_1.deleteAddress);
router.patch('/:id/default', addressController_js_1.setDefaultAddress);
exports.default = router;
//# sourceMappingURL=addressRoutes.js.map