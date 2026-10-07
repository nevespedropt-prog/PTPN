---
name: gemini
description: Ask Google Gemini a question or get a second opinion from it. Use when the user says "ask Gemini", "get Gemini's take", or wants a Gemini model's answer to a prompt.
---

# Gemini

Sends a prompt to Gemini and prints the reply.

## Requirements
- `pip install google-genai truststore` (truststore is optional; it fixes certificate errors behind antivirus or a VPN)
- `GEMINI_API_KEY` set in the environment (never paste the key into chat or commit it)

## Usage
Run the bundled script from this skill's folder:

    python gemini_ask.py "your prompt"
    python gemini_ask.py -m gemini-2.5-flash "your prompt"

Default model is `gemini-flash-latest`. If the script says the key is missing, tell the user to set `GEMINI_API_KEY` and stop. Report Gemini's answer as Gemini's, not your own.
