---
type: project
title: Aetherforge
summary: A drone ground control station. Live MAVLink telemetry parsed in Go and streamed to a 3D fleet map in React.
role: Solo builder
tech:
  - Go
  - MAVLink
  - WebSockets
  - React
  - TypeScript
  - CesiumJS
  - Docker
  - PX4 SITL
period:
  start: '2026'
  end: present
status: wip
repo: https://github.com/jmvaldez/aetherforge
featured: true
---

## Why

I wanted to learn drones from the software side. QGroundControl is powerful, but it shows
an operator everything at once. Aetherforge is my take on a simpler, operator-first fleet
view, built on real MAVLink telemetry instead of mock data.

## What works

- A Go backend that parses live MAVLink v2 telemetry from PX4 running in simulation
- A per-vehicle state machine tracking heartbeat and GPS fix
- Arm and disarm commands sent from the UI through the backend to the vehicle
- WebSocket streaming from the backend to the browser
- Real-time vehicle positions on a Cesium 3D globe
- A fleet manager UI with vehicle selection
- A shared component library documented in Storybook

The whole simulator runs in Docker, with no Gazebo or GPU required. Anyone can clone it and,
after a one-time build of about ten minutes, watch a drone move on the map.

## What I learned

Building this showed me how much I enjoy the layers under the features: keeping data flowing
reliably and keeping the system running. That's the part of full stack I want to get better at
next.

## Next

See the [roadmap](/projects/aetherforge/roadmap/).
