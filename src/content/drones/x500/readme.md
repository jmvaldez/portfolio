---
type: drone
title: X500 v2
summary: A Holybro PX4 development quad with a Pixhawk 6X. The real-hardware testbed for Aetherforge.
class: autonomy
frame: Holybro X500 v2, 500mm carbon fiber
hardware:
  motors: Holybro 2216 KV920
  esc: BLHeli S 20A
  flightController: Pixhawk 6X
propSizeIn: 10
featured: true
---

## Why this one

Aetherforge has only ever talked to a simulated drone. The X500 is a PX4 development kit,
so it speaks the same MAVLink as the simulator. The goal is to point the same Go backend at
a real aircraft and watch it show up on the map.

## Build

Currently being assembled.

- Pixhawk 6X flight controller running PX4
- SiK telemetry radio for the ground station link
- 10-inch props on a 500mm carbon fiber frame

## Next

First flight, then live telemetry into Aetherforge.
