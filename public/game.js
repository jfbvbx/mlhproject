
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
        throw new Error(data.error || "Gemma request failed");
    }

    return data.reply;
}



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

let subject = "";
let notes = "";
let floor = 1;
let health = 3;
let xp = 0;
let busy = false;

// Start a new adventure.
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", () => {
    gameOver.classList.add("hidden");
    setup.classList.remove("hidden");
});

async function startGame() {
    subject = subjectInput.value.trim();
    notes = notesInput.value.trim();

    if (!subject) {
        alert("Enter a subject first!");
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
        `Begin a new study roguelike adventure about ${subject}.
     Introduce the setting and the first encounter.`
    );
}

// Ask Gemma to create the next scene.
async function generateScene(playerAction) {
    if (busy) return;

    busy = true;
    statusDisplay.textContent = "The world is taking shape...";
    choicesDisplay.replaceChildren();

    const prompt = `
You are the game master for Studybound, a simple study roguelike.

SUBJECT: ${subject}
PLAYER'S STUDY NOTES:
${notes || "No notes provided. Use accurate general knowledge."}

CURRENT FLOOR: ${floor}
PLAYER HEALTH: ${health}/3
PLAYER XP: ${xp}

PLAYER'S LAST ACTION:
${playerAction}

Create the next short encounter in the adventure.

Rules:
- Make the story exciting, mysterious, and easy to understand.
- Teach one useful concept about the subject.
- Use the player's notes as the main study source when provided.
- Include exactly two choices.
- One choice should test knowledge, ask a question, or apply a concept.
- The other can explore, review, or take a different story action.
- Choices must have meaningful consequences.
- Do not decide the player's next choice.
- Keep the story under 130 words.
- Return ONLY valid JSON, without markdown fences.

Use exactly this JSON structure:
{
  "title": "Encounter title",
  "story": "The scene and study concept",
  "choices": [
    {
      "text": "First choice",
      "action": "What the player attempts"
    },
    {
      "text": "Second choice",
      "action": "What the player attempts"
    }
  ]
}
`;

    try {
        const reply = await askGemma(prompt);
        const scene = parseGemmaJSON(reply);

        if (
            !scene.title ||
            !scene.story ||
            !Array.isArray(scene.choices) ||
            scene.choices.length !== 2 ||
            scene.choices.some(
                choice => typeof choice.text !== "string" ||
                    typeof choice.action !== "string"
            )
        ) {
            throw new Error("Gemma returned an invalid scene.");
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
        console.error("Gemma error:", error);
        statusDisplay.textContent =
            "The encounter failed to load. Check your Gemma connection and try again.";

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

// Handle a selected choice and determine its consequences.
async function chooseAction(action) {
    if (busy) return;

    busy = true;
    choicesDisplay.replaceChildren();
    statusDisplay.textContent = "Resolving your action...";

    const resultPrompt = `
You are resolving one action in a study roguelike.

Subject: ${subject}
Study notes:
${notes || "Use accurate general knowledge."}

Floor: ${floor}
Current HP: ${health}/3
Current XP: ${xp}

The player chose:
${action}

Resolve the action using the subject's knowledge.

Return ONLY valid JSON:
{
  "outcome": "Short description of what happened",
  "correct": true,
  "damage": 0,
  "xp": 10,
  "finished": false
}

Rules:
- "correct" is true if the player successfully answered or applied
  the concept. For exploration choices, reward meaningful engagement.
- "damage" must be 0 or 1.
- "xp" must be an integer from 0 to 20.
- Award XP for learning and correct answers.
- A wrong answer can cause 1 damage.
- Exploration can reveal a useful explanation or hint.
- "finished" is true only when the player reaches a natural ending
  or the current encounter explicitly ends the run.
- Keep the outcome under 70 words.
- Never invent facts that contradict the supplied study notes.
`;

    try {
        const reply = await askGemma(resultPrompt);
        const result = parseGemmaJSON(reply);

        health = Math.max(
            0,
            health - (Number(result.damage) === 1 ? 1 : 0)
        );

        xp += Math.max(
            0,
            Math.min(20, Number(result.xp) || 0)
        );

        statusDisplay.textContent = result.outcome || "Action resolved.";
        updateStats();

        if (health <= 0) {
            endGame(
                "Your Run Has Ended",
                `You reached floor ${floor} and earned ${xp} XP. ` +
                "Rest, review your notes, and try another run."
            );
            busy = false;
            return;
        }

        if (result.finished) {
            endGame(
                "Adventure Complete!",
                `You conquered the adventure with ${health} HP ` +
                `and earned ${xp} XP. Keep studying to master ${subject}!`
            );
            busy = false;
            return;
        }

        floor++;

        await generateScene(
            `The player chose: ${action}
       The outcome was: ${result.outcome}
       Successful study action: ${Boolean(result.correct)}.
       Continue the story from this outcome.`
        );
    } catch (error) {
        console.error("Action error:", error);
        statusDisplay.textContent =
            "Could not resolve your choice. Please try again.";

        const retryButton = document.createElement("button");
        retryButton.textContent = "Retry Choice";
        retryButton.addEventListener("click", () => chooseAction(action));
        choicesDisplay.appendChild(retryButton);
    } finally {
        busy = false;
    }
}

// Parse JSON, including when Gemma wraps it in markdown.
function parseGemmaJSON(reply) {
    if (typeof reply !== "string") {
        reply = JSON.stringify(reply);
    }

    const cleaned = reply
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1) {
        throw new Error("No JSON found in Gemma response.");
    }

    return JSON.parse(cleaned.slice(start, end + 1));
}

function updateStats() {
    floorDisplay.textContent = `Floor ${floor}`;
    healthDisplay.textContent = `❤️ ${health} HP`;
    knowledgeDisplay.textContent = `📚 ${xp} XP`;
}

function endGame(title, message) {
    adventure.classList.add("hidden");
    gameOver.classList.remove("hidden");

    document.getElementById("endingTitle").textContent = title;
    document.getElementById("endingText").textContent = message;
}
