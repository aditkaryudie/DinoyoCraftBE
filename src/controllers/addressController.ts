import { Request, Response } from 'express';
import pool from '../config/database.js';

export const getAddresses = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const [rows]: any = await pool.query(
      'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC',
      [userId]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getAddresses:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar alamat' });
  }
};

export const createAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { label, recipient_name, phone, phone_number, full_address, is_default } = req.body;
    const resolvedPhone = phone || phone_number;
    if (!recipient_name || !resolvedPhone || !full_address) {
      res.status(400).json({ success: false, message: 'Nama penerima, no HP, dan alamat lengkap wajib diisi' });
      return;
    }

    const isDefaultInt = is_default ? 1 : 0;
    if (isDefaultInt === 1) {
      await pool.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    const [result]: any = await pool.query(
      `INSERT INTO user_addresses (user_id, recipient_name, phone, full_address, is_default, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, recipient_name.trim(), String(resolvedPhone).trim(), full_address.trim(), isDefaultInt]
    );

    const [created]: any = await pool.query('SELECT * FROM user_addresses WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Alamat berhasil ditambahkan',
      data: {
        ...created[0],
        label: label || created[0]?.label || 'Rumah',
        phone_number: created[0]?.phone || String(resolvedPhone).trim(),
      }
    });
  } catch (error) {
    console.error('Error createAddress:', error);
    res.status(500).json({ success: false, message: 'Gagal menambahkan alamat' });
  }
};

export const updateAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    const { id } = req.params;
    const { recipient_name, phone, full_address, is_default } = req.body;

    const [check]: any = await pool.query('SELECT id FROM user_addresses WHERE id = ? AND user_id = ?', [id, userId]);
    if (!check || check.length === 0) {
      res.status(404).json({ success: false, message: 'Alamat tidak ditemukan' });
      return;
    }

    const isDefaultInt = is_default ? 1 : 0;
    if (isDefaultInt === 1) {
      await pool.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    await pool.query(
      `UPDATE user_addresses 
       SET recipient_name = COALESCE(?, recipient_name),
           phone = COALESCE(?, phone),
           full_address = COALESCE(?, full_address),
           is_default = COALESCE(?, is_default)
       WHERE id = ? AND user_id = ?`,
      [recipient_name ?? null, phone ?? null, full_address ?? null, is_default !== undefined ? isDefaultInt : null, id, userId]
    );

    const [updated]: any = await pool.query('SELECT * FROM user_addresses WHERE id = ?', [id]);
    res.status(200).json({ success: true, message: 'Alamat berhasil diperbarui', data: updated[0] });
  } catch (error) {
    console.error('Error updateAddress:', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui alamat' });
  }
};

export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    const { id } = req.params;

    const [result]: any = await pool.query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [id, userId]);
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'Alamat tidak ditemukan' });
      return;
    }

    res.status(200).json({ success: true, message: 'Alamat berhasil dihapus' });
  } catch (error) {
    console.error('Error deleteAddress:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus alamat' });
  }
};

export const setDefaultAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    const { id } = req.params;

    await pool.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    const [result]: any = await pool.query('UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [id, userId]);

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'Alamat tidak ditemukan' });
      return;
    }

    res.status(200).json({ success: true, message: 'Alamat default berhasil disetel' });
  } catch (error) {
    console.error('Error setDefaultAddress:', error);
    res.status(500).json({ success: false, message: 'Gagal menyetel alamat default' });
  }
};

