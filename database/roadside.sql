-- ============================================================
-- RoadSide+ — MySQL Database Schema
-- Run: mysql -u root -p < database/roadside.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS roadside_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE roadside_db;

-- ──────────────────────────────────────────────────────────────
-- USERS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    google_id       VARCHAR(100) UNIQUE,
    name            VARCHAR(120) NOT NULL,
    email           VARCHAR(180) UNIQUE NOT NULL,
    avatar          VARCHAR(500),
    phone           VARCHAR(20),
    role            ENUM('user','mechanic','admin') DEFAULT 'user',
    is_active       BOOLEAN DEFAULT TRUE,
    is_verified     BOOLEAN DEFAULT FALSE,
    -- Vehicle info
    vehicle_make    VARCHAR(60),
    vehicle_model   VARCHAR(60),
    vehicle_year    YEAR,
    license_plate   VARCHAR(20),
    -- Location
    saved_address   VARCHAR(300),
    emergency_contact VARCHAR(20),
    -- Timestamps
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────────────────────
-- MECHANICS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mechanics (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    -- Profile
    specialization  VARCHAR(200),              -- comma-separated service types
    experience_years INT DEFAULT 0,
    vehicle_number  VARCHAR(30),
    vehicle_type    VARCHAR(60),
    -- Location (real-time, updated via SocketIO)
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),
    -- Status
    is_online       BOOLEAN DEFAULT FALSE,
    is_available    BOOLEAN DEFAULT FALSE,
    is_approved     BOOLEAN DEFAULT FALSE,
    is_suspended    BOOLEAN DEFAULT FALSE,
    -- Stats
    rating          DECIMAL(3,2) DEFAULT 5.00,
    total_reviews   INT DEFAULT 0,
    total_jobs      INT DEFAULT 0,
    total_earnings  DECIMAL(10,2) DEFAULT 0.00,
    -- Timestamps
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────────────────────
-- SERVICE REQUESTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    mechanic_id     INT,
    -- Service details
    service_type    ENUM('flat_tire','battery','fuel','engine','towing','other') NOT NULL,
    description     TEXT,
    -- User location at time of request
    user_lat        DECIMAL(10, 8) NOT NULL,
    user_lng        DECIMAL(11, 8) NOT NULL,
    user_address    VARCHAR(300),
    -- Status tracking
    status          ENUM('pending','accepted','traveling','reached','in_progress','completed','cancelled') DEFAULT 'pending',
    -- Pricing
    base_price      DECIMAL(8,2) DEFAULT 0.00,
    distance_km     DECIMAL(6,2) DEFAULT 0.00,
    distance_charge DECIMAL(8,2) DEFAULT 0.00,
    platform_fee    DECIMAL(8,2) DEFAULT 0.00,
    total_amount    DECIMAL(8,2) DEFAULT 0.00,
    -- AI predictions
    ai_eta_minutes  INT,
    -- Timestamps
    requested_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at     DATETIME,
    completed_at    DATETIME,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (mechanic_id) REFERENCES mechanics(id)
);

-- ──────────────────────────────────────────────────────────────
-- PAYMENTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    request_id          INT NOT NULL,
    user_id             INT NOT NULL,
    mechanic_id         INT,
    -- Razorpay details
    razorpay_order_id   VARCHAR(100) UNIQUE,
    razorpay_payment_id VARCHAR(100),
    razorpay_signature  VARCHAR(500),
    -- Amounts (in INR paise / decimal rupees)
    amount              DECIMAL(10,2) NOT NULL,
    platform_fee        DECIMAL(10,2) DEFAULT 0.00,
    mechanic_payout     DECIMAL(10,2) DEFAULT 0.00,
    currency            VARCHAR(10) DEFAULT 'INR',
    -- Status
    status              ENUM('created','paid','failed','refunded') DEFAULT 'created',
    payment_method      VARCHAR(50),
    -- Timestamps
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (mechanic_id) REFERENCES mechanics(id)
);

-- ──────────────────────────────────────────────────────────────
-- REVIEWS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    request_id  INT NOT NULL UNIQUE,
    reviewer_id INT NOT NULL,
    mechanic_id INT NOT NULL,
    rating      TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id),
    FOREIGN KEY (mechanic_id) REFERENCES mechanics(id)
);

-- ──────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    title       VARCHAR(150) NOT NULL,
    message     TEXT NOT NULL,
    type        ENUM('info','success','warning','danger') DEFAULT 'info',
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────────────────────
-- EMERGENCY LOGS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_logs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    lat         DECIMAL(10,8),
    lng         DECIMAL(11,8),
    address     VARCHAR(300),
    note        TEXT,
    logged_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ──────────────────────────────────────────────────────────────
-- SAMPLE DATA
-- ──────────────────────────────────────────────────────────────

-- Admin user
INSERT IGNORE INTO users (google_id, name, email, role, is_verified, is_active)
VALUES ('admin_google_id_001', 'Admin User', 'admin@roadsideplus.com', 'admin', TRUE, TRUE);

-- Sample mechanic users
INSERT IGNORE INTO users (google_id, name, email, phone, role, is_verified, avatar)
VALUES
('mech_google_001', 'Rajan Kumar',   'rajan@example.com',  '9876543210', 'mechanic', TRUE, 'https://ui-avatars.com/api/?name=Rajan+Kumar&background=1a73e8&color=fff'),
('mech_google_002', 'Suresh Babu',   'suresh@example.com', '9876543211', 'mechanic', TRUE, 'https://ui-avatars.com/api/?name=Suresh+Babu&background=34a853&color=fff'),
('mech_google_003', 'Anand Sharma',  'anand@example.com',  '9876543212', 'mechanic', TRUE, 'https://ui-avatars.com/api/?name=Anand+Sharma&background=ea4335&color=fff');

-- Sample mechanic profiles
INSERT IGNORE INTO mechanics (user_id, specialization, experience_years, vehicle_number, vehicle_type, latitude, longitude, is_online, is_available, is_approved, rating, total_jobs)
VALUES
(2, 'flat_tire,battery,engine', 5, 'KA-01-AB-1234', 'Motorcycle', 12.9716, 77.5946, TRUE,  TRUE,  TRUE, 4.8, 120),
(3, 'towing,fuel,flat_tire',    3, 'KA-01-CD-5678', 'Tow Truck',  12.9352, 77.6245, TRUE,  TRUE,  TRUE, 4.5,  87),
(4, 'battery,engine,other',     7, 'KA-01-EF-9012', 'Van',        12.9010, 77.5667, FALSE, FALSE, TRUE, 4.9, 200);

-- Sample regular users
INSERT IGNORE INTO users (google_id, name, email, phone, role, vehicle_make, vehicle_model, license_plate)
VALUES
('user_google_001', 'Priya Sharma',  'priya@example.com',  '9123456789', 'user', 'Maruti', 'Swift',     'KA-01-MM-2345'),
('user_google_002', 'Arjun Reddy',   'arjun@example.com',  '9123456790', 'user', 'Honda',  'City',      'KA-02-NN-6789'),
('user_google_003', 'Meera Nair',    'meera@example.com',  '9123456791', 'user', 'Hyundai','i20',       'KA-03-PP-1122');

-- Sample completed requests with payments
INSERT IGNORE INTO requests (user_id, mechanic_id, service_type, description, user_lat, user_lng, user_address, status, base_price, distance_km, distance_charge, platform_fee, total_amount, ai_eta_minutes, requested_at, accepted_at, completed_at)
VALUES
(5, 1, 'flat_tire', 'Front left tyre puncture', 12.9716, 77.5946, 'MG Road, Bengaluru', 'completed', 300.00, 2.5, 62.50, 54.37, 416.87, 8,  NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY + INTERVAL 5 MINUTE, NOW() - INTERVAL 5 DAY + INTERVAL 45 MINUTE),
(6, 2, 'battery',   'Car not starting',          12.9352, 77.6245, 'Koramangala, Bengaluru', 'completed', 500.00, 4.0, 100.00, 90.00, 690.00, 15, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY + INTERVAL 3 MINUTE, NOW() - INTERVAL 3 DAY + INTERVAL 60 MINUTE),
(7, 1, 'fuel',      'Ran out of petrol',         12.9010, 77.5667, 'Indiranagar, Bengaluru', 'completed', 200.00, 1.8, 45.00, 36.75, 281.75, 6,  NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY + INTERVAL 4 MINUTE, NOW() - INTERVAL 1 DAY + INTERVAL 30 MINUTE);

-- Sample payments
INSERT IGNORE INTO payments (request_id, user_id, mechanic_id, razorpay_order_id, razorpay_payment_id, amount, platform_fee, mechanic_payout, status, payment_method)
VALUES
(1, 5, 1, 'order_sample_001', 'pay_sample_001', 416.87, 54.37, 362.50, 'paid', 'UPI'),
(2, 6, 2, 'order_sample_002', 'pay_sample_002', 690.00, 90.00, 600.00, 'paid', 'Card'),
(3, 7, 1, 'order_sample_003', 'pay_sample_003', 281.75, 36.75, 245.00, 'paid', 'UPI');

-- Sample reviews
INSERT IGNORE INTO reviews (request_id, reviewer_id, mechanic_id, rating, comment)
VALUES
(1, 5, 1, 5, 'Excellent service! Rajan arrived quickly and fixed my tyre professionally.'),
(2, 6, 2, 4, 'Good service, a little late but did a great job with the battery.'),
(3, 7, 1, 5, 'Super fast and friendly. Highly recommend!');

-- Sample notifications
INSERT IGNORE INTO notifications (user_id, title, message, type, is_read)
VALUES
(5, 'Welcome to RoadSide+', 'Your account is set up and ready to use in emergencies!', 'info', FALSE),
(5, 'Request Completed', 'Your flat tyre request has been completed. Please leave a review.', 'success', TRUE);
