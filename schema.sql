

CREATE TABLE IF NOT EXISTS admin (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_username (username)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  name_am VARCHAR(255) NULL,
  name_en VARCHAR(255) NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT NULL,
  description_am TEXT NULL,
  description_en TEXT NULL,
  image_url VARCHAR(500) NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_menu_category (category),
  KEY idx_menu_available (is_available)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_key VARCHAR(100) NOT NULL,
  name_am VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  icon VARCHAR(100) NULL,
  hero_image_url VARCHAR(500) NULL,
  description_am TEXT NULL,
  description_en TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_category_key (category_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_methods (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  method_key VARCHAR(100) NOT NULL,
  method_name VARCHAR(255) NOT NULL,
  account_holder VARCHAR(255) NULL,
  account_number VARCHAR(255) NULL,
  dial_code VARCHAR(100) NULL,
  instructions_am TEXT NULL,
  instructions_en TEXT NULL,
  color VARCHAR(20) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_method_key (method_key)
) ENGINE=InnoDB;

INSERT INTO payment_methods
  (method_key, method_name, account_holder, account_number, dial_code, color)
VALUES
  ('CBE', 'Commercial Bank of Ethiopia', 'solomie Addisu', '1000345121351', '*889#', '#5C1D52'),
  ('TELEBIRR', 'Telebirr', 'solomie Addisu', '0908071504', '*127#', '#0054A6')
ON DUPLICATE KEY UPDATE
  method_name = VALUES(method_name),
  account_holder = VALUES(account_holder),
  account_number = VALUES(account_number),
  dial_code = VALUES(dial_code),
  color = VALUES(color);