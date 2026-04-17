-- UserTable Schema
CREATE TABLE IF NOT EXISTS public."UserTable" (
  rollno VARCHAR(25) PRIMARY KEY,
  password VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  social_credit INT CHECK (social_credit >= 0 AND social_credit <= 100)
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
  status VARCHAR(20) CHECK (status IN ('pending', 'claimed', 'closed', 'time barred')) DEFAULT 'pending'
);

-- Schema Migrations for existing tables
ALTER TABLE public."TicketTable" ADD COLUMN IF NOT EXISTS type VARCHAR(10) CHECK (type IN ('request', 'post')) NOT NULL DEFAULT 'request';
ALTER TABLE public."TicketTableData" ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT 'Untitled';
ALTER TABLE public."TicketTableData" ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public."TicketTableData" ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE public."TicketTableData" DROP COLUMN IF EXISTS data;

-- Dummy Data Insertion

INSERT INTO public."UserTable" (rollno, password, username, social_credit) VALUES
('160124737177', 'securepass1', 'mahithazari', 85),
('160124737178', 'securepass2', 'johndoe', 60),
('160124737179', 'securepass3', 'janedoe', 100)
ON CONFLICT (rollno) DO NOTHING;

-- Reset sequence to avoid manual ID insert issues if needed, but we'll manually specify for dummy data
INSERT INTO public."TicketTable" (ticketid, owner_rollno, claimant_rollno, type) VALUES
(1, '160124737177', NULL, 'request'),
(2, '160124737178', '160124737177', 'post'),
(3, '160124737179', '160124737178', 'post')
ON CONFLICT (ticketid) DO NOTHING;

INSERT INTO public."TicketTableData" (ticketid, title, description, category, status) VALUES
(1, 'Need 2 A4 sheets urgently', 'Have a lab record submission in 20 min. Will return tomorrow!', 'A4', 'pending'),
(2, 'Selling 50 extra A4 sheets', 'Bought a ream, only used half. ₹30 for the lot, meet near canteen.', 'A4', 'claimed'),
(3, 'Water bottle (Milton 1L)', 'Bought two by mistake. Sealed, unused. ₹150.', 'Water Bottle', 'closed')
ON CONFLICT (ticketid) DO NOTHING;

-- Ensure sequence is updated
SELECT setval('public."TicketTable_ticketid_seq"', COALESCE((SELECT MAX(ticketid) FROM public."TicketTable") + 1, 1), false);
