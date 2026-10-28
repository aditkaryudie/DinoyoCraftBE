// ============================================================
//  src/controllers/tourController.ts
//  Controller Wisata Edukasi Keramik & Master Data
// ============================================================

import { Request, Response } from 'express';
import pool from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getEducationalTours = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, title, description, image_url, whatsapp_number, created_at 
       FROM educational_tours 
       ORDER BY id ASC`
    );

    sendSuccess(res, rows, 'Daftar wisata edukasi keramik berhasil diambil.');
  } catch (error) {
    console.error('❌ [getEducationalTours] Error:', error);
    sendError(res, 'Gagal mengambil data wisata edukasi.');
  }
};

export const getMasterData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;

    let query = 'SELECT id, category, `key`, value, description FROM master_data';
    const params: any[] = [];

    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }
    query += ' ORDER BY id ASC';

    const [rows]: any = await pool.query(query, params);
    sendSuccess(res, rows, 'Master data berhasil diambil.');
  } catch (error) {
    console.error('❌ [getMasterData] Error:', error);
    sendError(res, 'Gagal mengambil master data.');
  }
};
