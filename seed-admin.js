const { pool } = require('./db.js');
const bcrypt = require('bcrypt');

async function seedAdmin() {
  try {
    await pool.execute(
      `CREATE TABLE IF NOT EXISTS admin (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`
    );

    const passwordHash = await bcrypt.hash('selome123', 12);

    await pool.execute(
      'INSERT INTO admin (username, password_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)',
      ['admin', passwordHash]
    );

    console.log('Default admin seeded successfully: username=admin, password=selome123');
  } catch (error) {
    console.error('Could not seed admin:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedAdmin();
