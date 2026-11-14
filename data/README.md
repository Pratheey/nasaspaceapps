# data/: data dictionary (owned by the data lane)

**Rule:** if a dataset isn't documented here, it doesn't exist. Other lanes and their
agents learn the data *only* from this page.

```
data/
├── raw/          git-ignored. Big original downloads go here, on each person's machine
├── processed/    small cleaned subsets (< 5 MB per file), committed for everyone
├── scripts/      download and clean scripts, so anyone can rebuild raw → processed
└── notebooks/    exploration (start from explore_template.py)
```

## Getting the data to everyone
- **Small files (< ~5 MB):** commit them to `data/processed/`.
- **Big files:** don't commit them. Use one of these instead:
  1. a `data/scripts/download_*.py` script that fetches them into `data/raw/` (best), or
  2. a shared Google Drive folder, with the link and the exact filenames listed below.
  Then commit a small cleaned subset (one region and time range) to `data/processed/`.

---

## Datasets

### SARS dataset: _TBD_
| field | value |
|---|---|
| Source | _product name, version, link/DOI_ |
| Access | _API / Earthdata download / shared drive link; script that fetches it_ |
| Files | _filenames, format (CSV / NetCDF / HDF5 / GeoTIFF), size_ |
| Variables | _name: meaning, **units**_ |
| Spatial | _region, resolution, projection_ |
| Temporal | _range, frequency, time zone_ |
| Quirks | _fill values, scale factors, gaps, known issues_ |
| Processed output | _`data/processed/<file>`: how it was made_ |
