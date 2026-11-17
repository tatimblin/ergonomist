---
title: "'Working as Configured': What Copper Did That Fiber Has to Be Told To"
date: 2026-11-16
kind: article
dek: HPE says its routers behind Friday's FAA ground stop were working as configured. Moving from copper circuits to an IP network changes what a configuration has to cover.
kicker: Analysis
authors: [tristan-timblin]
tags: [aviation, networking, outages]
veracity: reported
source: https://www.faa.gov/newsroom/nationwide-ground-stop-questions-and-answers
---

On Friday, November 13, a new router came online at a remote FAA radio site in El Dorado, Arkansas, as the site moved from copper to fiber. Within minutes, the FAA saw about 1,000 connection attempts every 4–5 seconds, and its "legacy equipment became unstable" ([FAA](https://www.faa.gov/newsroom/nationwide-ground-stop-questions-and-answers)). Radio and radar links at 17 of the 22 en route centers dropped in and out, and the FAA stopped departures nationwide for about four and a half hours.

Officials have pointed to aging copper. Copper is worth understanding, though, for what it did as much as for what's wrong with it. The circuit network that runs over it kept a fault at one site from affecting other sites, without anyone having to configure that. An IP network over fiber can do the same, but only when it's set up to. That difference is the subject of this story.

The root cause hasn't been announced. The FAA has turned off a "broadcasting function" on the new routers and about 60 others while it investigates. HPE, which owns Juniper, the maker of the new routers, says its "equipment was working as configured" ([Reuters](https://lufkindailynews.com/news_reuters/top_news/us-probes-why-a-router-installation-sparked-mass-flight-grounding/article_5fcbd79d-7b91-564c-9119-2d6040f3fa6b.html)). That can be true and still leave the question of what the configuration needs to include.

_Disclosure: I work at a company that makes routers. This is my own view, and I have no inside knowledge of the FAA's network._

## How the copper network works

The FAA's telecom backbone, FTI, links more than 4,400 sites and carries more than 29,000 services ([L3Harris](https://l3harris.com/sites/default/files/2025-03/fti-program-profile-sell-sheet-l3harris-sas-mn.pdf)). Much of it still runs on TDM (time-division multiplexing), the technology the phone network was built on. "Copper" is shorthand here: what matters is the circuits, and fiber can carry circuits too.

A T1 line is split into 24 channels of 64 kbps each. A radar feed or a radio's voice line gets its own channel. That channel is reserved end to end, from the remote site to the control center, whether or not anything is being sent ([FAA](https://www.faa.gov/sites/faa.gov/files/air_traffic/technology/cinp/fens/nas_overview_2015-09-02.pdf)).

That design comes with three properties built in:

- **A fixed rate.** A device can only send in its own time slots. However it misbehaves, it can't send faster than its channel.
- **No reach beyond its circuit.** A circuit has no addresses. A radar in Amarillo is wired to the centers that use it, and it can't talk to anything else.
- **Local failures.** When a circuit breaks, that one service goes down. Backup comes from a second circuit on a physically separate route.

So a faulty device at a remote radio site can take down its own radio and nothing else. The isolation comes from the technology itself.

Circuits have real costs. They're expensive, rigid and slow to reroute. Phone companies are retiring copper and charging to keep it running, and worn-out copper caused the Newark radar blackouts in 2025. There are good reasons to move off it.

## What IP changes

An IP network reverses each of those properties, on purpose:

| | Circuits | IP |
| --- | --- | --- |
| Capacity | Reserved per service | Shared by every service on a link |
| Rate | Capped by the time slot | Up to the link speed, limited by configuration |
| Reach | Wired to one destination | Any address can reach any other |
| Device behavior | A passive pipe | Routers discover neighbors, broadcast and exchange routes |
| A fault affects | One service | Potentially many services at once |

Those are the features that make IP worth having. Bandwidth goes where it's needed, traffic routes around failures on its own, and new services don't need new circuits. Old radar and radio services keep working too, carried as emulated circuits inside IP packets. Each still looks like a circuit at both ends, but in the middle it shares links and routers with everything else.

The tradeoff is blast radius, meaning how far one failure reaches. On a shared network, one device's traffic competes with everyone else's, and one device's broadcasts can fan out widely. That isn't a flaw in IP. It's a condition that has to be designed for.

## Accounting for it

Network engineers rebuild isolation on an IP network with a few standard tools:

- **Rate limits** on each port, and on traffic aimed at each router's own processor, so no single device can send more than its share.
- **Segmentation**, so a remote site's broadcasts and routing updates stay local and don't reach the core.
- **Scoped defaults**, so discovery and broadcast features stay local until someone deliberately widens them.
- **Telemetry** that shows which device is sending the most traffic. On a circuit network, a fault shows up where it is. On a shared network, its effects can show up far from the source.

A migration adds one more condition: old and new equipment running side by side. The 17 affected centers still used Cisco routers from 2001 ([Reuters](https://lufkindailynews.com/news_reuters/top_news/us-probes-why-a-router-installation-sparked-mass-flight-grounding/article_5fcbd79d-7b91-564c-9119-2d6040f3fa6b.html)). A thousand connections every 4–5 seconds works out to about 200–250 a second, light work for a modern router. Routers of the early 2000s often handled that kind of traffic in software on a slow processor, where a few hundred a second can add up. The FAA hasn't published the failure mode, so treat that as a general point about older gear, not a finding. During a migration, the limits have to fit the oldest equipment still on the network.

### Storm control in a few lines

The tool built for broadcast floods is called storm control. The FAA hasn't said Friday's traffic was broadcasts, but the feature it turned off was a broadcasting one. A switch or router counts the broadcast packets arriving on each port, the ones addressed to every device at once. When a port goes over its limit for the current second, the rest of that second's broadcasts are dropped. Ordinary traffic, addressed to one device, isn't touched. Here's the idea in Python:

```python
import time

BROADCAST = "ff:ff:ff:ff:ff:ff"  # the address that means "everyone"

class StormControl:
    def __init__(self, limit_per_second):
        self.limit = limit_per_second
        self.second = int(time.monotonic())
        self.count = 0

    def allow(self, packet):
        if packet.destination != BROADCAST:
            return True  # traffic for one device passes untouched
        now = int(time.monotonic())
        if now != self.second:  # a new second starts a new count
            self.second, self.count = now, 0
        self.count += 1
        return self.count <= self.limit

# One counter per port, so a noisy site can't spend anyone else's budget.
ports = {name: StormControl(limit_per_second=100) for name in ["el-dorado", "amarillo"]}
```

On a circuit there was nothing to broadcast to, so none of this was needed. On an IP network, each port gets a limit like this, sized for what that site normally sends. A remote radio site might send a handful of broadcasts a second. Many switches can also shut a port off entirely when it crosses the limit, and alert someone, which turns a flood into a single dark site and an alarm naming it.

## The same move, on the airplane

Aviation has made this transition before, inside the aircraft. Older planes gave each function its own computer, so one failing box couldn't affect another, much like circuits. When manufacturers moved to shared computers, the industry made partitioning between functions an explicit, certified requirement, so isolation that used to come with the hardware is now specified and tested.

The ground network is going through the same change. Copper gave isolation automatically. On fiber and IP, it's still available, but it's something to configure, test at each cutover, and write down as a requirement.
