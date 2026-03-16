# RomanceSpace Frontend

The user-facing web application for browsing templates and building personalized romantic pages.

## Architecture

- **React + Vite**
- **Client-side only**: Fetches data from the VPS API (Backend).
- **Builder**: A dynamic form generator based on template `config.json` logic.
- **Gallery**: A showcase of all available templates.

## Tech Stack

- **Style**: Vanilla CSS (Premium/Modern aesthetics)
- **State**: React Hooks
- **Icons**: Lucide React
- **Router**: React Router

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment:
   ```bash
   cp .env.example .env
   # Set VITE_API_BASE=https://api.yourdomain.com
   ```
3. Run development server:
   ```bash
   npm run dev
   ```

## Key Pages

- `/`: Landing page / Catalog.
- `/gallery`: Template showcase showing display names (titles).
- `/builder`: The core customization engine.
- `/myspace`: User project management.

## Guidelines

- **Style First**: Every UI component must feel premium and polish.
- **Responsive**: Mobile-first design is mandatory.
- **No Hardcoding**: Use environment variables for API endpoints.
