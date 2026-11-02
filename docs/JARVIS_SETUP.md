# Jarvis setup

Jarvis is a skill plus the connectors it uses. The skill is `.claude/skills/jarvis/SKILL.md`.

## What runs where

Cloud sessions (claude.ai/code) can use connectors such as Gmail and Metricool but cannot control his browser or desktop. Browser and desktop control only work in the Claude desktop app on his own computer. So Jarvis is used from the desktop app.

## Setup order

1. Install the Claude desktop app and sign in.
2. Connectors: turn on Gmail, Google Calendar, Google Drive, Notion, and Metricool (or PostFast). Settings, Connectors.
3. Browser: install the Claude in Chrome extension and sign in to Chrome with the accounts Jarvis should use (email, Instagram, Metricool).
4. Desktop: Settings, Computer use, turn on. Grant screen and accessibility permission when macOS asks. Leave password managers and banking apps off the allowed list.
5. Skill: copy `.claude/skills/jarvis` to `~/.claude/skills/jarvis` so it loads in every project, or open this repo in the desktop app.
6. Test in this order, each with a draft or read-only task:
   - "Jarvis, check my inbox" (read only)
   - "Jarvis, draft a reply to the newest client email" (draft only)
   - "Jarvis, show last week's Instagram numbers" (read only)
   - "Jarvis, open my Metricool dashboard in Chrome and tell me the top post" (browser)
7. Optional routines: 07:00 morning brief and 16:00 sweep, read and draft only.

## Approval rules in short

Free: read, search, summarise, draft, schedule for review.
Needs a yes: send, publish, reply publicly, delete, pay, submit a commitment.

## Not covered

Voice (talk to it, hear it answer): Wispr Flow for input, ElevenLabs for output. Add last.
Revenue: add the payment tool's connector and one line to the morning brief.
