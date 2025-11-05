# 🚀 Gemini AI Studio

A comprehensive, browser-based AI assistant application showcasing the power of the Gemini API. This project provides a rich user experience for real-time conversation, multi-modal analysis (text, image, video, audio), advanced reasoning, and grounded generation, all running securely in your browser.

## ✨ Features

This AI Studio comes packed with a suite of powerful features:

*   🗣️ **Live Conversation**: Speak with Gemini in real-time with ultra-low latency. Features voice selection, tool use (web search, file analysis, etc.), and automatic conversation summarization.
*   💬 **Chat**: Engage in classic text-based conversations with a customizable AI persona. Includes support for function calling (like image generation) directly within the chat.
*   🧠 **Complex Reasoning**: Tackle difficult problems with "Thinking Mode" enabled, leveraging Gemini 2.5 Pro for in-depth analysis.
*   🌐 **Grounded Search**: Get up-to-date answers from the web & Google Maps, with all sources cited for verification.
*   🖼️ **Image Analysis**: Understand the content of your images by asking questions in natural language.
*   🎨 **Image Generation**: Create stunning visuals from text using Imagen 4.0, with style presets and negative prompts.
*   📹 **Video Analysis**: Extract insights and summaries from video files.
*   🎤 **Audio Transcription**: Transcribe spoken words from audio files with high accuracy.
*   📂 **File Library**: A personal, encrypted file cabinet for your documents, images, and media. Files are stored locally and can be made available to the AI for analysis.
*   ⚙️ **Settings & Personas**: Customize your experience by creating and managing AI character personas. Securely backup and restore all your application data.
*   🔐 **Secure & Private**: All your data (files, chat history, personas) is encrypted with a password you create and stored *only* in your browser's IndexedDB. Nothing is stored on a server.

## 🛠️ How to Run

This application is designed to be **run directly in a web browser without any build steps** (like Vite, Webpack, or `npm`).

The error you are seeing (`Failed to resolve import "./components/Icons" from "App.tsx"`) is because you are trying to run this project with a tool like Vite, which it is not configured for.

Here is the correct way to run this application:

1.  **Ensure all files are in the same directory**: Make sure `index.html`, `index.tsx`, `App.tsx`, and all other `.ts` and `.tsx` files are in the correct folder structure as provided.
2.  **Use a simple web server**: You cannot open `index.html` directly from your file system (`file:///...`) due to security restrictions (CORS) related to ES modules. You need to serve the files from a local web server.
    *   **If you have Python installed:**
        ```bash
        # In your project directory, run one of these commands
        python -m http.server
        # or for Python 2
        python -m SimpleHTTPServer
        ```
        Then open `http://localhost:8000` in your browser.
    *   **If you have Node.js installed:**
        You can use a simple package like `serve`.
        ```bash
        # Install it globally if you haven't already
        npm install -g serve
        # In your project directory, run:
        serve .
        ```
        Then open the URL it provides (usually `http://localhost:3000`).
    *   **Using a VS Code Extension:**
        Extensions like [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) are perfect for this. Simply install it, right-click on `index.html`, and choose "Open with Live Server".

3.  **API Key**: This application is designed to run in an environment where the `process.env.API_KEY` is provided. When running locally with a simple server, the API key will be `undefined`, and API calls will fail. You would need to temporarily modify the code in `services/geminiService.ts` to hardcode your key for local testing:

    ```typescript
    // In services/geminiService.ts (FOR LOCAL TESTING ONLY)
    const getAi = (): GoogleGenAI => {
        const API_KEY = 'YOUR_GEMINI_API_KEY'; // <--- Add your key here
        if (!API_KEY) {
            console.error("API_KEY environment variable not set.");
            throw new Error("API key is missing.");
        }
        // Always create a new instance to avoid issues with stale API keys.
        return new GoogleGenAI({ apiKey: API_KEY });
    };
    ```
    **⚠️ IMPORTANT:** Remember to remove your hardcoded key before sharing or deploying the code!

## ⚙️ Configuration

*   **API Key**: As mentioned above, the API key is expected to be available as `process.env.API_KEY`. The provided code does not include any UI for setting this key.
*   **Data Storage**: All user data is stored locally in the browser's IndexedDB. It is encrypted using the password you provide on first launch.

## 💻 Core Technologies

*   **React 19**: For building the user interface.
*   **TypeScript**: For type safety and better developer experience.
*   **@google/genai**: The official Google Gemini API client library.
*   **Tailwind CSS**: For styling the application, loaded via a CDN script.
*   **IndexedDB**: For local, persistent, and secure data storage.
*   **Web Crypto API**: For strong, end-to-end encryption of all user data.
*   **ES Modules & Import Maps**: For dependency management directly in the browser without a bundler.
