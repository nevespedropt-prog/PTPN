#!/usr/bin/env python3
"""Send a prompt to Gemini and print the reply.

Setup:  pip install google-genai
        export GEMINI_API_KEY=...   (or GOOGLE_API_KEY)
Usage:  python3 scripts/gemini_ask.py "Explain how AI works in a few words"
        python3 scripts/gemini_ask.py -m gemini-flash-latest "your prompt"
"""
import argparse
import os
import sys

from google import genai


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("prompt", nargs="+", help="prompt text")
    parser.add_argument("-m", "--model", default="gemini-flash-latest")
    args = parser.parse_args()

    if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")):
        print("Set GEMINI_API_KEY (or GOOGLE_API_KEY) first.", file=sys.stderr)
        return 1

    client = genai.Client()
    response = client.models.generate_content(
        model=args.model,
        contents=" ".join(args.prompt),
    )
    print(response.text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
