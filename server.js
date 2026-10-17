
const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");

// LOAD ENVIRONMENT VARIABLES
dotenv.config({
    path: path.join(__dirname, ".env")
});

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemma-4-26b-a4b-it";

if (!API_KEY) {
    console.error("ERROR: GEMINI_API_KEY missing from .env");
    process.exit(1);
}

console.log("API key loaded successfully!");

const ai = new GoogleGenAI({
    apiKey: API_KEY
});

// MIDDLEWARE
app.use(express.json({ limit: "100kb" }));

const publicFolder = path.join(__dirname, "public");
app.use(express.static(publicFolder));

// HEALTH CHECK
app.get("/api/health", (req, res) => {
    res.json({
        status: "Server is running",
        model: MODEL
    });
});

// GEMMA CHAT ENDPOINT
app.post("/api/chat", async (req, res) => {
    try {
        const message = req.body?.message;

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                error: "Please enter a message."
            });
        }

        // Limit input characters
        const prompt = message.trim().slice(0, 3000);

        
        const result = await ai.models.generateContent({
            model: "gemma-4-26b-a4b-it",
            contents: prompt,
            config: {
                temperature: 0.3
            }
        });

        const reply = result.text || "";

        const finishReason =
        result.candidates?.[0]?.finishReason || "UNKNOWN";

        console.log("Gemma response:", result.text);
        console.log("Finish reason:", result.candidates?.[0]?.finishReason);


        if (!reply.trim()) {
            return res.status(502).json({
                error: "Gemma returned an empty response.",
                finishReason
            });
        }

        // Remove markdown code fences if present
        const cleaned = reply
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        // Validate JSON before sending to game.js
        let parsed;

        try {
            parsed = JSON.parse(cleaned);
        } catch (error) {
            console.error("Invalid Gemma JSON:", cleaned);

            return res.status(502).json({
                error: "Gemma returned invalid JSON.",
                finishReason,
                details: error.message
            });
        }

        // Return JSON as a string for existing game.js
        res.json({
            reply: JSON.stringify(parsed),
            finishReason
        });

    } catch (error) {
        console.error("Gemma API error:", error);

        res.status(500).json({
            error: error.message || "Gemma API request failed."
        });
    }
});

// 404 HANDLER
app.use((req, res) => {
    res.status(404).json({
        error: `Not found: ${req.method} ${req.originalUrl}`
    });
});

// START SERVER
const server = app.listen(PORT, "127.0.0.1", () => {
    console.log("");
    console.log("================================");
    console.log("   STUDYBOUND SERVER ONLINE");
    console.log("================================");
    console.log(`Website: http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    console.log(`Model: ${MODEL}`);
    console.log(`Public folder: ${publicFolder}`);
    console.log("================================");
});

server.on("error", (error) => {
    console.error("Server startup error:", error.message);
});
