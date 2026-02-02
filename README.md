# Link-Map

<img src="/screenshots/banner.png" width=100%>

Link Map is a Node web app that uses the OneBusAway API and SDK for node to get real-time data for bus and streetcar routes in Seattle, Washington. I used Leaflet for map rendering, and currently use GTFS transit data to get route shapes and stop placement. The OBA API is used for real time data (arrivals, lines, stop data) that GTFS cannot provide. This has been my first attempt at website backend, and apart from some accidental private key exposure (now deleted, thankfully), it went pretty smoothly. 

## Features
Currently, this app features a map with all of the King County Metro routes and stops, along with real time data for those stops and lines. To use it, just zoom into a line on the map, and click a stop to see arrival data. Hover a line to see all of the routes that pass through there in a tooltip. All of the live busses are rendered on the map, zoom in or click on a group (bus icon with a number) to view all of the 'clumped' busses. You can swap from dark to light mode by clicking the sun or moon.

## Hosting
I set up a raspberry pi as a server and request all of the data from there!

## Future Plans
Eventually, I plan to add route planning, and change up the UI (especially for dark mode) a little bit.

## Screenshots
<img src="/screenshots/sc1.png" width=50%><img src="/screenshots/sc2.png" width=50%>
