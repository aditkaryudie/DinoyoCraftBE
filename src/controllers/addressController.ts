// ============================================================
//  src/controllers/addressController.ts
//  Controller Buku Alamat Pengiriman Pengguna
// ============================================================

import { Request, Response } from 'express';
import pool from '../config/database.js';
import { sendSuccess, sendCreated, sendNotFound, sendError } from '../utils/response.js';

export const getUserAddresses = async (_req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    const [rows]: any = await pool.query(
      `SELECT id, recipient_name, phone, full_address, city, postal_code, label, is_default, created_at 
       FROM user_addresses 
       WHERE user_id = ? 
       ORDER BY is_default DESC, id DESC`,
      [userId]
    );

    sendSuccess(res, rows, 'Daftar alamat berhasil diambil.');
  } catch (error) {
    console.error('❌ [getUserAddresses] Error:', error);
    sendError(res, 'Gagal mengambil daftar alamat.');
  }
};

export const getAddressById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    const { id } = req.params;

    const [rows]: any = await pool.query(
      `SELECT id, recipient_name, phone, full_address, city, postal_code, label, is_default, created_at 
       FROM user_addresses 
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (rows.length === 0) {
      sendNotFound(res, 'Alamat tidak ditemukan.');
      return;
    }

    sendSuccess(res, rows[0], 'Detail alamat berhasil diambil.');
  } catch (error) {
    console.error('❌ [getAddressById] Error:', error);
    sendError(res, 'Gagal mengambil detail alamat.');
  }
};

export const createAddress = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const userId = res.locals['userId'];
    const { recipient_name, phone, full_address, city, postal_code, label = 'Rumah', is_default = false } = req.body;

    // Jika diset sebagai default atau ini alamat pertama, jadikan default
    const [countRows]: any = await connection.query('SELECT COUNT(*) as total FROM user_addresses WHERE user_id = ?', [userId]);
    const isFirstAddress = countRows[0]?.total === 0;
    const shouldBeDefault = is_default || isFirstAddress;

    if (shouldBeDefault) {
      await connection.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    const [result]: any = await connection.query(
      `INSERT INTO user_addresses (user_id, recipient_name, phone, full_address, city, postal_code, label, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, recipient_name, phone, full_address, city || null, postal_code || null, label, shouldBeDefault ? 1 : 0]
    );

    await connection.commit();

    const [newAddress]: any = await pool.query('SELECT * FROM user_addresses WHERE id = ?', [result.insertId]);
    sendCreated(res, newAddress[0], 'Alamat berhasil ditambahkan.');
  } catch (error) {
    await connection.rollback();
    console.error('❌ [createAddress] Error:', error);
    sendError(res, 'Gagal menambahkan alamat.');
  } finally {
    connection.release();
  }
};

export const updateAddress = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const userId = res.locals['userId'];
    const { id } = req.params;
    const { recipient_name, phone, full_address, city, postal_code, label, is_default } = req.body;

    const [existing]: any = await connection.query(
      'SELECT id FROM user_addresses WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (existing.length === 0) {
      await connection.rollback();
      sendNotFound(res, 'Alamat tidak ditemukan.');
      return;
    }

    if (is_default) {
      await connection.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    await connection.query(
      `UPDATE user_addresses SET 
         recipient_name = COALESCE(?, recipient_name),
         phone = COALESCE(?, phone),
         full_address = COALESCE(?, full_address),
         city = COALESCE(?, city),
         postal_code = COALESCE(?, postal_code),
         label = COALESCE(?, label),
         is_default = COALESCE(?, is_default)
       WHERE id = ? AND user_id = ?`,
      [recipient_name, phone, full_address, city, postal_code, label, is_default !== undefined ? (is_default ? 1 : 0) : null, id, userId]
    );

    await connection.commit();

    const [updated]: any = await pool.query('SELECT * FROM user_addresses WHERE id = ?', [id]);
    sendSuccess(res, updated[0], 'Alamat berhasil diperbarui.');
  } catch (error) {
    await connection.rollback();
    console.error('❌ [updateAddress] Error:', error);
    sendError(res, 'Gagal memperbarui alamat.');
  } finally {
    connection.release();
  }
};

export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    const { id } = req.params;

    const [result]: any = await pool.query(
      'DELETE FROM user_addresses WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      sendNotFound(res, 'Alamat tidak ditemukan.');
      return;
    }

    sendSuccess(res, null, 'Alamat berhasil dihapus.');
  } catch (error) {
    console.error('❌ [deleteAddress] Error:', error);
    sendError(res, 'Gagal menghapus alamat.');
  }
};

export const setDefaultAddress = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const userId = res.locals['userId'];
    const { id } = req.params;

    const [check]: any = await connection.query(
      'SELECT id FROM user_addresses WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (check.length === 0) {
      await connection.rollback();
      sendNotFound(res, 'Alamat tidak ditemukan.');
      return;
    }

    await connection.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    await connection.query('UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [id, userId]);

    await connection.commit();
    sendSuccess(res, null, 'Alamat utama berhasil diubah.');
  } catch (error) {
    await connection.rollback();
    console.error('❌ [setDefaultAddress] Error:', error);
    sendError(res, 'Gagal mengubah alamat default.');
  } finally {
    connection.release();
  }
};
