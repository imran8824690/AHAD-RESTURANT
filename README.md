# AHAD RESTAURANT

The frontend and backend are kept in separate folders. The Node.js backend serves the website, validates reservation requests, and saves them locally as JSON.

## Run locally

Requires Node.js 18 or later. From this project folder, run:

```sh
npm start
```

Open <http://127.0.0.1:3000>. Set the `PORT` environment variable to use a different port.

## Project files

- `frontend/index.html` contains the page structure and editable restaurant copy.
- `frontend/styles.css` contains the responsive site styles.
- `frontend/script.js` contains the menu filters, testimonial controls, navigation, and reservation form behavior.
- `backend/server.js` serves the frontend and provides the reservation API.
- `backend/data/reservations.json` is created when the first reservation is saved. It is excluded from version control because it contains guest information.

## Reservation API

- `GET /api/health` returns the server status.
- `POST /api/reservations` accepts JSON with `name`, `email`, `date` (`YYYY-MM-DD`), `time`, and `guests` fields.

Reservation submissions are stored locally; this starter does not send confirmation emails or connect to a restaurant booking platform.