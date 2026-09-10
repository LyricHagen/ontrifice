# user simulations

Runs 30 AI-driven personas through the live Ontrifice site using [browser-use](https://github.com/browser-use/browser-use). Each persona has a distinct archetype (trader, researcher, curious browser, developer, skeptic, lost) that shapes how they naturally browse.

## setup

```
cd sims
pip install -r requirements.txt
playwright install
```

## run

```
export ANTHROPIC_API_KEY=sk-ant-...
export ONTRIFICE_URL=https://ontrifice.vercel.app  # optional, this is the default
python run.py
```

Personas are generated deterministically (Faker seed 42). Agents run in batches of 5 concurrently.

## output

Session logs are written to `sims/logs/{persona_name}.json` with pages visited, signup/API key status, action history, errors, and timing.

A summary prints at the end with signup rates, page popularity, and deduplicated errors.

## cost

Estimated ~$2-5 for 30 Haiku agents depending on session length.
