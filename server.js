
require("dotenv").config();

const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Google Gemma API
if (!process.env.GEMMA_API_KEY) {
    console.error("Missing GEMMA_API_KEY in .env");
    process.exit(1);
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMMA_API_KEY
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Test whether the server is running
app.get("/api/health", (req, res) => {
    res.json({ status: "Server is running" });
});

// Send messages to Gemma
app.post("/api/chat", async (req, res) => {
    try {
        const { message } = req.body || {};

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                error: "Please provide a message."
            });
        }

        const result = await ai.models.generateContent({
            model: "gemma-4-26b-a4b-it",
            contents: message.trim()
        });

        res.json({
            reply: result.text || "Gemma returned no text."
        });
    } catch (error) {
        console.error("Gemma API error:", error.message);

        res.status(500).json({
            error: "Gemma request failed. Check your API key, model access, and API availability."
        });
    }
});

// Handle missing API endpoints
app.use("/api", (req, res) => {
    res.status(404).json({
        error: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
});

// Handle missing website files
app.use((req, res) => {
    res.status(404).send(`File or page not found: ${req.originalUrl}`);
});

// Start server
app.listen(PORT, () => {
    console.log(`Website: http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});
