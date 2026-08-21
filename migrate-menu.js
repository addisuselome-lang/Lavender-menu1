const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pool } = require('./db');

const dataFiles = [
  ['data/breakfast.js', 'BREAKFAST_ITEMS'],
  ['data/hot_drinks.js', 'HOT_DRINKS_ITEMS'],
  ['data/lunch_dinner.js', 'LUNCH_DINNER_ITEMS'],
  ['data/snacks.js', 'SNACK_ITEMS'],
  ['data/beer.js', 'BEER_ITEMS'],
  ['data/traditional.js', 'TRADITIONAL_ITEMS'],
  ['data/soft_drinks.js', 'SOFT_DRINKS_ITEMS'],
];

const defaultCategories = [
  ['BREAKFAST', 'የቁርስ ምግብ', 'Breakfast', 'fa-egg', '/menu-images/4-nu-special-chechebsa.jpg'],
  ['HOT_DRINKS', 'ትኩስ መጠጥ', 'Hot Drinks', 'fa-mug-hot', '/menu-images/1-macchiato.jpg'],
  ['LUNCH_DINNER', 'ምሳና ራት', 'Lunch & Dinner', 'fa-drumstick-bite', '/menu-images/2-kitfo.jpg'],
  ['SNACK', 'መክሰስና ፒዛ', 'Snacks & Pizza', 'fa-pizza-slice', '/menu-images/1-nu-pizza.jpg'],
  ['BEER', 'የቢራ መጠጥ', 'Beer', 'fa-beer-mug-empty', '/menu-images/habesha.jpg'],
  ['TRADITIONAL', 'ባህላዊ መጠጥ', 'Traditional', 'fa-wine-glass', '/menu-images/tej%20betermus.jpg'],
  ['SOFT_DRINKS', 'ለስላሳና ውሃ', 'Soft Drinks', 'fa-bottle-water', '/menu-images/1-water.jpg'],
];

function readItems(file, variable) {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const start = source.indexOf('[');
  const end = source.lastIndexOf('];');
  if (start < 0 || end < 0) throw new Error(`Could not parse ${file}`);
  const context = {};
  vm.runInNewContext(`result = ${source.slice(start, end + 1)}`, context);
  return context.result.map((item) => ({ ...item, category: item.category || variable.replace('_ITEMS', '') }));
}

async function migrate() {
  await pool.execute('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS name_am VARCHAR(255) NULL');
  await pool.execute('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS name_en VARCHAR(255) NULL');
  await pool.execute('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description_am TEXT NULL');
  await pool.execute('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description_en TEXT NULL');
  for (const category of defaultCategories) {
    await pool.execute('INSERT INTO categories (category_key, name_am, name_en, icon, hero_image_url) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name_am = VALUES(name_am), name_en = VALUES(name_en), icon = VALUES(icon), hero_image_url = VALUES(hero_image_url)', category);
  }
  const defaultPayments = [
    ['CBE', 'Commercial Bank of Ethiopia', 'solomie Addisu', '1000345121351', '*889#', '#5C1D52'],
    ['TELEBIRR', 'Telebirr', 'solomie Addisu', '0908071504', '*127#', '#0054A6'],
  ];
  for (const payment of defaultPayments) {
    await pool.execute('INSERT INTO payment_methods (method_key, method_name, account_holder, account_number, dial_code, color) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE method_name = VALUES(method_name), account_holder = VALUES(account_holder), account_number = VALUES(account_number), dial_code = VALUES(dial_code), color = VALUES(color)', payment);
  }
  let count = 0;
  for (const [file, variable] of dataFiles) {
    for (const item of readItems(file, variable)) {
      const imageName = item.img ? path.basename(decodeURIComponent(item.img)) : null;
      const imagePath = imageName ? path.join(__dirname, 'menu-images', imageName) : null;
      if (imagePath && !fs.existsSync(imagePath)) throw new Error(`Missing image: ${imageName}`);
      const imageUrl = imageName ? `/menu-images/${encodeURIComponent(imageName)}` : null;
      const existing = await pool.execute('SELECT id FROM menu_items WHERE (name_en = ? OR name = ?) AND category = ? LIMIT 1', [item.nameEn || item.nameAm, item.nameEn || item.nameAm, item.category]);
      const values = [item.nameEn || item.nameAm, item.nameAm || item.nameEn, item.nameEn || item.nameAm, item.category, Number(item.price), item.descEn || item.descAm || '', item.descAm || item.descEn || '', item.descEn || item.descAm || '', imageUrl];
      if (existing[0].length) {
        await pool.execute('UPDATE menu_items SET name = ?, name_am = ?, name_en = ?, price = ?, description = ?, description_am = ?, description_en = ?, image_url = ?, is_available = 1 WHERE id = ?', [values[0], values[1], values[2], values[4], values[5], values[6], values[7], values[8], existing[0][0].id]);
      } else {
        await pool.execute('INSERT INTO menu_items (name, name_am, name_en, category, price, description, description_am, description_en, image_url, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)', values);
      }
      count += 1;
    }
  }
  console.log(`Imported ${count} menu items with centralized image URLs.`);
}

migrate()
  .catch((error) => {
    console.error('Menu migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());