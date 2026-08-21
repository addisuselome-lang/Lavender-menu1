const bcrypt = require('bcrypt');
const { pool } = require('./db');

async function seedAdmin() {
  const passwordHash = await bcrypt.hash('selome123', 12);
  await pool.execute(
    `INSERT INTO admin (username, password_hash)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    ['admin', passwordHash],
  );
  console.log('Default admin seeded: username=admin, password=selome123');
}

seedAdmin()
  .catch((error) => {
    console.error('Could not seed admin:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());