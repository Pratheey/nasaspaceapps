# Team Roles: The Breathing Ground

*For the humans on the team. Read your section. Takes 5 minutes.*

---

## What we're building, in plain English

Farms in California's San Joaquin Valley pump a lot of groundwater. When water is pumped
out, the ground **sinks**. When the water comes back, the ground **rises a little**, but not
all the way. So the ground "breathes" up and down every year while slowly sinking overall.

That breathing can hide the sinking. If you compare two random dates, a sinking area can
look stable, or even look like it's rising.

NASA's new **NISAR** satellite measures ground movement down to the centimetre using radar.
We'll use its first year of data to build an **interactive map** where anyone can click a
spot and see:
- how much the ground moved
- how much of that is the yearly "breathing" and how much is steady sinking
- how sure we are
- whether a **GPS station** on the ground agrees with the satellite

**Our one-line pitch:** *See where seasonal rebound hides continued sinking, and inspect the
evidence behind every result.*

## Team goals

1. **Real NISAR data on the map.** This is the core of the project. Fake data doesn't count.
2. **Proof it's right.** Compare the satellite with GPS stations it never saw.
3. **Answer the whole brief.** Show what NISAR's polarization reveals, and whether it sees more than older satellites.
4. **Honest about uncertainty.** Show what we know and what we don't. Never overclaim.
5. **A demo judges remember.** Two GPS stations, Five Points and Hanford, where the ground
   rises about 1 cm over winter and then sinks 5–6 cm by August, and the satellite sees it.
6. **Submit early.** Target hour 22, not hour 24.

## Key moments (everyone)

| Hour | What happens |
|---|---|
| **0** | Kickoff. Everyone clones the repo and sets their lane. |
| **2** | Check-in 1. File formats agreed. Everyone can work without waiting on anyone. |
| **5** | 🚦 **Go/no-go.** Does the satellite agree with GPS? First result: within about 2 cm, with no jumps. Proposed call: go (Daniel confirms). |
| **6** | Check-in 2. Show what works. |
| **12** | Check-in 3. Real data should be flowing all the way to the map. |
| **18** | Check-in 4. 🧊 **Feature freeze.** No new features, only fixes. |
| **22** | 📨 **Submit.** |
| **24** | Deadline. Our buffer. |

Check-ins are 15 minutes max. Show what works, say what's blocking you, then get back to it.

---

## 🛰️ Pratheek: Satellite Data Lead

**In one sentence:** you get the NISAR satellite data, clean it, and hand a ready-to-use
version to Ismail.

**Why it matters:** everything depends on your data. You're the first domino.

**Your goals:**
- **By hour 2:** logged in to NASA Earthdata, opened one real NISAR file, and confirmed it has what we need.
- **By hour 4:** first pair of dates cleaned up and sent to Daniel to check against GPS.
- **By hour 10:** all ~26 dates processed and shared with Ismail.
- **By hour 12:** your scripts can run on a different satellite track, so Steven can reuse them.
- **By hour 16:** data frozen, every source written down.

**You give:**
- Daniel: the first pair (hour 4).
- Ismail: the full dataset (hour 10).
- Steven: your scripts, ready to run on the second track (hour 12). He runs them, you don't have to.

**You need:** GPS station locations from Daniel (hour 1).

**Where you are (14 Nov):** all 25 date pairs are processed and the scripts work on any
track. Left to do: upload the big file to the shared Drive, get terrain heights to improve
the weather correction in the hills, and help Steven run the second track.

**Watch out for:**
- Don't download the whole 54 GB. Read only our small area.
- If you're stuck for more than 30 minutes, tell Ryan right away. Everyone is waiting on you.

**Your folder:** `data/`

---

## 📊 Ismail: Analysis Lead

**In one sentence:** you turn Pratheek's data into the answers the map shows: how much it
sank, how much it "breathed", how sure we are, and the label for each spot.

**Why it matters:** you're the brain of the project. Your numbers are what judges see.

**Your goals:**
- **By hour 2:** the math works on fake data where you already know the right answer.
- **By hour 6:** you can produce all 4 map labels (see below).
- **By hour 12:** results on real data, using Daniel's GPS-based uncertainty.
- **By hour 14:** files ready for Avi's map.

**The 4 labels each spot on the map gets:**
1. Breathes with the seasons **and** keeps sinking
2. Breathes with the seasons, no clear sinking
3. Keeps sinking, breathing unclear
4. Not enough evidence

**You give:**
- Avi: the map data files (hour 14).
- Ryan: every number for the pitch (hour 19).

**You need:**
- Pratheek: the satellite data (hour 10; partial earlier).
- Daniel: the uncertainty numbers (hour 11).

**Watch out for:**
- The yearly "breathing" is small and the satellite wobbles about 2 cm per date. Only show
  it where the math says it's real. Hiding it where it isn't real is the honest answer.
- Don't use single pixels. Use the middle value (median) of all the pixels in each 1 km map
  square. Single pixels have gaps and pick up wet-field effects that look like sinking.
- The usual significance test finds "breathing" even on solid rock. Set the bar using
  ground that shouldn't move.

**Your folders:** `analysis/` and `frontend/public/data/`

---

## 📡 Steven: Radar Specialist

**In one sentence:** you handle the other radar products. You show what NISAR's
polarization reveals about crops, whether NISAR sees more farmland than the older
Sentinel-1 satellite, and how to split ground motion into up/down vs sideways.

**Why it matters:** the challenge asks about polarization and what's new about NISAR. The
main map doesn't answer those questions; your work does. Your results go straight into the
pitch and the "answers to the brief."

**Your 3 projects, in order:**
1. **Polarization (hours 0–6):** NISAR measures the radar bounce in two ways (HH and HV).
   You compare them across ~30 crop fields of different types through the season.
2. **Coverage comparison (hours 6–11):** for the same fields, how often does NISAR get a
   usable measurement vs Sentinel-1? You pick a clear threshold and report the result,
   good or bad.
3. **Up/down vs sideways (hours 12–18):** the satellite also passes over in the opposite
   direction (descending). You process that second track with Pratheek's scripts, then
   combine both directions to separate vertical motion from east–west motion, and check
   it against GPS.

**Your goals:**
- **By hour 1:** the products found, ~30 crop fields picked, and Sentinel-1 processing jobs requested (they take time).
- **By hour 6:** polarization result to Ryan.
- **By hour 11:** coverage comparison to Ryan.
- **By hour 15:** first descending pair agrees with GPS.
- **By hour 18:** vertical vs east–west result, checked against GPS.

**You give:** Ryan: all 3 results, each with a chart and a short "what this does and doesn't show" note.

**You need:**
- Daniel: station locations (hour 1) and cleaned GPS motion (hour 4).
- Pratheek: his scripts, ready to run on another track (hour 12).

**Watch out for:**
- Only claim what the crop labels confirm.
- Report the coverage comparison even if NISAR doesn't win.
- If the descending track runs late, the first two projects come first. They're core; the third is a bonus.
- Never edit Pratheek's files. Ask him if you need a change.

**Your folder:** `radar/`

---

## 📍 Daniel: GPS & Validation

**In one sentence:** you use GPS stations on the ground to check whether the satellite is
telling the truth.

**Why it matters:** without you, we're just showing pretty colors. With you, we can say
"an independent instrument agrees."

**Your goals:**
- **By hour 1:** GPS data downloaded for 14 stations (the list is in `data/processed/stations_ngl.csv`).
- **By hour 2:** equipment jumps checked and removed at every station.
- **By hour 5:** compare the satellite's first pair with GPS. **You make the go/no-go call with Pratheek.**
- **By hour 10:** map extras gathered (canals, towns, groundwater, older subsidence data).
- **By hour 11:** the "does it agree?" table done, plus any bad satellite dates flagged.

**You give:**
- Pratheek and Steven: station locations (hour 1).
- Steven: cleaned GPS motion (hour 4).
- Ismail: uncertainty numbers and flagged bad dates (hour 11).
- Avi: GPS data and map extras.

**You need:** Pratheek's first pair (hour 4).

**Watch out for:** one station (P304) is the "reference" and doesn't count as a check. The
other 12 are the real test. That is still a prototype check, not proof for the whole valley.

**Your folders:** `gps/` and `context/`

---

## 🗺️ Avi: Map & App

**In one sentence:** you build the website judges actually click on.

**Why it matters:** this is what judges see first. Clear and smooth wins.

**Your goals:**
- **By hour 2:** a map of the valley running on your laptop.
- **By hour 6:** the map shows colored labels, using fake data Ryan gives you.
- **By hour 10:** click any spot to see a chart of its movement.
- **By hour 14:** running on **real** data from Ismail.
- **By hour 16:** the demo animation for stations CAFP (Five Points) and CAHA (Hanford), with P300 as the calm one.
- **By hour 18:** everything in, then feature freeze.
- **By hour 20:** live on a public link that works on laptop and phone.

**What the app needs:**
- the map with labels and a legend
- click to see a chart for any spot
- a "GPS reveal" button that shows whether GPS agrees
- the Five Points and Hanford animation (CAFP, CAHA), with P300 as the calm comparison
- a "breathing vs sinking" scatter plot
- a "Limits" panel (Ryan writes the text)

**You need:**
- Ryan: fake data (hour 3), so you're never stuck waiting.
- Ismail: real data (hour 14).
- Daniel: GPS data and map extras.

**Your folder:** `frontend/` (but not `frontend/public/data/`, which is Ismail's)

---

## 🧭 Ryan: Team Lead & Storyteller

**In one sentence:** you keep everyone unblocked and own what the judges read and hear.

**Why it matters:** six people working fast will drift apart without someone holding it
together, and a great project with a weak pitch loses.

**Your goals:**
- **By hour 1:** teammates added on GitHub, `main` protected, a shared Google Drive folder for big files.
- **By hour 2:** a 15-minute meeting to agree how files hand off between people, written down.
- **By hour 3:** fake data made for Avi.
- **By hour 5:** run the go/no-go call and write down the result.
- **By hour 12:** pitch outline done, including Steven's polarization and coverage results.
- **By hour 18:** Limits panel text, video script, and a check that we never overclaim.
- **By hour 22:** every number verified, video recorded, **submitted**.

**You also:**
- run all check-ins
- merge everyone's pull requests
- update `docs/PROJECT.md` when plans change

**Things we must never say** (you're the guard):
- "Only NISAR can do this" (other satellites can too)
- "Permanent", "irreversible" or "storage loss" for anything we fitted
- "We validated it" before Daniel's table exists
- Published figures (14 km³, 30 cm/yr) presented as our own results

**Your folders:** `docs/` and everything shared

---

## If the satellite data doesn't work (hour 5)

Don't panic. Ryan records the decision, and then:
- Daniel's older satellite data (Sentinel-1) shows the breathing pattern instead.
- Pratheek keeps whatever NISAR dates do work, clearly labelled.
- Steven's polarization and coverage work doesn't depend on this, so he keeps going.
- Everyone else keeps going. Your tasks don't change.

## If we get 48 hours instead of 24

| Who | Extra work |
|---|---|
| Pratheek | Recover areas that got masked out; reprocess with any updated NISAR files |
| Ismail | Seasonal/trend fit on Steven's vertical motion, canal profile |
| Steven | Full up/down vs sideways time series, more fields and dates in the coverage comparison |
| Daniel | Historical data along canals and at the stations |
| Avi | Canal profile, history panel, up/down toggle, polarization and coverage panels in the app |
| Ryan | Pitch polish, a second video take, practice for judge questions |

---

## Working together without stepping on each other

- **Stay in your folder.** Your AI agent is set up to block edits to other people's folders. That's what keeps us out of merge conflicts.
- **Need something from someone?** Ask them. Don't edit their files.
- **Small pushes, often.** Make a branch, open a pull request, and Ryan merges it.
- **Before you start working:** run `./scripts/sync.sh` to get everyone's latest work.
- **If the plan changes:** Ryan updates `docs/PROJECT.md` and posts in the group chat. Pull, then restart your agent.

**First-time setup** (once each). Run these one at a time:
```bash
git clone https://github.com/Pratheey/nasaspaceapps.git
```
```bash
cd nasaspaceapps
```
Then set your lane with the line for your name:
- Pratheek: `echo nisar > .lane`
- Ismail: `echo analysis > .lane`
- Steven: `echo radar > .lane`
- Daniel: `echo gps > .lane`
- Avi: `echo frontend > .lane`
- Ryan: `echo integrator > .lane`

More detail:
- [docs/PLAN.md](docs/PLAN.md): your hour-by-hour task list
- [docs/PROPOSAL.md](docs/PROPOSAL.md): the full science proposal
- [docs/WORKFLOW.md](docs/WORKFLOW.md): git step by step
