# CutWise

CutWise is a production-oriented sheet-cutting and material optimization app built for fabricators, makers, and workshop teams who want to reduce waste, plan cuts faster, and reuse scrap more effectively.

The app combines planning, optimization, AI assistance, and scrap capture in a single workflow so users can move from a material list to a validated cutting plan.

## Features

- Smart cut-list generation and optimization
- Material and stock selection workflows
- Scrap scanning and reuse tracking
- AI assistant for planning and operational guidance
- Saved project workflows and layout comparisons
- Export-friendly reporting and material insights
- Local-first experience with browser-based camera access

## Tech stack

- React + Vite
- JavaScript / JSX
- Tailwind CSS
- Base44 SDK integration
- Browser camera and local storage support

## Quick start

1. Install dependencies:

	```bash
	npm install
	```

2. Start the app locally:

	```bash
	npm run dev -- --host 0.0.0.0
	```

3. Open the local app in your browser:

	```text
	http://localhost:5173
	```

## Build and verification

Run the project checks before shipping changes:

```bash
npm test
npm run lint
npm run build
```

## Base44 configuration

This app can run as a frontend-only local app, but Base44-powered features such as AI chat and backend integrations require environment values.

Create a `.env.local` file in the project root with the following values when connecting to your Base44 project:

```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_FUNCTIONS_VERSION=latest
VITE_BASE44_APP_BASE_URL=https://your-base44-app-url
```

If your Base44 app is not configured yet, the app can still be launched locally for frontend work, but backend-backed features will be unavailable until the app ID and Base44 URL are set.

## Camera and AI notes

- Camera access requires browser permission and a secure origin. `localhost` is allowed during development.
- AI assistant behavior may fall back gracefully when Base44 backend access is unavailable.
- Browser speech is used when voice services are not configured.

## Repository notes

This project is intended to be worked from its actual repo root, not the parent wrapper folder. Use the project directory containing this README when running Git commands and local development.

## License

This project is currently used as a client app and is not yet published under a formal open-source license.
