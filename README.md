# Link-Map

<img src="/screenshots/banner.png" width=100%>

Link Map is a Node web app that uses the OneBusAway API and SDK for node to get real-time data for bus and streetcar routes in Seattle, Washington. I used Leaflet for map rendering, and currently use GTFS transit data to get route shapes and stop placement. The OBA API is used for real time data (arrivals, lines, stop data) that GTFS cannot provide. This has been my first attempt at website backend, and apart from some accidental private key exposure (now deleted, thankfully), it went pretty smoothly. 

## Features
- Real-time stop arrivals (just click a stop while zoomed in enough)
- Stop direction, routes, and endpoints
- Bus line rendering
- Clean UI with glass effect, light and dark mode
- Options menu
- Live busses rendered on map for all availible lines (with clumping for close busses)
- Splash screen with info

## Hosting
I set up a raspberry pi as a server and request all of the data from there! Sorry for slow speeds...

## Future Plans
Eventually, I plan to add route planning, using a library.

## Screenshots
<img src="/screenshots/sc1.png" width=50%><img src="/screenshots/sc2.png" width=50%>
