# Jugaad Junction - Project Summary

## Project Overview
Jugaad Junction is a hyper-local, peer-to-peer resource exchange platform designed for student communities. It transforms the informal "jugaad" culture—helping each other with small favors (e.g., lending a pen, sharing A4 sheets, short notes)—into a structured, gamified marketplace. The platform uses a "Social Credit" system to incentivize helpfulness, track reputation, and foster a tightly-knit community.

## Tech Stack & Architecture
- **Frontend**: React.js with Vite (`/frontend`).
- **Styling**: Vanilla CSS with a strong emphasis on a "Warm Cork Board" aesthetic, paper card designs, handwriting fonts (Caveat, Patrick Hand), and subtle float animations (`index.css`, component-specific CSS like `Marketplace.css` and `Dashboard.css`).
- **Backend & Database**: Supabase (PostgreSQL) for database, real-time subscriptions, and authentication logic.
- **Deployment**: Configured for deployment to GitHub Pages (managed via Vite's `base` path configurations).

## Key Features & Workflows
1. **User Authentication & Profiles**:
   - Users log in via their college `rollno` (e.g., 160124737141) and password. 
   - A `StudentNames` table maintains real names for users, while `UserTable` holds authentication and social credit data.
   - An interactive "Social Credit Wheel" visualizes a user's standing in the `Dashboard`.
   - **UPI Integration**: Users can link their UPI IDs to their profiles. A UPI ID is mandatory for creating "Offer/Post" tickets.

2. **Marketplace & Ticketing System** (`Marketplace.jsx`):
   - Users can create two types of tickets: **Requests** (asking for help/items) and **Posts/Offers** (providing help/items).
   - Tickets support pricing and inline negotiation via the `ItemPrice` field.
   - **Ticket Lifecycle**: `pending` -> `claimed` -> `approved` -> `paid` -> `closed` (or `time barred`). 
   - **Demand Visibility**: The system supports multiple claimants per ticket using the `TicketClaims` table, prominently displaying claimant counts on offer tickets to signal demand.
   - **UPI QR Code Payments**: Integrated two-step QR code payment system. Users can generate dynamic UPI QR codes based on negotiated amounts to pay helpers securely.
   - **Visual Feedback**: Dark-themed dimming effects and status banners dynamically reflect ticket states (approved, paid) for relevant users.

3. **Dashboard & Ticket Management** (`Dashboard.jsx`):
   - Users can view their created and claimed tickets.
   - Users have the ability to "unclaim" tickets, releasing them back to the pending state.
   - **Push Notifications**: Multi-device web push notifications via service workers and Supabase Edge Functions alert users of claims, approvals, and payments in real-time.

4. **Self-Service Support & Admin Panel** (`AdminPanel.jsx`):
   - Users can submit complaints directly from their Dashboard.
   - Dedicated Admin User (`rollno: 9999`) has access to an `AdminPanel` to monitor complaints, manage user social credit scores manually, and resolve issues.

## Database Schema (Supabase)
Real-time capabilities are actively utilized via `supabase_realtime` publications for `TicketTable`, `TicketClaims`, and `ComplaintsTable`.

- **`UserTable`**: `rollno` (PK), `password`, `username`, `social_credit` (0-100), `upi_id` (nullable, VARCHAR(50)).
- **`StudentNames`**: `rollno` (PK), `first_name` (standalone table for real names).
- **`TicketTable`**: 
  - `ticketid` (PK)
  - `owner_rollno` (FK -> UserTable)
  - `claimant_rollno` (FK -> UserTable, nullable)
  - `type` ('request', 'post')
  - `title`, `description`, `category`, `ItemPrice`
  - `status` ('pending', 'claimed', 'closed', 'time barred')
- **`TicketClaims`**: Tracks multi-claimants. `id` (PK), `ticketid` (FK), `claimant_rollno` (FK), `claim_status` ('pending', 'approved', 'paid'). Unique on `(ticketid, claimant_rollno)`.
- **`ComplaintsTable`**: `id` (PK), `rollno` (FK), `subject`, `description`, `status` ('open', 'resolved').
- **`push_subscriptions`**: Supports multi-device push notifications. `id` (PK), `roll_number` (FK), `subscription` (JSONB), `endpoint` (Unique).

## Important Files & Directory Structure
- `/frontend/src/`
  - `App.jsx` / `main.jsx`: Application entry, routing, and high-level auth state management.
  - `Dashboard.jsx`: User profile, ticket management, social credit wheel, and complaint submission.
  - `Marketplace.jsx`: Core feed of tickets, creation modal, complex multi-claim logic, and inline negotiations.
  - `AdminPanel.jsx`: Moderation interface for `rollno: 9999` to resolve complaints and tweak credit scores.
  - `supabaseClient.js`: Supabase initialization and connection.
  - CSS files: Emphasize animations, responsive grid layouts, and a warm cork board aesthetic.
- `/frontend/supabase/schema_and_seed.sql`: Source of truth for database migrations, table relations, and dummy data generation.
