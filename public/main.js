
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

// Example usage
askGemma("Explain what JavaScript does.")
    .then(reply => console.log("Gemma:", reply))
    .catch(error => console.error(error));
