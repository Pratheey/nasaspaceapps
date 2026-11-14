# contracts/: agreed interfaces between lanes (owned by the Integrator)

Empty until the idea is chosen. In the first hours, put the agreed shapes here:
- the format of processed data files (columns, units), from data to backend
- the format of what the backend serves (JSON/API shapes), from backend to frontend
- a small **sample file** for each shape, so the frontend can build before real data exists

To change a contract: open an issue, update the shape **and** its sample in one PR, merge
it, and announce "contract changed, pull now." Prefer adding fields over renaming or
removing them.
