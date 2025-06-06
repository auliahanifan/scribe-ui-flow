# Asha Health Scribe

Changes made via Lovable will be committed automatically to this repo.

## About This Project

Asha Health Scribe is a web application designed to assist healthcare professionals by transcribing spoken patient encounters in real-time and generating structured SOAP (Subjective, Objective, Assessment, Plan) notes. It leverages Deepgram for live audio transcription and an AI model (via OpenRouter) to process the transcription into a SOAP note format.

This tool aims to reduce administrative burden, allowing clinicians to focus more on patient care.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

### Running the Development Server

Once the dependencies are installed and environment variables are set, you can start the development server:

Using npm:
```bash
npm run dev
```
Or using yarn:
```bash
yarn dev
```
Or using pnpm:
```bash
pnpm dev
```

This will typically start the application on `http://localhost:8080` (or another port if 8080 is busy). Open this URL in your browser to use the application.