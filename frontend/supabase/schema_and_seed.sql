-- Drop existing tables to recreate normalized ones (except StudentNames)
DROP TABLE IF EXISTS public."TicketClaims" CASCADE;
DROP TABLE IF EXISTS public."ComplaintsTable" CASCADE;
DROP TABLE IF EXISTS public."TicketTableData" CASCADE;
DROP TABLE IF EXISTS public."TicketTable" CASCADE;
DROP TABLE IF EXISTS public."UserTable" CASCADE;

-- UserTable Schema
CREATE TABLE IF NOT EXISTS public."UserTable" (
  rollno VARCHAR(25) PRIMARY KEY,
  password VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  social_credit INT CHECK (social_credit >= 0 AND social_credit <= 100)
);

-- NEW: StudentNames Schema (Standalone table for real first names)
CREATE TABLE IF NOT EXISTS public."StudentNames" (
  rollno VARCHAR(25) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL
);

-- TicketTable Schema (Normalized)
CREATE TABLE IF NOT EXISTS public."TicketTable" (
  ticketid SERIAL PRIMARY KEY,
  owner_rollno VARCHAR(25) REFERENCES public."UserTable"(rollno) ON DELETE CASCADE,
  claimant_rollno VARCHAR(25) REFERENCES public."UserTable"(rollno) ON DELETE SET NULL,
  type VARCHAR(10) CHECK (type IN ('request', 'post')) NOT NULL DEFAULT 'request',
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
  description TEXT,
  category VARCHAR(100),
  status VARCHAR(20) CHECK (status IN ('pending', 'claimed', 'closed', 'time barred')) DEFAULT 'pending',
  "ItemPrice" INT DEFAULT 0
);

-- Schema Migrations for existing tables
ALTER TABLE public."TicketTable" ADD COLUMN IF NOT EXISTS type VARCHAR(10) CHECK (type IN ('request', 'post')) NOT NULL DEFAULT 'request';
ALTER TABLE public."TicketTable" ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT 'Untitled';
ALTER TABLE public."TicketTable" ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public."TicketTable" ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE public."TicketTable" ADD COLUMN IF NOT EXISTS "ItemPrice" INT DEFAULT 0;
ALTER TABLE public."TicketTable" ADD COLUMN IF NOT EXISTS status VARCHAR(20) CHECK (status IN ('pending', 'claimed', 'closed', 'time barred')) DEFAULT 'pending';

-- Drop the old TicketTableData if it exists
DROP TABLE IF EXISTS public."TicketTableData" CASCADE;

-- Dummy Data Insertion for UserTable (Removed generic dummy data, keep admin only)
-- Admin record inserted below.

-- NEW: Data Insertion for StudentNames (Extracted First Names)
INSERT INTO public."StudentNames" (rollno, first_name) VALUES
('160124737141', 'Hasini'),
('160124737142', 'Saishloka Reddy'),
('160124737143', 'Anoushka'),
('160124737144', 'Lakshmi Madhulika'),
('160124737145', 'Shravista'),
('160124737146', 'Sanjana'),
('160124737147', 'Sri Vidyambika'),
('160124737148', 'Ananya'),
('160124737149', 'Jharana'),
('160124737150', 'Aksah Malicay'),
('160124737151', 'Harshitha'),
('160124737152', 'Hasini'),
('160124737153', 'Madiha'),
('160124737155', 'Rafah Khatoon'),
('160124737156', 'Srinidhi'),
('160124737157', 'Srinija Reddy'),
('160124737158', 'Pranati'),
('160124737159', 'Ramani'),
('160124737160', 'Siddhi Sritha'),
('160124737161', 'Sankeerthana'),
('160124737162', 'Tanvi'),
('160124737163', 'Abinav'),
('160124737164', 'Yuvaan Kaarthikeyaa'),
('160124737165', 'Shivasai'),
('160124737166', 'Harshith Saipaavan'),
('160124737167', 'Shiva Prasad'),
('160124737168', 'Duurgaa Prasad Reddy'),
('160124737169', 'Pranav Narayana'),
('160124737170', 'Mohaseen Hussain'),
('160124737171', 'Pawan Kumar'),
('160124737172', 'Srisanth'),
('160124737173', 'Ghulam'),
('160124737174', 'Bharath'),
('160124737175', 'Revannath'),
('160124737176', 'Ashok'),
('160124737177', 'Nandu'),
('160124737178', 'Karthik'),
('160124737179', 'Mukesh Reddy'),
('160124737180', 'Sujal Roy'),
('160124737181', 'Vamshi Goud'),
('160124737182', 'Sriman Rao'),
('160124737183', 'Minesh Sri Ram'),
('160124737184', 'Vignesh'),
('160124737185', 'Sai Shiva Varma'),
('160124737186', 'Jaidev'),
('160124737187', 'Nikhil'),
('160124737188', 'Mahit'),
('160124737189', 'Anil Kumar'),
('160124737190', 'Abdul Khaliq Amer'),
('160124737191', 'Vishnu'),
('160124737192', 'Manish Reddy'),
('160124737193', 'Sahas'),
('160124737194', 'Devaashish'),
('160124737195', 'Deepak Kumar'),
('160124737196', 'Raza Mohammad'),
('160124737197', 'Umesh'),
('160124737198', 'Shashank'),
('160124737199', 'Shaz Ahmed'),
('160124737200', 'Yashwanth'),
('160124737201', 'Sharath Kumar'),
('160124737202', 'Jugal Kishore Reddy'),
('160124737203', 'Rajaneesh Netha'),
('160124737204', 'Deekshith'),
('160124737206', 'Shyanthan Reddy'),
('160124737314', 'Goutham'),
('160124737315', 'Lohitha'),
('160124737316', 'Yashas'),
('160124737317', 'Radha Rao'),
('160124737318', 'Ashrith Vardhan'),
('160124737319', 'Aravind Kumar')
ON CONFLICT (rollno) DO NOTHING;

-- No dummy tickets inserted as per instructions.

-- Ensure sequence is updated
SELECT setval('public."TicketTable_ticketid_seq"', COALESCE((SELECT MAX(ticketid) FROM public."TicketTable") + 1, 1), false);

-- Admin user for the admin panel
INSERT INTO public."UserTable" (rollno, password, username, social_credit) VALUES
('9999', 'oui', 'admin', 100)
ON CONFLICT (rollno) DO NOTHING;

-- ComplaintsTable Schema
CREATE TABLE IF NOT EXISTS public."ComplaintsTable" (
  id SERIAL PRIMARY KEY,
  rollno VARCHAR(25) REFERENCES public."UserTable"(rollno) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) CHECK (status IN ('open', 'resolved')) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable real-time for tickets
ALTER PUBLICATION supabase_realtime ADD TABLE public."TicketTable";
ALTER PUBLICATION supabase_realtime ADD TABLE public."ComplaintsTable";

-- TicketClaims Schema (for multi-claims)
CREATE TABLE IF NOT EXISTS public."TicketClaims" (
  id SERIAL PRIMARY KEY,
  ticketid INT REFERENCES public."TicketTable"(ticketid) ON DELETE CASCADE,
  claimant_rollno VARCHAR(25) REFERENCES public."UserTable"(rollno) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ticketid, claimant_rollno)
);

-- Apply migrations for ON DELETE CASCADE to existing tables if needed
ALTER TABLE public."TicketTable" DROP CONSTRAINT IF EXISTS "TicketTable_owner_rollno_fkey";
ALTER TABLE public."TicketTable" ADD CONSTRAINT "TicketTable_owner_rollno_fkey" FOREIGN KEY (owner_rollno) REFERENCES public."UserTable"(rollno) ON DELETE CASCADE;

ALTER TABLE public."TicketTable" DROP CONSTRAINT IF EXISTS "TicketTable_claimant_rollno_fkey";
ALTER TABLE public."TicketTable" ADD CONSTRAINT "TicketTable_claimant_rollno_fkey" FOREIGN KEY (claimant_rollno) REFERENCES public."UserTable"(rollno) ON DELETE SET NULL;

ALTER TABLE public."ComplaintsTable" DROP CONSTRAINT IF EXISTS "ComplaintsTable_rollno_fkey";
ALTER TABLE public."ComplaintsTable" ADD CONSTRAINT "ComplaintsTable_rollno_fkey" FOREIGN KEY (rollno) REFERENCES public."UserTable"(rollno) ON DELETE CASCADE;

ALTER PUBLICATION supabase_realtime ADD TABLE public."TicketClaims";