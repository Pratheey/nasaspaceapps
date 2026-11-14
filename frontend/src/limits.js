// Text from docs/pitch/limits.md (owned by the integrator). Keep the two in sync.
export const LIMITS_HTML = `
<h2>What this map can and can't tell you</h2>
<h3>What it shows</h3>
<p>Ground motion measured by NISAR along the radar's line of sight, relative to GPS station
<span data-ref></span>. Negative means moving away from the satellite, which here is mostly sinking.</p>
<p>The main map is the change from the first to the last date. Those dates fall in nearly the
same season, so most of the seasonal movement cancels out.</p>
<h3>What the fit means</h3>
<p>Each location is fitted with a steady trend plus a once-a-year cycle. With less than a year
of data the two can trade off, so the trend is shown with its uncertainty and is never the
headline.</p>
<p>Seasonal size and timing are shown only where the cycle passes a significance test.
Elsewhere the app says the seasonal part is not significant.</p>
<h3>What it does not mean</h3>
<p>It does not say how much of the sinking is permanent. It does not measure water volume,
aquifer health, or where to recharge. Hatched areas mean we could not tell, not that the
ground is stable.</p>
<h3>How we checked it</h3>
<p>GPS stations <span data-held></span> were never used to calibrate the radar. Their
disagreement with NISAR is shown when GPS check is on. Three check stations make a prototype
check, not a valley-wide accuracy claim.</p>
<h3>About the data</h3>
<p>NISAR data here is provisional. NASA and ISRO will release reprocessed, validated versions
in 2027. Each pair is corrected for the ionosphere using the product's own correction layer.
Published figures (levee heights, canal capacity) are other people's measurements and are
credited where shown.</p>
`;
