import asyncio
import json
import os
import time
from collections import Counter
from pathlib import Path

from browser_use import Agent
from langchain_anthropic import ChatAnthropic
from personas import ARCHETYPES, generate_personas

BASE_URL = os.environ.get("ONTRIFICE_URL", "https://ontrifice.vercel.app")
BATCH_SIZE = 5
LOGS_DIR = Path(__file__).parent / "logs"

ARCHETYPE_BACKSTORIES = {
    "trader": (
        "You're a prediction market trader who's been active on Polymarket and Kalshi "
        "for a couple years. You heard about Ontrifice from a tweet claiming it finds "
        "cross-market mispricings. You're impatient, you know what arbitrage looks like, "
        "and you don't need anything explained to you. You want to see if this tool can "
        "actually surface edges you'd miss manually. If it seems useful, you might sign up "
        "to get an API key so you can pull data into your own models."
    ),
    "researcher": (
        "You're a quantitative researcher interested in prediction markets as forecasting "
        "instruments. You want to understand the methodology -- how they compute conditional "
        "probabilities, what coherence means formally, how they handle correlated events. "
        "You read carefully. You'll check the docs and try the conditional probability "
        "interface with real questions you've been thinking about. If the methodology is "
        "sound, you'll sign up for API access to pull data for a paper you're working on."
    ),
    "curious_browser": (
        "You saw a link to this site on social media and clicked through out of curiosity. "
        "You know roughly what prediction markets are but you're not a power user. You'll "
        "glance at the homepage, maybe play with the graph if it looks interesting. You "
        "probably won't sign up unless something really grabs you. Your attention span for "
        "this is maybe 2-3 minutes."
    ),
    "developer": (
        "You're a software developer who wants a prediction market data API. You don't "
        "care about marketing copy -- you want to see endpoints, response formats, rate "
        "limits, and authentication. You'll go straight to the docs. If the API looks well "
        "designed, you'll sign up and generate a key. You might poke at a few endpoints "
        "directly in the browser to see what comes back."
    ),
    "skeptic": (
        "You're skeptical about this tool's claims. You want to test whether the "
        "'incoherence detection' actually works or if it's just noise. You'll try weird "
        "edge cases in the conditional probability interface -- like conditioning a market "
        "on itself, or picking two completely unrelated markets. You'll pay attention to "
        "error messages and whether the site handles nonsense gracefully. You're not "
        "hostile, just rigorous."
    ),
    "lost": (
        "You clicked a link somewhere and ended up on this site. You're not really sure "
        "what prediction markets are. You'll scroll the homepage for a few seconds, maybe "
        "click one link, realize this isn't for you, and leave."
    ),
}


def build_system_prompt(persona: dict) -> str:
    backstory = ARCHETYPE_BACKSTORIES[persona["archetype"]]
    patience_desc = (
        "very impatient" if persona["patience"] < 0.3
        else "moderately patient" if persona["patience"] < 0.7
        else "patient and thorough"
    )
    tech_desc = (
        "not very technical" if persona["technical_level"] < 0.3
        else "somewhat technical" if persona["technical_level"] < 0.7
        else "highly technical"
    )

    return (
        f"You are {persona['name']}, a {persona['age']}-year-old who is {patience_desc} "
        f"and {tech_desc}. {backstory}\n\n"
        f"Browse the site naturally. Don't narrate or explain what you're doing -- just "
        f"do it. If something is broken or confusing, react the way you actually would. "
        f"If you decide to sign up, use email: {persona['email']} and "
        f"password: {persona['password']}.\n\n"
        f"Start at: {BASE_URL}"
    )


async def run_persona(persona: dict, llm: ChatAnthropic) -> dict:
    start = time.time()
    prompt = build_system_prompt(persona)

    agent = Agent(
        task=prompt,
        llm=llm,
        max_actions_per_step=4,
    )

    errors = []
    pages_visited = []
    signed_up = False
    generated_api_key = False
    action_history = []

    try:
        result = await agent.run(max_steps=30)

        for step in result.history:
            for action in step.model_output.action if step.model_output else []:
                action_dict = action.model_dump() if hasattr(action, "model_dump") else str(action)
                action_history.append(action_dict)

            if step.state and step.state.url:
                url = step.state.url
                if url not in pages_visited:
                    pages_visited.append(url)

            if step.state and step.state.error:
                errors.append(step.state.error)

        result_text = result.final_result() or ""
        if "sign" in result_text.lower() and "up" in result_text.lower():
            signed_up = True
        if "api key" in result_text.lower() or "api_key" in result_text.lower():
            generated_api_key = True

        for step in result.history:
            if step.state and step.state.url:
                url = step.state.url
                if "/signup" in url or "/login" in url:
                    for a in (step.model_output.action if step.model_output else []):
                        a_str = str(a)
                        if "click" in a_str.lower() and ("sign" in a_str.lower() or "create" in a_str.lower()):
                            signed_up = True
                if "/settings" in url:
                    generated_api_key = True

    except Exception as e:
        errors.append(f"agent crashed: {str(e)}")

    duration = round(time.time() - start, 1)

    return {
        "persona": persona,
        "pages_visited": pages_visited,
        "signed_up": signed_up,
        "generated_api_key": generated_api_key,
        "session_duration_seconds": duration,
        "action_history": action_history,
        "errors": errors,
    }


async def run_batch(personas: list[dict], llm: ChatAnthropic) -> list[dict]:
    tasks = [run_persona(p, llm) for p in personas]
    return await asyncio.gather(*tasks)


async def main():
    personas = generate_personas()
    print(f"loaded {len(personas)} personas")
    print(f"target: {BASE_URL}\n")

    llm = ChatAnthropic(
        model="claude-haiku-4-5-20250514",
        temperature=0.7,
        max_tokens=1024,
    )

    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    all_results = []

    for i in range(0, len(personas), BATCH_SIZE):
        batch = personas[i : i + BATCH_SIZE]
        batch_names = [p["name"] for p in batch]
        print(f"batch {i // BATCH_SIZE + 1}/{-(-len(personas) // BATCH_SIZE)}: {', '.join(batch_names)}")

        results = await run_batch(batch, llm)
        all_results.extend(results)

        for result in results:
            name_slug = result["persona"]["name"].lower().replace(" ", "_")
            log_path = LOGS_DIR / f"{name_slug}.json"
            log_path.write_text(json.dumps(result, indent=2, default=str))

        print(f"  completed {len(results)} sessions\n")

    print_summary(all_results)


def print_summary(results: list[dict]):
    print("=" * 60)
    print("SIMULATION SUMMARY")
    print("=" * 60)

    total = len(results)
    signups = sum(1 for r in results if r["signed_up"])
    api_keys = sum(1 for r in results if r["generated_api_key"])

    print(f"\ntotal sessions: {total}")
    print(f"signed up: {signups}")
    print(f"generated api key: {api_keys}")

    page_counts: Counter[str] = Counter()
    for r in results:
        for page in r["pages_visited"]:
            path = page.replace(BASE_URL, "") or "/"
            page_counts[path] += 1

    print("\nmost visited pages:")
    for page, count in page_counts.most_common(10):
        print(f"  {page}: {count}")

    durations_by_archetype: dict[str, list[float]] = {}
    for r in results:
        arch = r["persona"]["archetype"]
        durations_by_archetype.setdefault(arch, []).append(r["session_duration_seconds"])

    print("\naverage session duration by archetype:")
    for arch, durations in sorted(durations_by_archetype.items()):
        avg = sum(durations) / len(durations)
        print(f"  {arch}: {avg:.1f}s ({len(durations)} sessions)")

    all_errors: Counter[str] = Counter()
    for r in results:
        for err in r["errors"]:
            all_errors[err] += 1

    if all_errors:
        print(f"\nerrors encountered ({sum(all_errors.values())} total, {len(all_errors)} unique):")
        for err, count in all_errors.most_common():
            print(f"  [{count}x] {err[:120]}")
    else:
        print("\nno errors encountered")

    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
