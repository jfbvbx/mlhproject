
async function askGemma(message) {
    const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Gemma request failed.");
    }

    if (!data.reply || !data.reply.trim()) {
        throw new Error("Gemma returned an empty response.");
    }

    return data.reply;
}

// HTML ELEMENTS
const setup = document.getElementById("setup");
const adventure = document.getElementById("adventure");
const gameOver = document.getElementById("gameOver");

const subjectInput = document.getElementById("subject");
const notesInput = document.getElementById("notes");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const floorDisplay = document.getElementById("floor");
const healthDisplay = document.getElementById("health");
const knowledgeDisplay = document.getElementById("knowledge");
const sceneTitle = document.getElementById("sceneTitle");
const storyDisplay = document.getElementById("story");
const choicesDisplay = document.getElementById("choices");
const statusDisplay = document.getElementById("status");

// GAME STATE
let subject = "";
let notes = "";
let floor = 1;
let health = 3;
let xp = 0;
let busy = false;

// BUTTON EVENTS
startBtn.addEventListener("click", startGame);

restartBtn.addEventListener("click", () => {
    if (busy) return;

    gameOver.classList.add("hidden");
    adventure.classList.add("hidden");
    setup.classList.remove("hidden");
});

// START GAME
async function startGame() {
    if (busy) return;

    subject = subjectInput.value.trim();
    notes = notesInput.value.trim().slice(0, 3000);

    if (!subject) {
        alert("Enter a subject first, genius.");
        return;
    }

    floor = 1;
    health = 3;
    xp = 0;

    setup.classList.add("hidden");
    gameOver.classList.add("hidden");
    adventure.classList.remove("hidden");

    updateStats();

    await generateScene(
        "Begin a new adventure. Introduce the setting and first encounter."
    );
}

// GENERATE ENCOUNTER
async function generateScene(playerAction) {
    if (busy) return;

    busy = true;

    statusDisplay.textContent = "Generating encounter...";
    choicesDisplay.replaceChildren();

    const prompt = `
You are the game master of Studybound, an educational roguelike.

Subject: ${subject}
Notes: ${notes || "Use accurate general knowledge."}
Floor: ${floor}
HP: ${health}/3
XP: ${xp}

Previous event: ${playerAction}

Create a short fantasy encounter that teaches one concept.

Rules:
- Be creative, sarcastic, and entertaining.
- Use accurate subject knowledge.
- Use notes when relevant.
- Story under 40 words.
- Exactly two choices.
- Choices should test or apply knowledge.
- Do not resolve the choices yet.
- Return ONLY a JSON object, no markdown.

JSON format:
{
  "title": "Short title",
  "story": "Short story",
  "choices": [
    {
      "text": "Choice one",
      "action": "Choice one action"
    },
    {
      "text": "Choice two",
      "action": "Choice two action"
    }
  ]
}
`;

    try {
        const reply = await askGemma(prompt);
        const scene = parseGemmaJSON(reply);

        if (
            typeof scene.title !== "string" ||
            typeof scene.story !== "string" ||
            !Array.isArray(scene.choices) ||
            scene.choices.length !== 2 ||
            scene.choices.some(choice =>
                typeof choice.text !== "string" ||
                typeof choice.action !== "string"
            )
        ) {
            throw new Error("Gemma returned an invalid scene structure.");
        }

        sceneTitle.textContent = scene.title;
        storyDisplay.textContent = scene.story;

        scene.choices.forEach((choice, index) => {
            const button = document.createElement("button");

            button.textContent = `${index + 1}. ${choice.text}`;

            button.addEventListener("click", () => {
                chooseAction(choice.action);
            });

            choicesDisplay.appendChild(button);
        });

        statusDisplay.textContent = "";

    } catch (error) {
        console.error("Scene generation error:", error);

        statusDisplay.textContent =
            "Encounter failed: " + error.message;

        const retryButton = document.createElement("button");
        retryButton.textContent = "Retry Encounter";

        retryButton.addEventListener("click", () => {
            generateScene(playerAction);
        });

        choicesDisplay.appendChild(retryButton);

    } finally {
        busy = false;
    }
}

// RESOLVE PLAYER CHOICE
async function chooseAction(action) {
    if (busy) return;

    busy = true;

    choicesDisplay.replaceChildren();
    statusDisplay.textContent = "Resolving your choice...";

    const prompt = `
You are resolving an educational roguelike action.

Subject: ${subject}
Notes: ${notes || "Use accurate knowledge."}
Floor: ${floor}
HP: ${health}
XP: ${xp}

Player action: ${action}

Determine the outcome.

Rules:
- Correct learning actions earn XP.
- Incorrect actions may cause 1 damage.
- Damage must be 0 or 1.
- XP must be 0 to 20.
- Explain the relevant concept.
- Outcome under 50 words.
- Return ONLY JSON.

{
  "outcome": "What happened",
  "correct": true,
  "damage": 0,
  "xp": 10,
  "finished": false
}
`;

    try {
        const reply = await askGemma(prompt);
        const result = parseGemmaJSON(reply);

        if (
            typeof result.outcome !== "string" ||
            typeof result.correct !== "boolean" ||
            typeof result.finished !== "boolean" ||
            !Number.isInteger(result.damage) ||
            ![0, 1].includes(result.damage) ||
            !Number.isInteger(result.xp) ||
            result.xp < 0 ||
            result.xp > 20
        ) {
            throw new Error("Gemma returned an invalid action result.");
        }

        health = Math.max(0, health - result.damage);
        xp += result.xp;

        statusDisplay.textContent = result.outcome;
        updateStats();

        if (health <= 0) {
            endGame(
                "Your Run Has Ended",
                `You reached floor ${floor} with ${xp} XP. ` +
                "Even the monsters understood the material better."
            );
            return;
        }

        if (result.finished) {
            endGame(
                "Adventure Complete!",
                `You finished with ${health} HP and ${xp} XP.`
            );
            return;
        }

        floor++;
        updateStats();

        // Unlock before generating the next scene.
        busy = false;

        await generateScene(
            `The player chose: ${action}. ` +
            `Outcome: ${result.outcome}. ` +
            `Continue the adventure.`
        );

    } catch (error) {
        console.error("Action error:", error);

        statusDisplay.textContent =
            "Action failed: " + error.message;

        const retryButton = document.createElement("button");
        retryButton.textContent = "Retry Choice";

        retryButton.addEventListener("click", () => {
            chooseAction(action);
        });

        choicesDisplay.appendChild(retryButton);

    } finally {
        busy = false;
    }
}

// PARSE GEMMA JSON
function parseGemmaJSON(reply) {
    console.log("Raw Gemma response:", reply);

    if (typeof reply !== "string" || !reply.trim()) {
        throw new Error(
            "Gemma returned no text. Increase maxOutputTokens."
        );
    }

    const cleaned = reply
        .replace(/```(?:json)?/gi, "")
        .trim();

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1) {
        throw new Error(
            "No JSON found in Gemma response: " +
            cleaned.slice(0, 200)
        );
    }

    try {
        return JSON.parse(cleaned.slice(start, end + 1));
    } catch (error) {
        throw new Error(
            "Invalid JSON: " + error.message
        );
    }
}

// UPDATE GAME STATS
function updateStats() {
    floorDisplay.textContent = `Floor ${floor}`;
    healthDisplay.textContent = `❤️ ${health} HP`;
    knowledgeDisplay.textContent = `📚 ${xp} XP`;
}

// END GAME
function endGame(title, message) {
    adventure.classList.add("hidden");
    gameOver.classList.remove("hidden");

    document.getElementById("endingTitle").textContent = title;
    document.getElementById("endingText").textContent = message;
}
