import json
import random
from pathlib import Path

from faker import Faker

fake = Faker()
Faker.seed(42)
random.seed(42)

ARCHETYPES = {
    "trader": {
        "weight": 25,
        "description": "prediction market power user, familiar with Polymarket/Kalshi/Metaculus",
        "routes": ["/incoherences", "/cascades", "/explore"],
        "signup_likelihood": 0.6,
    },
    "researcher": {
        "weight": 15,
        "description": "academic or quant, methodical reader, wants to understand methodology",
        "routes": ["/", "/conditionals", "/docs", "/explore"],
        "signup_likelihood": 0.8,
    },
    "curious_browser": {
        "weight": 30,
        "description": "casual visitor from social media, short attention span for unfamiliar tools",
        "routes": ["/", "/explore"],
        "signup_likelihood": 0.15,
    },
    "developer": {
        "weight": 15,
        "description": "software developer who wants the API, skips marketing copy",
        "routes": ["/docs", "/explore"],
        "signup_likelihood": 0.7,
    },
    "skeptic": {
        "weight": 10,
        "description": "came to poke holes, tests edge cases, reads error messages carefully",
        "routes": ["/", "/conditionals", "/incoherences"],
        "signup_likelihood": 0.3,
    },
    "lost": {
        "weight": 5,
        "description": "ended up here by accident, will leave quickly",
        "routes": ["/"],
        "signup_likelihood": 0.02,
    },
}

PASSWORDS = [
    "Skyblue42!", "marcus2024", "Tr@ding2026", "quantlife88",
    "M0neyball!", "datadata1", "pr0bability", "Bayes!an99",
    "f0recast3r", "alpha_seek", "mktMaker21", "EdgeFind3r",
    "p0lywhale", "N0iseTrad3", "calibr8ed!", "sharpRatio1",
    "blackSwan9", "r1skParity", "volSurf42!", "deepValue7",
    "signal2noise", "kellyCrit!", "meanRevert3", "gammaFlip2",
    "thetaGang1", "deltaH3dge", "arbFindr!", "convexity9",
    "tailR1sk!", "momentumX3",
]


def generate_personas(n: int = 30) -> list[dict]:
    archetype_pool = []
    for name, info in ARCHETYPES.items():
        archetype_pool.extend([name] * info["weight"])

    personas = []
    for i in range(n):
        first = fake.first_name()
        last = fake.last_name()
        archetype = random.choice(archetype_pool)

        email_base = f"{first.lower()}.{last.lower()}"
        email = f"{email_base}.{random.randint(1, 99)}@ontrifice.test"

        persona = {
            "name": f"{first} {last}",
            "email": email,
            "password": PASSWORDS[i % len(PASSWORDS)],
            "archetype": archetype,
            "patience": round(random.uniform(0.1, 1.0), 2),
            "technical_level": round(random.uniform(0.1, 1.0), 2),
            "age": random.randint(19, 58),
        }
        personas.append(persona)

    return personas


if __name__ == "__main__":
    personas = generate_personas()
    out = Path(__file__).parent / "personas.json"
    out.write_text(json.dumps(personas, indent=2))
    print(f"generated {len(personas)} personas -> {out}")

    by_archetype: dict[str, int] = {}
    for p in personas:
        by_archetype[p["archetype"]] = by_archetype.get(p["archetype"], 0) + 1
    for arch, count in sorted(by_archetype.items(), key=lambda x: -x[1]):
        print(f"  {arch}: {count}")
