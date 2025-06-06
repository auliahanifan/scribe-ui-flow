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

### Set up environment variables:

-   Copy the example environment file:
    ```bash
    cp .env.example .env.local
    ```
-   Open `.env.local` and add your API keys:
    -   `VITE_DEEPGRAM_API_KEY`: Your API key from [Deepgram](https://deepgram.com/).
    -   `VITE_OPENROUTER_API_KEY`: Your API key from [OpenRouter](https://openrouter.ai/keys).

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