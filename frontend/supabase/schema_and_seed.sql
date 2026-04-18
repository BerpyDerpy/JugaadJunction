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

-- TicketTable (Ownership) Schema
CREATE TABLE IF NOT EXISTS public."TicketTable" (
  ticketid SERIAL PRIMARY KEY,
  owner_rollno VARCHAR(25) REFERENCES public."UserTable"(rollno),
  claimant_rollno VARCHAR(25) REFERENCES public."UserTable"(rollno) NULL,
  type VARCHAR(10) CHECK (type IN ('request', 'post')) NOT NULL DEFAULT 'request'
);

-- TicketTableData (Meta data) Schema
CREATE TABLE IF NOT EXISTS public."TicketTableData" (
  ticketid INT PRIMARY KEY REFERENCES public."TicketTable"(ticketid),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  status VARCHAR(20) CHECK (status IN ('pending', 'claimed', 'closed', 'time barred')) DEFAULT 'pending',
  "ItemPrice" INT DEFAULT 0
);

-- Schema Migrations for existing tables
ALTER TABLE public."TicketTable" ADD COLUMN IF NOT EXISTS type VARCHAR(10) CHECK (type IN ('request', 'post')) NOT NULL DEFAULT 'request';
ALTER TABLE public."TicketTableData" ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT 'Untitled';
ALTER TABLE public."TicketTableData" ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public."TicketTableData" ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE public."TicketTableData" ADD COLUMN IF NOT EXISTS "ItemPrice" INT DEFAULT 0;
ALTER TABLE public."TicketTableData" DROP COLUMN IF EXISTS data;

-- Dummy Data Insertion for UserTable
INSERT INTO public."UserTable" (rollno, password, username, social_credit) VALUES
('160124737177', 'securepass1', 'mahithazari', 85),
('160124737178', 'securepass2', 'johndoe', 60),
('160124737179', 'securepass3', 'janedoe', 100)
ON CONFLICT (rollno) DO NOTHING;

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

-- Reset sequence to avoid manual ID insert issues if needed, but we'll manually specify for dummy data
INSERT INTO public."TicketTable" (ticketid, owner_rollno, claimant_rollno, type) VALUES
(1, '160124737177', NULL, 'request'),
(2, '160124737178', '160124737177', 'post'),
(3, '160124737179', '160124737178', 'post')
ON CONFLICT (ticketid) DO NOTHING;

INSERT INTO public."TicketTableData" (ticketid, title, description, category, status, "ItemPrice") VALUES
(1, 'Need 2 A4 sheets urgently', 'Have a lab record submission in 20 min. Will return tomorrow!', 'A4', 'pending', 0),
(2, 'Selling 50 extra A4 sheets', 'Bought a ream, only used half. ₹30 for the lot, meet near canteen.', 'A4', 'claimed', 30),
(3, 'Water bottle (Milton 1L)', 'Bought two by mistake. Sealed, unused. ₹150.', 'Water Bottle', 'closed', 150)
ON CONFLICT (ticketid) DO NOTHING;

-- Ensure sequence is updated
SELECT setval('public."TicketTable_ticketid_seq"', COALESCE((SELECT MAX(ticketid) FROM public."TicketTable") + 1, 1), false);