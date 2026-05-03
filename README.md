# HVAC Guardian — Technical Assessment

## The Problem I Actually Tried to Solve

Alert fatigue isn't a technology problem. It's a trust problem.

When 90% of alerts are false, the human response is rational: stop looking. The team didn't fail — the system failed them. Two equipment failures last quarter didn't happen because technicians were careless. They happened because the signal was buried so deep in noise that the team had learned, correctly, that alerts meant nothing.

So the goal wasn't "build a smarter alert system." It was: **rebuild the signal-to-noise ratio until looking at the system is worth the technician's time again.** That reframe drove every decision.

---

## Approach to the Problem

### Why Thresholds Failed (and Why "Better Thresholds" Would Too)

The previous system compared every reading against fixed limits. This fails structurally for two reasons:

**1. Units aren't identical.** A server room HVAC runs hotter than an assembly line unit by design. Any threshold that catches real problems on one will false-alarm constantly on the other. You can tune per-unit thresholds, but then you need to maintain 200 of them, and they drift as equipment ages.

**2. Single-sensor spikes are usually noise.** Electromagnetic interference, a compressor cycle in the next bay, a momentary sensor dropout — all of these look like alarms on a threshold system. None of them indicate equipment failure.

The insight that changed the design: **anomalies are relative, not absolute, and real failures are loud across multiple sensors simultaneously.**

### The Detection Engine

Three layers, each targeting a different failure mode of the previous system:

**Layer 1 — Per-Unit Rolling Z-Score**

Instead of comparing against a fixed threshold, each unit's first 100 readings establish its personal baseline (mean + standard deviation per sensor). Every new reading is scored against *that unit's own history* — how many standard deviations from its own normal.

This means:
- A hot-running server room unit scores z ≈ 0 because its elevated temperature *is* its baseline
- The same unit suddenly running 4°C hotter than usual scores z ≈ 3 and gets flagged
- No per-unit threshold configuration needed — the baseline is learned from the data

**Layer 2 — Multi-Sensor Correlation Multiplier**

This is the core insight that eliminates most false positives.

Real mechanical failures don't touch one sensor. A bearing degrading raises vibration *and* temperature *and* eventually drops airflow as the fan strains. A refrigerant leak drops pressure *and* raises temperature as the compressor compensates. These are physical cause-effect chains — they're multi-sensor by nature.

Sensor noise, calibration drift, and electromagnetic interference are almost always single-sensor.

So: when N sensors are simultaneously anomalous, the priority score gets multiplied:
- 2 sensors co-anomalous → 1.5× multiplier
- 3 sensors co-anomalous → additional 1.3× multiplier  
- 4 sensors co-anomalous → additional 1.2× multiplier

The result: a genuine 2σ deviation across 3 sensors scores *higher* than a screaming 5σ spike in one sensor alone. The system actively rewards corroborated evidence and penalizes isolated spikes. This is the opposite of how threshold systems work.

**Layer 3 — Rate of Change**

A bearing that's been running at the same elevated vibration for 6 hours is different from one whose vibration is accelerating. The engine computes a linear regression slope over the last 24 readings per sensor, normalized by baseline std. Accelerating degradation adds a 20% priority boost.

This catches the pattern that killed the two units last quarter: slow, consistent drift that stayed below any fixed threshold until it was too late.

### Sensor Weights

Not all sensors carry equal diagnostic weight:

| Sensor | Weight | Reasoning |
|--------|--------|-----------|
| vibration | 1.5× | First signal of mechanical failure; bearing wear shows here before anywhere else |
| pressure | 1.3× | Refrigerant loss and compressor issues manifest directly in pressure |
| power | 1.3× | Motor strain increases power draw before mechanical symptoms appear — leading indicator |
| temp | 1.2× | Real but lagging; confirms other signals rather than leading |
| airflow | 1.0× | Consequence of failure, not cause; useful for correlation |

### What the Data Actually Shows

The dataset contains two real anomalies:

**HVAC-1 — CRITICAL (bearing/motor failure in progress)**
Vibration is ~9× baseline. Power draw is up 75%. Airflow is down 28%. Temperature is rising. All four sensors are co-anomalous and trending in the direction of continued degradation. This unit needs same-shift inspection. The z-scores here are not close calls — they're unambiguous.

**HVAC-3 — WATCH (pressure anomaly)**
Pressure collapsed in the final quarter of the dataset while every other sensor remained flat. This is either a refrigerant leak beginning or a pressure sensor fault. Either way, it warrants investigation. Single-sensor anomaly — no correlation multiplier — so the system correctly scores it as WATCH (21/100) rather than WARNING. Lower confidence is the right call: it could be refrigerant loss or a faulty sensor. Needs eyes on it, not emergency dispatch.

**HVAC-2,HVAC-4 and HVAC-5 — normal**
Clean baselines throughout. They rank at the bottom. No action needed.

---

## How I Used AI in Building This

Specifically and honestly:

**For architectural decisions:** I talked through the detection approach with Claude — comparing CUSUM control charts, rolling z-score, isolation forests, and ARIMA-based anomaly detection. Rolling z-score won on two criteria: explainability (you can tell a technician "this is 3.2 standard deviations above this unit's own normal" and they understand it — you cannot explain an isolation forest score) and data requirements (isolation forests need much more data to work well; z-score works with 100 readings).

**For implementation:** Claude generated the Box-Muller transform for synthetic data generation, the linear regression slope function, and the forward-fill interpolation for missing values. These are standard algorithms I know well — generating them was faster than looking them up.

**For the UI:** I described the information hierarchy I wanted (ranked list → drill-down → sensor charts with baseline bands) and used Claude to scaffold the React Native component structure, then edited for correctness and the specific design decisions that matter for a factory floor context.

**Where I pushed back:** Early versions of everything were over-engineered. Claude's first anomaly detection proposal used an ARIMA model. I rejected it — too much data required, too hard to explain to a maintenance lead, too many failure modes. The simpler approach is better here. Similarly, an early UI draft had too many numbers visible at once. Simplified.

**What I removed:** An earlier version called Claude's API to generate plain-English diagnoses per unit ("WHAT: bearing degradation likely. WHY: vibration z=4.2 with correlated power rise. DO: inspect east bay bearing assembly today."). I removed it. Reasons: (1) requires an API key embedded in the app — a security problem, (2) adds a network dependency that breaks on factory floors with poor connectivity, (3) the `dominantIssue` string generated by the anomaly engine already covers the same need without any external dependency.

---

## Trade-offs Made

**Static CSV over live data streaming**

The app loads a bundled CSV file. In production this would be a WebSocket connection to the facility's sensor network, with the anomaly engine running server-side and pushing ranked alerts to the app. The local-compute model demonstrates all the detection logic correctly — the architecture just needs a data layer swap, not a rethink.

**Per-unit metadata hardcoded**

Location names, install years, and last maintenance dates are hardcoded in `csvLoader.ts` since the CSV doesn't contain them. In production these come from the facility's CMMS (Computerized Maintenance Management System). I chose not to invent a fake CMMS integration.

**Two-screen navigation without React Navigation**

The app has two screens and one transition. Installing React Navigation and its peer dependencies for two screens is over-engineering. A `useState` discriminated union in `App.tsx` is readable, debuggable, and has zero dependency surface area. If the app grew to five screens I'd add a navigation library.

**SVG charts over a charting library**

`react-native-svg` primitives instead of Recharts or Victory Native. The reason: the ±2σ baseline band overlay is the most important visual in the app — it shows technicians exactly how far outside normal a reading is, in context. Charting libraries make that specific overlay awkward to implement. Raw SVG gives precise control.

**No offline persistence**

The app doesn't cache data locally. If you close and reopen it, it re-parses the CSV. For a static dataset this is fine. For a live streaming version, you'd want SQLite + background sync so the app works during the inevitable periods of poor connectivity on the factory floor.

---

## What I'd Do Differently With More Time

**Build the feedback loop first**

The highest-leverage missing feature isn't a better algorithm — it's closing the feedback loop. Every time a technician responds to an alert (acts on it, dismisses it, escalates it), that signal should feed back into the baseline. Over 30 days the system self-calibrates to near-zero false positives for *this specific facility with these specific units*. The generic algorithm is a starting point; facility-specific calibration is what makes it actually trusted.

**Shift-aware baselines**

HVAC behavior is systematically different during peak production hours versus nights and weekends — different loads, different ambient temperatures, different vibration from adjacent machinery. The current engine uses a flat baseline across all hours. A smarter version maintains separate baselines per shift and compares against the appropriate one. This would eliminate a whole class of false positives that are currently handled by the correlation multiplier.

**Failure mode pattern library**

The `describeIssue()` function currently pattern-matches against about 6 known failure signatures. A real deployment would build this out with input from experienced maintenance leads — they know the specific failure signatures for the specific models of HVAC units in the facility. This is tacit knowledge that currently lives only in the technicians' heads. Capturing it as detection patterns is high value.

**Push notifications with intelligent backoff**

Currently pull-based. A real system needs push. But the push logic matters as much as the detection logic — if a unit has been in "warning" for 8 hours and two shifts have looked at it, the notification behavior should change. Escalate urgency to supervisors, don't just keep pinging the same technician. Alert fatigue can be recreated through push notifications if you don't design them carefully.

**The 200-unit version**

The assessment describes 200 units across 3 shifts, not 5. At 200 units, the dashboard list design breaks down — you can't scroll through 200 cards looking for problems. The right design at that scale is different: a facility map view where units are represented as dots colored by severity, with the list as a secondary view. The detection engine scales fine; the UI doesn't.

---

## What This Approach Gets Right

Threshold systems fail at the human layer, not just the technical one. They create an adversarial relationship between the system and the people who use it — every false alarm is a withdrawal from a trust account, and once that account is empty, the system is worthless regardless of its technical accuracy.

The multi-sensor correlation approach changes that relationship. When the system says something is wrong, it's because multiple independent measurements are simultaneously telling the same story. That's something a technician can reason about and verify. "The system says vibration is 9× normal and power draw is up 75%" is a claim a technician can go check. "The system says pressure crossed threshold 14.7" is a claim that has cried wolf 90 times this week.

The goal isn't a system that's always right. It's a system that earns the right to be trusted.