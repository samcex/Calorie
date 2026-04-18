# Calorie Tracker

A client-side web app for planning daily calories, tracking meal intake, and comparing actual weight progress against an ideal target line.

## Features

- Daily calorie target calculator (BMR + activity + goal adjustment)
- Food intake log with daily totals and remaining calories
- Weight dashboard with:
  - Real weight trend line
  - Ideal target line to goal date
- Persistent storage in browser `localStorage`
- Responsive UI for desktop and mobile

## Run locally

Because this is a static app, you can run it with any static web server.

```bash
cd /root/calorie-tracker-webapp
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Tech

- HTML
- CSS
- Vanilla JavaScript
