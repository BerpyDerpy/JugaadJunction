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
  claimant_rollno VARCHAR(25) REFERENCES public."UserTable"(rollno) NULL
);

-- TickTable (Meta data) Schema
CREATE TABLE IF NOT EXISTS public."TickTable" (
  ticketid INT PRIMARY KEY REFERENCES public."TicketTable"(ticketid),
  data TEXT,
  status VARCHAR(20) CHECK (status IN ('pending', 'claimed', 'closed', 'time barred'))
);

-- Dummy Data Insertion

INSERT INTO public."UserTable" (rollno, password, username, social_credit) VALUES
('160124737177', 'securepass1', 'mahithazari', 85),
('160124737178', 'securepass2', 'johndoe', 60),
('160124737179', 'securepass3', 'janedoe', 100)
ON CONFLICT (rollno) DO NOTHING;

-- Reset sequence to avoid manual ID insert issues if needed, but we'll manually specify for dummy data
INSERT INTO public."TicketTable" (ticketid, owner_rollno, claimant_rollno) VALUES
(1, '160124737177', NULL),
(2, '160124737178', '160124737177'),
(3, '160124737179', '160124737178')
ON CONFLICT (ticketid) DO NOTHING;

INSERT INTO public."TickTable" (ticketid, data, status) VALUES
(1, 'Require textbook for physics 101', 'pending'),
(2, 'Found a stray cat near campus', 'claimed'),
(3, 'Lost my wallet around the cafeteria', 'closed')
ON CONFLICT (ticketid) DO NOTHING;

-- Ensure sequence is updated
SELECT setval('public."TicketTable_ticketid_seq"', COALESCE((SELECT MAX(ticketid) FROM public."TicketTable") + 1, 1), false);
