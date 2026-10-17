
const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT;

// Replace with your NEW Google API key.
// Keep this file private; never put the key in browser JavaScript.
const API_KEY = process.env.GEMINI_API_KEY;

//new stuff i added
const ai = new GoogleGenAI({ apiKey: API_KEY });

app.use(express.json());

// Serve files from the public folder beside server.js
const publicFolder = path.join(__dirname, "public");
app.use(express.static(publicFolder));

app.get("/api/health", (req, res) => {
    res.json({ status: "Server is running" });
});

app.post("/api/chat", async (req, res) => {
    try {
        const message = req.body?.message;

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({ error: "Please enter a message." });
        }

        const result = await ai.models.generateContent({
            model: "gemma-4-26b-a4b-it",
            contents: message.trim(),
            config: {
                maxOutputTokens: 250,
                temperature: 0.5
            }
        });


        res.json({ reply: result.text || "No response returned." });
    } catch (error) {
        console.error("Gemma API error:", error.message);
        res.status(500).json({ error: "Gemma API request failed." });
    }
});

// Show a useful message for missing files or pages
app.use((req, res) => {
    res.status(404).send(`Not found: ${req.method} ${req.originalUrl}`);
});

// Start the server and report startup errors
const server = app.listen(PORT, "127.0.0.1", () => {
    console.log("Node.js server started successfully.");
    console.log(`Website: http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Serving website files from: ${publicFolder}`);
});

server.on("error", (error) => {
    console.error("Server startup error:", error.message);
});
