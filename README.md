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

## 🛠️ How to Run Locally

This project is a standard web application built with Vite, React, and TypeScript. Follow these steps to run it on your local machine.

### Prerequisites
*   [Node.js](https://nodejs.org/) (version 18 or later is recommended)
*   [npm](https://www.npmjs.com/) (usually comes with Node.js)

### 1. Set Up Your API Key

The application needs your Google Gemini API key to function.

1.  Create a new file named `.env.local` in the root directory of the project.
2.  Add your API key to this file like so:
    ```
    API_KEY=YOUR_GEMINI_API_KEY_HERE
    ```
    The Vite development server is configured to automatically load this key and make it available to the application.

### 2. Install Dependencies

Open your terminal in the project's root directory and run the following command to install all the necessary packages:

```bash
npm install
```

### 3. Run the Development Server

Once the installation is complete, start the local development server:

```bash
npm run dev
```

This command will start the Vite server, typically at `http://localhost:5173`. Open this URL in your web browser to see the application running.

## ⚙️ Configuration

*   **API Key**: The API key is managed via the `.env.local` file as described above.
*   **Data Storage**: All user data is stored locally in your browser's IndexedDB. It is encrypted using the password you provide on the first launch.

## 💻 Core Technologies

*   **React 19**: For building the user interface.
*   **TypeScript**: For type safety and better developer experience.
*   **Vite**: A modern, fast build tool for web development.
*   **@google/genai**: The official Google Gemini API client library.
*   **Tailwind CSS**: For styling the application.
*   **IndexedDB**: For local, persistent, and secure data storage.
*   **Web Crypto API**: For strong, end-to-end encryption of all user data.
