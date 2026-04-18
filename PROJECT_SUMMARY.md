# Jugaad Junction

## Brief Project Description
Jugaad Junction is a hyper-local, peer-to-peer resource exchange platform designed for student communities. It transforms the informal "jugaad" culture of helping each other with small favors (like lending a pen, sharing A4 sheets, or providing short notes) into a structured marketplace. The platform uses a social credit system to incentivize helpfulness and build a reputation-based status within the community.

## Who It's For
- **Primary Audience**: Students in a specific class or college campus.
- **Secondary Audience**: Any closed-knit group where small favors and resource sharing are common but hard to track or reward.

## Use Cases
- **Emergency Resource Requests**: A student needing A4 sheets for an urgent lab submission can post a request.
- **Peer-to-Peer Marketplace**: Selling used textbooks, lab equipment (like adaptors), or extra stationery.
- **Service Exchange**: Trading favors like attendance help, sharing short notes, or "Leisure Buddy System" activities.
- **Status Building**: Users earn "Social Credit" for fulfilling requests, which serves as a badge of honor and reliability in the class.

## Brief Implementation Details
- **Frontend**: A modern, responsive web application built with **React.js** and **Vite**. It features a "Glassmorphism" design aesthetic with a card-based "bulletin board" layout.
- **Backend & Database**: Powered by **Supabase (PostgreSQL)**. It utilizes real-time database capabilities to track ticket statuses and user social credit scores.
- **Architecture**:
    - **User Management**: Roll number-based authentication with session persistence.
    - **Resource Logic**: A dual-tier table system (`TicketTable` for ownership and `TicketTableData` for metadata) handles the lifecycle of "Requests" and "Offers."
    - **Status Workflow**: Tickets progress from `pending` -> `claimed` -> `closed`, with mechanisms for "bargaining" on already claimed items.
    - **Gamification**: A dynamic **Social Credit Wheel** in the user dashboard reflects their standing based on platform activity.
