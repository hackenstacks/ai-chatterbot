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

This application is designed to be **run directly in a web browser without any build steps** (like Vite, Webpack, or `npm`). The most important step is to use a simple local web server.

### 1. Start a Local Web Server (Required)

You cannot open `index.html` directly from your file system (`file:///...`) due to browser security policies. You must use a local server.

*   **Recommended Method (Node.js):**
    The easiest and most reliable way is using the `serve` package.
    ```bash
    # 1. Install serve globally if you haven't already
    npm install -g serve

    # 2. Run the server from the project's root directory
    serve .
    ```
    Then, open the local URL it provides (e.g., `http://localhost:3000`).

*   **Alternative Method (Python):**
    This project includes a `server.py` file configured to work correctly.
    ```bash
    # In your project directory, run this command:
    python server.py
    ```
    Then open `http://localhost:8000` in your browser.
    
    > **Troubleshooting**: If you see a `SyntaxError: Non-UTF-8 code` error, it indicates a file encoding issue. We recommend using the Node.js `serve` method above to fix this.

*   **Alternative Method (Deno):**
    Deno's standard file server also works perfectly.
    ```bash
    deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts .
    ```

### 2. Add Your API Key (For Local Testing Only)

This application is designed to run in an environment where `process.env.API_KEY` is provided. For local testing, you must temporarily modify the code to include your key.

In `services/geminiService.ts`, find the `getAi` function and add your key:

```typescript
// In services/geminiService.ts
const getAi = (): GoogleGenAI => {
    // ⚠️ FOR LOCAL TESTING ONLY - Add your key here
    const API_KEY = 'YOUR_GEMINI_API_KEY'; 
    
    if (!API_KEY) {
        // This check is for the production environment
        if (!process.env.API_KEY) {
            console.error("API_KEY environment variable not set.");
            throw new Error("API key is missing.");
        }
        return new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    
    // Always create a new instance to avoid issues with stale API keys.
    return new GoogleGenAI({ apiKey: API_KEY });
};
```
**⚠️ IMPORTANT:** Remember to remove your hardcoded key before sharing or deploying the code!


## 📘 Feature Guide

*   ### 🗣️ **Live Conversation**
    *   **What it is**: A real-time, voice-to-voice chat with Gemini.
    *   **How to use**: Click `Start Conversation`. Your browser will ask for microphone permission. Once connected, just speak. You can upload an image, video, or audio file for the AI to discuss with you.
    *   **Pro-Tip**: You can give complex commands like, *"Analyze the video I uploaded and then search the web for more information about the main topic."*

*   ### 💬 **Chat**
    *   **What it is**: A familiar text-based chat interface.
    *   **How to use**: Type your message and press Enter. Use the toolbar icons to configure the AI's persona (`⚙️`), grant access to files from your library (`📎`), or use voice-to-text (`🎤`).
    *   **Pro-Tip**: Create a custom character in `Settings` and apply it here for a unique role-playing experience. You can even generate images by typing `/imagine a red sports car`.

*   ### 📂 **File Library**
    *   **What it is**: Your secure, local storage for all files related to the AI.
    *   **How to use**: Drag and drop files into the upload area. Once added, they can be accessed by the AI in the `Chat` or `Live Conversation` features. You can `Archive` files to hide them from the active list.
    *   **Pro-Tip**: Upload text documents, images, or short video clips that you frequently reference in your conversations with the AI.

*   ### ⚙️ **Settings**
    *   **What it is**: The control center for your app.
    *   **How to use**: Create, edit, and manage your AI character personas. Import characters from TavernAI (`.png` or `.json`). You can also export an encrypted backup of all your data (files, chats, personas) or import a backup to restore your state.
    *   **Pro-Tip**: Choose a default voice for the `Live Conversation` feature that best suits your preference.

## ❓ Frequently Asked Questions (FAQ)

*   **Q: Is my data private?**
    *   **A:** <strong style="color: #4ade80;">Yes.</strong> All your data—files, chat history, and personas—is **end-to-end encrypted** with a password you create. This data is stored exclusively in your browser's IndexedDB and is never sent to any server.

*   **Q: What happens if I forget my password?**
    *   **A:** <strong style="color: #f87171;">Your data is permanently lost.</strong> Because the encryption is handled entirely on your device, there is no "Forgot Password" feature. We cannot recover your data. You will have to reset the application, which deletes everything.

*   **Q: Why do I get an error when I open `index.html` directly?**
    *   **A:** Modern JavaScript (ES Modules) has security rules that prevent it from running from `file:///` URLs. You **must** serve the files using a simple local web server as described in the "How to Run" section.

*   **Q: Why am I getting a `MIME type` error?**
    *   **A:** This happens when your local web server doesn't know that `.tsx` files are JavaScript. Use one of the recommended servers in the "How to Run" section, as they are correctly configured to solve this.

*   **Q: Why can't the AI access a website in Live Conversation or Chat?**
    *   **A:** Web security policies (CORS) prevent a browser from directly accessing content on other websites. This is a limitation of web technology, not the AI. For a robust solution, this would require a server-side proxy.

*   **Q: Why is video analysis limited to 10MB?**
    *   **A:** Processing large files entirely in the browser consumes a lot of memory. The limit is in place to prevent the application from crashing, especially on devices with less RAM.

## 💻 Core Technologies

*   **React 19**: For building the user interface.
*   **TypeScript**: For type safety and better developer experience.
*   **@google/genai**: The official Google Gemini API client library.
*   **Tailwind CSS**: For styling the application, loaded via a CDN script.
*   **IndexedDB**: For local, persistent, and secure data storage.
*   **Web Crypto API**: For strong, end-to-end encryption of all user data.
*   **ES Modules & Import Maps**: For dependency management directly in the browser without a bundler.