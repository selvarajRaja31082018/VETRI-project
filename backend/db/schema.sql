-- VETRI - Visitor Engagement, Tracking & Redressal Initiative
-- MySQL 8.0 schema. Executed statement-by-statement by db/migrate.js.

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id BIGINT NOT NULL,
  permission_id BIGINT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  role_id BIGINT NOT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  mobile VARCHAR(20) DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  KEY idx_users_mobile (mobile),
  KEY idx_users_active (is_active),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS representatives (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  designation VARCHAR(150) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_representatives_user (user_id),
  CONSTRAINT fk_representatives_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS departments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- Reason-for-visit master, filtered by visitor type (prototype: Admin > Configuration).
CREATE TABLE IF NOT EXISTS visit_reasons (
  id BIGINT NOT NULL AUTO_INCREMENT,
  visitor_type VARCHAR(50) NOT NULL,
  reason VARCHAR(150) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_visit_reasons (visitor_type, reason),
  KEY idx_visit_reasons_type (visitor_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS visitors (
  id BIGINT NOT NULL AUTO_INCREMENT,
  visitor_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  address TEXT,
  district VARCHAR(100) DEFAULT NULL,
  constituency VARCHAR(150) DEFAULT NULL,
  visitor_type VARCHAR(50) DEFAULT NULL,
  identity_type VARCHAR(50) DEFAULT NULL,
  identity_reference VARCHAR(100) DEFAULT NULL,
  photo_url VARCHAR(500) DEFAULT NULL,
  is_restricted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_visitors_code (visitor_code),
  KEY idx_visitors_mobile (mobile),
  KEY idx_visitors_name (name),
  KEY idx_visitors_restricted (is_restricted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS visitor_requests (
  id BIGINT NOT NULL AUTO_INCREMENT,
  request_code VARCHAR(50) NOT NULL,
  visitor_id BIGINT NOT NULL,
  created_by BIGINT NOT NULL,
  purpose TEXT NOT NULL,
  reason VARCHAR(150) DEFAULT NULL,
  grievance_category VARCHAR(100) DEFAULT NULL,
  person_to_meet VARCHAR(150) DEFAULT NULL,
  representative_id BIGINT DEFAULT NULL,
  department_id BIGINT DEFAULT NULL,
  group_size INT NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL,
  priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
  rejection_reason TEXT,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME DEFAULT NULL,
  resolved_at DATETIME DEFAULT NULL,
  checked_in_at DATETIME DEFAULT NULL,
  checked_out_at DATETIME DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_visitor_requests_code (request_code),
  KEY idx_vr_visitor (visitor_id),
  KEY idx_vr_status (status),
  KEY idx_vr_representative (representative_id),
  KEY idx_vr_requested_at (requested_at),
  KEY idx_vr_created_by (created_by),
  CONSTRAINT fk_vr_visitor FOREIGN KEY (visitor_id) REFERENCES visitors (id),
  CONSTRAINT fk_vr_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_vr_representative FOREIGN KEY (representative_id) REFERENCES representatives (id),
  CONSTRAINT fk_vr_department FOREIGN KEY (department_id) REFERENCES departments (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- Group members share one meeting request but keep separate personal records.
CREATE TABLE IF NOT EXISTS visit_group_members (
  id BIGINT NOT NULL AUTO_INCREMENT,
  visitor_request_id BIGINT NOT NULL,
  name VARCHAR(150) NOT NULL,
  mobile VARCHAR(20) DEFAULT NULL,
  identity_type VARCHAR(50) DEFAULT NULL,
  identity_reference VARCHAR(100) DEFAULT NULL,
  address TEXT,
  photo_url VARCHAR(500) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vgm_request (visitor_request_id),
  CONSTRAINT fk_vgm_request FOREIGN KEY (visitor_request_id) REFERENCES visitor_requests (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  visitor_request_id BIGINT NOT NULL,
  representative_id BIGINT DEFAULT NULL,
  appointment_date DATETIME NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appointments_request (visitor_request_id),
  KEY idx_appointments_date (appointment_date),
  CONSTRAINT fk_appointments_request FOREIGN KEY (visitor_request_id) REFERENCES visitor_requests (id),
  CONSTRAINT fk_appointments_representative FOREIGN KEY (representative_id) REFERENCES representatives (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS meetings (
  id BIGINT NOT NULL AUTO_INCREMENT,
  visitor_request_id BIGINT NOT NULL,
  representative_id BIGINT NOT NULL,
  started_at DATETIME DEFAULT NULL,
  ended_at DATETIME DEFAULT NULL,
  remarks TEXT,
  resolution TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_meetings_request (visitor_request_id),
  KEY idx_meetings_representative (representative_id),
  KEY idx_meetings_status (status),
  CONSTRAINT fk_meetings_request FOREIGN KEY (visitor_request_id) REFERENCES visitor_requests (id),
  CONSTRAINT fk_meetings_representative FOREIGN KEY (representative_id) REFERENCES representatives (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS visitor_status_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  visitor_request_id BIGINT NOT NULL,
  old_status VARCHAR(50) DEFAULT NULL,
  new_status VARCHAR(50) NOT NULL,
  changed_by BIGINT NOT NULL,
  remarks TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vsh_request (visitor_request_id),
  KEY idx_vsh_created_at (created_at),
  CONSTRAINT fk_vsh_request FOREIGN KEY (visitor_request_id) REFERENCES visitor_requests (id),
  CONSTRAINT fk_vsh_user FOREIGN KEY (changed_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS complaints (
  id BIGINT NOT NULL AUTO_INCREMENT,
  visitor_request_id BIGINT NOT NULL,
  category VARCHAR(100) DEFAULT NULL,
  description TEXT NOT NULL,
  department_id BIGINT DEFAULT NULL,
  priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
  target_resolution_date DATE DEFAULT NULL,
  follow_up_date DATE DEFAULT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_complaints_request (visitor_request_id),
  KEY idx_complaints_status (status),
  KEY idx_complaints_category (category),
  CONSTRAINT fk_complaints_request FOREIGN KEY (visitor_request_id) REFERENCES visitor_requests (id),
  CONSTRAINT fk_complaints_department FOREIGN KEY (department_id) REFERENCES departments (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS restricted_entries (
  id BIGINT NOT NULL AUTO_INCREMENT,
  visitor_id BIGINT NOT NULL,
  reason TEXT NOT NULL,
  restricted_from DATE NOT NULL,
  attempted_entries INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_restricted_visitor (visitor_id),
  KEY idx_restricted_active (is_active),
  CONSTRAINT fk_restricted_visitor FOREIGN KEY (visitor_id) REFERENCES visitors (id),
  CONSTRAINT fk_restricted_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_notifications_user (user_id, is_read),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- old_value/new_value store JSON-serialised snapshots as LONGTEXT rather than the
-- native JSON type, so this schema also applies unmodified on MySQL 5.7 and
-- MariaDB < 10.2. The application always writes/reads them as JSON.
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id BIGINT DEFAULT NULL,
  old_value LONGTEXT DEFAULT NULL,
  new_value LONGTEXT DEFAULT NULL,
  ip_address VARCHAR(100) DEFAULT NULL,
  user_agent TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_user (user_id),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_created_at (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS settings (
  id BIGINT NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(150) NOT NULL,
  setting_value TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------------------------------
-- Multi-device photo capture
--
-- A capture session is opened by a desktop operator; mobile/USB devices join it
-- by scanning a QR code. Every stored photo records which session and device it
-- came from, plus the hashes used to reject duplicate captures.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS capture_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  session_id CHAR(36) NOT NULL,
  created_by BIGINT NOT NULL,
  purpose VARCHAR(50) NOT NULL DEFAULT 'VISITOR_REGISTRATION',
  status ENUM('ACTIVE', 'CLOSED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  max_devices INT NOT NULL DEFAULT 5,
  duplicate_scope ENUM('SESSION', 'GLOBAL') NOT NULL DEFAULT 'SESSION',
  expires_at DATETIME NOT NULL,
  closed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_capture_sessions_session_id (session_id),
  KEY idx_capture_sessions_status (status, expires_at),
  KEY idx_capture_sessions_creator (created_by),
  CONSTRAINT fk_capture_sessions_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS capture_devices (
  id BIGINT NOT NULL AUTO_INCREMENT,
  device_id CHAR(36) NOT NULL,
  capture_session_id BIGINT NOT NULL,
  device_type ENUM('DESKTOP', 'MOBILE', 'TABLET', 'EXTERNAL', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  camera_type ENUM('BUILTIN_WEBCAM', 'MOBILE_FRONT', 'MOBILE_REAR', 'USB_EXTERNAL', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  device_label VARCHAR(150) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  status ENUM('CONNECTED', 'DISCONNECTED') NOT NULL DEFAULT 'CONNECTED',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disconnected_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_capture_devices_device_id (device_id),
  KEY idx_capture_devices_session (capture_session_id, status),
  CONSTRAINT fk_capture_devices_session FOREIGN KEY (capture_session_id)
    REFERENCES capture_sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS captured_images (
  id BIGINT NOT NULL AUTO_INCREMENT,
  image_id CHAR(36) NOT NULL,
  capture_session_id BIGINT DEFAULT NULL,
  capture_device_id BIGINT DEFAULT NULL,
  session_id CHAR(36) DEFAULT NULL,
  device_id CHAR(36) DEFAULT NULL,
  device_type ENUM('DESKTOP', 'MOBILE', 'TABLET', 'EXTERNAL', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  camera_type ENUM('BUILTIN_WEBCAM', 'MOBILE_FRONT', 'MOBILE_REAR', 'USB_EXTERNAL', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  file_size INT NOT NULL,
  width INT DEFAULT NULL,
  height INT DEFAULT NULL,
  content_hash CHAR(64) NOT NULL,
  perceptual_hash CHAR(16) DEFAULT NULL,
  -- 32x32 greyscale thumbnail (1024 bytes) used for near-identical comparison.
  image_signature VARBINARY(1024) DEFAULT NULL,
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  captured_by BIGINT DEFAULT NULL,
  status ENUM('STORED', 'ATTACHED', 'DISCARDED') NOT NULL DEFAULT 'STORED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_captured_images_image_id (image_id),
  KEY idx_captured_images_session (session_id, captured_at),
  KEY idx_captured_images_device (device_id),
  KEY idx_captured_images_content_hash (content_hash),
  -- Race protection: two devices posting the same bytes into one session at
  -- the same instant cannot both insert. NULL session_id (a desktop capture
  -- outside any session) is exempt, as MySQL allows repeated NULLs here.
  UNIQUE KEY uq_captured_images_session_content (session_id, content_hash),
  KEY idx_captured_images_captured_at (captured_at),
  CONSTRAINT fk_captured_images_session FOREIGN KEY (capture_session_id)
    REFERENCES capture_sessions (id) ON DELETE SET NULL,
  CONSTRAINT fk_captured_images_device FOREIGN KEY (capture_device_id)
    REFERENCES capture_devices (id) ON DELETE SET NULL,
  CONSTRAINT fk_captured_images_user FOREIGN KEY (captured_by)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
