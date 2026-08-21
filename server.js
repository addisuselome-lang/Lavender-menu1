const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
require('dotenv').config();

const { query } = require('./db');

const app = express();
const port = Number(process.env.PORT || 5000);
const uploadDirectory = path.join(__dirname, 'uploads');
const authSecret = process.env.AUTH_SECRET;

if (!authSecret) throw new Error('AUTH_SECRET must be configured in .env');

fs.mkdir(uploadDirectory, { recursive: true }).catch((error) => {
  console.error('Could not create uploads directory:', error.message);
});

const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map((origin) => origin.trim());
app.use(cors({ origin: allowedOrigins.includes('*') ? true : allowedOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDirectory));
app.use('/menu-images', express.static(path.join(__dirname, 'menu-images')));
const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, uploadDirectory),
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype.startsWith('image/')) return callback(null, true);
    callback(new Error('Only image files are allowed'));
  },
});

function createToken(username) {
  const payload = Buffer.from(JSON.stringify({ username, expiresAt: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', authSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function requireAdmin(request, response, next) {
  const token = request.headers.authorization?.startsWith('Bearer ')
    ? request.headers.authorization.slice(7)
    : '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return response.status(401).json({ success: false, error: 'Authentication required' });
  const expected = crypto.createHmac('sha256', authSecret).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return response.status(401).json({ success: false, error: 'Invalid authentication token' });
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.username || data.expiresAt < Date.now()) throw new Error('Expired token');
    request.adminUsername = data.username;
    return next();
  } catch (_error) {
    return response.status(401).json({ success: false, error: 'Invalid authentication token' });
  }
}

function toMenuItem(item) {
  const available = item.is_available !== 0 && item.is_available !== false;
  return {
    ...item,
    price: Number(item.price),
    is_available: available,
    available,
    category_key: item.category,
    img: item.image_url || '',
    name_am: item.name_am || item.name || '',
    name_en: item.name_en || item.name || '',
    desc_am: item.description_am || item.description || '',
    desc_en: item.description_en || item.description || '',
  };
}

app.get('/api/menu', async (_request, response, next) => {
  try {
    const items = await query('SELECT id, name, name_am, name_en, category, price, description, description_am, description_en, image_url, is_available, created_at FROM menu_items ORDER BY category, name_en, name');
    response.json(items.map(toMenuItem));
  } catch (error) { next(error); }
});

app.get('/api/categories', async (_request, response, next) => {
  try {
    const rows = await query('SELECT id, category_key AS `key`, name_am, name_en, icon, hero_image_url AS hero_img, description_am, description_en, is_active AS active FROM categories WHERE is_active = 1 ORDER BY id');
    response.json(rows);
  } catch (error) { next(error); }
});

app.get('/api/payment', async (_request, response, next) => {
  try {
    const rows = await query('SELECT id, method_key AS bank_key, method_name AS bank_name, account_holder, account_number, dial_code, instructions_am, instructions_en, color, is_active AS active FROM payment_methods WHERE is_active = 1 ORDER BY id');
    response.json(rows);
  } catch (error) { next(error); }
});

app.post('/api/admin/login', async (request, response, next) => {
  try {
    const { username, password } = request.body || {};
    if (!username || !password) return response.status(400).json({ success: false, error: 'Username and password are required' });
    const admins = await query('SELECT id, username, password_hash FROM admin WHERE username = ?', [username]);
    const valid = admins.length > 0 && await bcrypt.compare(password, admins[0].password_hash);
    if (!valid) return response.status(401).json({ success: false, error: 'Invalid credentials' });
    response.json({ success: true, token: createToken(admins[0].username), admin: { id: admins[0].id, username: admins[0].username } });
  } catch (error) { next(error); }
});

app.put('/api/admin/change-password', requireAdmin, async (request, response, next) => {
  try {
    const { oldPassword, newPassword } = request.body || {};
    if (!oldPassword || !newPassword || newPassword.length < 8) return response.status(400).json({ success: false, error: 'Old password and a new password of at least 8 characters are required' });
    const admins = await query('SELECT id, password_hash FROM admin WHERE username = ?', [request.adminUsername]);
    if (!admins.length || !await bcrypt.compare(oldPassword, admins[0].password_hash)) return response.status(401).json({ success: false, error: 'Old password is incorrect' });
    await query('UPDATE admin SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 12), admins[0].id]);
    response.json({ success: true, message: 'Password changed successfully' });
  } catch (error) { next(error); }
});

app.post('/api/admin/menu', requireAdmin, upload.single('image'), async (request, response, next) => {
  try {
    const { name, name_am, name_en, category, price, description = '', description_am = '', description_en = '', is_available = true } = request.body;
    const nameAm = name_am || name || '';
    const nameEn = name_en || name || '';
    if (!nameAm || !nameEn || !category || price === undefined || Number.isNaN(Number(price))) return response.status(400).json({ success: false, error: 'Both names, category, and a valid price are required' });
    const imageUrl = request.file ? `/uploads/${request.file.filename}` : (request.body.image_url || null);
    const result = await query('INSERT INTO menu_items (name, name_am, name_en, category, price, description, description_am, description_en, image_url, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [nameEn, nameAm, nameEn, category, Number(price), description || description_en || description_am, description_am || description, description_en || description, imageUrl, is_available === 'false' ? 0 : Boolean(is_available)]);
    const items = await query('SELECT * FROM menu_items WHERE id = ?', [result.insertId]);
    response.status(201).json({ success: true, item: toMenuItem(items[0]) });
  } catch (error) { if (request.file) await fs.unlink(request.file.path).catch(() => {}); next(error); }
});

app.put('/api/admin/menu/:id', requireAdmin, upload.single('image'), async (request, response, next) => {
  try {
    const current = await query('SELECT * FROM menu_items WHERE id = ?', [request.params.id]);
    if (!current.length) return response.status(404).json({ success: false, error: 'Menu item not found' });
    const item = current[0];
    const fields = ['name', 'name_am', 'name_en', 'category', 'price', 'description', 'description_am', 'description_en'];
    const updates = [];
    const values = [];
    for (const field of fields) if (request.body[field] !== undefined) { updates.push(`${field} = ?`); values.push(field === 'price' ? Number(request.body[field]) : request.body[field]); }
    if (request.body.name_am !== undefined && request.body.name_en === undefined) { updates.push('name_en = ?'); values.push(request.body.name_am); }
    if (request.body.name_en !== undefined && request.body.name_am === undefined) { updates.push('name_am = ?'); values.push(request.body.name_en); }
    if (request.body.is_available !== undefined) { updates.push('is_available = ?'); values.push(request.body.is_available === 'false' || request.body.is_available === false ? 0 : 1); }
    if (request.body.image_url !== undefined && !request.file) { updates.push('image_url = ?'); values.push(request.body.image_url || null); }
    if (request.file) { updates.push('image_url = ?'); values.push(`/uploads/${request.file.filename}`); }
    if (!updates.length) return response.status(400).json({ success: false, error: 'No fields to update' });
    values.push(request.params.id);
    await query(`UPDATE menu_items SET ${updates.join(', ')} WHERE id = ?`, values);
    if (request.file && item.image_url) await fs.unlink(path.join(__dirname, item.image_url.replace(/^\/uploads\//, ''))).catch(() => {});
    const updated = await query('SELECT * FROM menu_items WHERE id = ?', [request.params.id]);
    response.json({ success: true, item: toMenuItem(updated[0]) });
  } catch (error) { if (request.file) await fs.unlink(request.file.path).catch(() => {}); next(error); }
});

app.delete('/api/admin/menu/:id', requireAdmin, async (request, response, next) => {
  try {
    const items = await query('SELECT image_url FROM menu_items WHERE id = ?', [request.params.id]);
    if (!items.length) return response.status(404).json({ success: false, error: 'Menu item not found' });
    await query('DELETE FROM menu_items WHERE id = ?', [request.params.id]);
    if (items[0].image_url) await fs.unlink(path.join(__dirname, items[0].image_url.replace(/^\/uploads\//, ''))).catch(() => {});
    response.json({ success: true, message: 'Menu item deleted' });
  } catch (error) { next(error); }
});

app.get('/api/admin/categories', requireAdmin, async (_request, response, next) => {
  try { response.json(await query('SELECT id, category_key AS `key`, name_am, name_en, icon, hero_image_url AS hero_img, description_am, description_en, is_active AS active FROM categories ORDER BY id')); } catch (error) { next(error); }
});

app.post('/api/admin/categories', requireAdmin, async (request, response, next) => {
  try {
    const { key, name_am, name_en, icon = 'fa-tag', hero_img = '', description_am = '', description_en = '', active = true } = request.body || {};
    if (!key || !name_am || !name_en) return response.status(400).json({ success: false, error: 'Key and both category names are required' });
    const result = await query('INSERT INTO categories (category_key, name_am, name_en, icon, hero_image_url, description_am, description_en, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [key.trim().toUpperCase(), name_am, name_en, icon, hero_img, description_am, description_en, active ? 1 : 0]);
    response.status(201).json({ success: true, id: result.insertId });
  } catch (error) { next(error); }
});

app.put('/api/admin/categories/:id', requireAdmin, async (request, response, next) => {
  try {
    const { key, name_am, name_en, icon = 'fa-tag', hero_img = '', description_am = '', description_en = '', active = true } = request.body || {};
    if (!key || !name_am || !name_en) return response.status(400).json({ success: false, error: 'Key and both category names are required' });
    await query('UPDATE categories SET category_key = ?, name_am = ?, name_en = ?, icon = ?, hero_image_url = ?, description_am = ?, description_en = ?, is_active = ? WHERE id = ?', [key.trim().toUpperCase(), name_am, name_en, icon, hero_img, description_am, description_en, active ? 1 : 0, request.params.id]);
    response.json({ success: true });
  } catch (error) { next(error); }
});

app.delete('/api/admin/categories/:id', requireAdmin, async (request, response, next) => {
  try { await query('DELETE FROM categories WHERE id = ?', [request.params.id]); response.json({ success: true }); } catch (error) { next(error); }
});

app.get('/api/admin/payment', requireAdmin, async (_request, response, next) => {
  try { response.json(await query('SELECT id, method_key AS bank_key, method_name AS bank_name, account_holder, account_number, dial_code, instructions_am, instructions_en, color, is_active AS active FROM payment_methods ORDER BY id')); } catch (error) { next(error); }
});

app.post('/api/admin/payment', requireAdmin, async (request, response, next) => {
  try {
    const { bank_key, bank_name, account_holder = '', account_number = '', dial_code = '', instructions_am = '', instructions_en = '', color = '#304230', active = true } = request.body || {};
    if (!bank_key || !bank_name) return response.status(400).json({ success: false, error: 'Payment key and name are required' });
    const result = await query('INSERT INTO payment_methods (method_key, method_name, account_holder, account_number, dial_code, instructions_am, instructions_en, color, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [bank_key.trim().toUpperCase(), bank_name, account_holder, account_number, dial_code, instructions_am, instructions_en, color, active ? 1 : 0]);
    response.status(201).json({ success: true, id: result.insertId });
  } catch (error) { next(error); }
});

app.put('/api/admin/payment/:id', requireAdmin, async (request, response, next) => {
  try {
    const { bank_key, bank_name, account_holder = '', account_number = '', dial_code = '', instructions_am = '', instructions_en = '', color = '#304230', active = true } = request.body || {};
    if (!bank_key || !bank_name) return response.status(400).json({ success: false, error: 'Payment key and name are required' });
    await query('UPDATE payment_methods SET method_key = ?, method_name = ?, account_holder = ?, account_number = ?, dial_code = ?, instructions_am = ?, instructions_en = ?, color = ?, is_active = ? WHERE id = ?', [bank_key.trim().toUpperCase(), bank_name, account_holder, account_number, dial_code, instructions_am, instructions_en, color, active ? 1 : 0, request.params.id]);
    response.json({ success: true });
  } catch (error) { next(error); }
});

app.delete('/api/admin/payment/:id', requireAdmin, async (request, response, next) => {
  try { await query('DELETE FROM payment_methods WHERE id = ?', [request.params.id]); response.json({ success: true }); } catch (error) { next(error); }
});

app.post('/api/admin/upload', requireAdmin, upload.single('image'), (request, response) => {
  if (!request.file) return response.status(400).json({ success: false, error: 'Image file is required' });
  response.status(201).json({ success: true, url: `/uploads/${request.file.filename}` });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  const status = error instanceof multer.MulterError || error.message.includes('image files') ? 400 : 500;
  response.status(status).json({ success: false, error: status === 500 ? 'Internal server error' : error.message });
});

app.listen(port, () => console.log(`Restaurant API listening on http://localhost:${port}`));

module.exports = app;