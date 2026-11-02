import { Request, Response } from 'express';
import AiSetting from '../models/AiSetting.js';

export const getAiSettings = async (_req: Request, res: Response) => {
  try {
    const [setting] = await AiSetting.findOrCreate({
      where: { id: 1 },
      defaults: {
        is_auto_reply_active: false,
        model_name: 'gemini-1.5-pro',
        api_key: '',
        system_prompt:
          'Anda adalah Asisten Virtual resmi dari Kampung Keramik Dinoyo. Tugas Anda adalah melayani pelanggan, memberikan info seputar harga dan jadwal bengkel, serta membantu proses pemesanan dengan ramah dan sopan.',
      },
    });
    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal memuat pengaturan.' });
  }
};

export const updateAiSettings = async (req: Request, res: Response) => {
  try {
    const { is_auto_reply_active, model_name, api_key, system_prompt } = req.body;
    await AiSetting.findOrCreate({
      where: { id: 1 },
      defaults: {
        is_auto_reply_active: false,
        model_name: 'gemini-1.5-pro',
        api_key: '',
        system_prompt: '',
      },
    });
    await AiSetting.update(
      { is_auto_reply_active, model_name, api_key, system_prompt },
      { where: { id: 1 } }
    );
    res.json({ success: true, message: 'Pengaturan AI tersimpan.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menyimpan.' });
  }
};
