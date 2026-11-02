"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAiSettings = exports.getAiSettings = void 0;
const AiSetting_js_1 = __importDefault(require("../models/AiSetting.js"));
const getAiSettings = async (_req, res) => {
    try {
        const [setting] = await AiSetting_js_1.default.findOrCreate({
            where: { id: 1 },
            defaults: {
                is_auto_reply_active: false,
                model_name: 'gemini-1.5-pro',
                api_key: '',
                system_prompt: 'Anda adalah Asisten Virtual resmi dari Kampung Keramik Dinoyo. Tugas Anda adalah melayani pelanggan, memberikan info seputar harga dan jadwal bengkel, serta membantu proses pemesanan dengan ramah dan sopan.',
            },
        });
        res.json({ success: true, data: setting });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memuat pengaturan.' });
    }
};
exports.getAiSettings = getAiSettings;
const updateAiSettings = async (req, res) => {
    try {
        const { is_auto_reply_active, model_name, api_key, system_prompt } = req.body;
        await AiSetting_js_1.default.findOrCreate({
            where: { id: 1 },
            defaults: {
                is_auto_reply_active: false,
                model_name: 'gemini-1.5-pro',
                api_key: '',
                system_prompt: '',
            },
        });
        await AiSetting_js_1.default.update({ is_auto_reply_active, model_name, api_key, system_prompt }, { where: { id: 1 } });
        res.json({ success: true, message: 'Pengaturan AI tersimpan.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menyimpan.' });
    }
};
exports.updateAiSettings = updateAiSettings;
//# sourceMappingURL=aiSettingController.js.map