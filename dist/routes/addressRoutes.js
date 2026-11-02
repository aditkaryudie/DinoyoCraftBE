"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const addressController_js_1 = require("../controllers/addressController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const router = (0, express_1.Router)();
router.use(authMiddleware_js_1.verifyToken);
router.get('/', addressController_js_1.getAddresses);
router.post('/', addressController_js_1.createAddress);
router.put('/:id', addressController_js_1.updateAddress);
router.delete('/:id', addressController_js_1.deleteAddress);
router.patch('/:id/default', addressController_js_1.setDefaultAddress);
exports.default = router;
//# sourceMappingURL=addressRoutes.js.map