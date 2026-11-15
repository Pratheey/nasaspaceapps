# What the GPS check does and doesn't show (H-14 note, GPS lane)

Text for the limits panel and the pitch. Every figure is from `gps/processed/residuals.csv` and
`uncertainty.json` (stack v3, checked 2026-11-15).

**Says**
- NISAR and GPS agree to about **1.8 cm RMS per 12-day pair** at **13 held-out stations** (313 pairs, none
  flagged as a ~12 cm unwrapping jump). Station RMS runs 1.2 to 2.2 cm. All values are line of sight,
  relative to P304.
- Over the whole record the NISAR net change differs from GPS by **2.0 cm RMS** (12 stations; P297 has no
  net). That 1.98 cm is the ± on every net change in the app.

**Does not say**
- **This is a prototype check, not a valley-wide accuracy claim.** 13 stations sit in one frame (Track 034,
  Frame 020). Other frames, tracks and land types are untested.
- **The net residual is not centred on zero.** NISAR is less negative than GPS at 9 of 12 stations (mean
  +1.0 cm). The largest gap is CAFR, +4.7 cm. So the 2.0 cm figure mixes scatter with a small bias.
- **P304 is the reference and is not checked.** Every value is relative to it, and its own motion is
  assumed to be the GPS one.
- **GPS is not perfect either.** P307's antenna swap (2025-11-12, +12.9 mm north) was removed; its east
  component is still unexplained. The ten later stations were not checked against NGL's step list.
- **The five late-start stations** (CAFP, CAFR, CAHA, CAKC, TRAN) have no GPS on 2025-11-24, so their net
  change starts on 2025-12-06.
- **GPS checks displacement only.** Polarization and coverage use radar returns and coherence, and are
  not validated by GPS (D9).
- **Provisional data.** NISAR products will be reprocessed in 2027.
