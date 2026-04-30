# SplitIt

A full-stack web app for splitting shared expenses with friends and groups. Track who paid what, split costs equally or by custom amounts, and settle up with minimal transfers.

**Live:** [splitit.up.railway.app](https://splitit.up.railway.app)

---

## Features

### Groups
- Create groups for any shared context — trips, rent, dinners, etc.
- Add a name and description, and invite members directly during creation
- Edit or delete groups (admin only)
- Each group card shows member count, creator, and a **Settled up** badge when all balances are zero

### Expenses
- Log expenses with description, amount, date, and who paid
- **Three split modes:**
  - **Equal** — split evenly among selected members
  - **%** — set custom percentages per person (capped at 100%)
  - **$** — enter exact dollar amounts per person
- Edit or delete expenses (creator, payer, or group admin)
- **AI receipt scanner** — upload a photo or PDF of a receipt to auto-fill amount and description

### Balances & Settling Up
- Smart debt simplification — calculates the minimum number of transfers to settle all balances
- One-tap settle up between any two members
- Balance tab shows exactly who owes who and how much
- Summary bar at the top of each group shows total spent and your net balance

### Friends
- Search for users by name or @username
- Send, accept, and decline friend requests
- Add friends directly to groups without needing a link
- Pending friend request badge on the nav

### Invite Links
- Generate a shareable link for any group
- Anyone with the link can join — useful for adding people who aren't on the app yet

### Activity Feed
- Chronological history of all group activity — expenses added, members joined, settlements recorded

### Profiles & Accounts
- Set a display name, unique @username, and anime avatar (picked from top AniList characters)
- Change password with current password verification
- Token rotated on password change to invalidate other sessions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, React Hook Form, Zod |
| Backend | Django, Django REST Framework, PostgreSQL |
| Auth | Token-based (DRF `authtoken`) |
| AI | Claude API (receipt scanning) |
| Hosting | Vercel (frontend) + Railway (backend + DB) |

---

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set environment variables
cp .env.example .env  # fill in DB credentials and secret key

python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend at `http://localhost:8000` by default. Set `VITE_API_URL` in a `.env.local` file to override.
