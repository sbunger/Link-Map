import express from "express";
import OnebusawaySDK from 'onebusaway-sdk';
import dotenv from "dotenv";

import { importGtfs, openDb, getRoutes, getShapes, getTrips, getTimeframes } from "gtfs";

const config = {
    sqlitePath: "data/gtfs/gtfs.sqlite",
    ignoreDuplicates: true,
    agencies: [
        {
            agency_key: "metro",
            path:"data/gtfs/metro-1",
            prefix: "kcm_"
        },
        {
            agency_key: "sound_transit",
            path: "data/gtfs/sound-transit-40",
            prefix: "st_"
        },
    ],
};

await importGtfs(config);

const db = await openDb(config);

dotenv.config();

const app = express();
const PORT = 3000;

const KEY = process.env.OBA_API_KEY;
if (!KEY) {
    console.error("No API key!");
    process.exit(1);
}

const client = new OnebusawaySDK({
    apiKey: KEY,
});

app.use(express.static("public"));
app.head("/", (req, res) => res.status(200).end());

app.get("/api/arrivals", async (req, res) => {
    // using OBA
    // update arrivals for a stop
    try {
        const stopId = req.query.stop_id;
                
        const stop = await client.stop.retrieve(stopId);
        const arrivalsList = await client.arrivalAndDeparture.list(stopId, 
            {
                minutesBefore: 1,
                minutesAfter: 60,
            }
        );

        const stopName = stop.data.entry.name;
        const arrivals = arrivalsList.data.entry.arrivalsAndDepartures;
        const direction = stop.data.entry.direction;
        
        const routes = await Promise.all(stop.data.entry.routeIds.map(route => client.route.retrieve(route))
);

        res.json({ routes, stopName, arrivals, direction });
    } catch (err) {
        console.error("API fetch failed:", err);
        res.status(500).json({ error: "Failed to fetch arrivals" });
    }
});

app.get("/api/routes-nearby", async (req, res) => {
    // using GTFS
    // get all routes
    try {
        const routes = await getRoutes();

        const shapes = [];

        for (const route of routes) {
            const trips = await getTrips({ route_id: route.route_id })

            const shapeCounts = {};
            for (const trip of trips) {
                if (!trip.shape_id) continue;
                shapeCounts[trip.shape_id] =
                    (shapeCounts[trip.shape_id] || 0) + 1;
            }

            const bestShapeId = Object.entries(shapeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];


            const shape = await getShapes({
                shape_id: bestShapeId,
            });

            shapes.push({
                shape: shape,
                name: route.route_short_name,
                route_id: route.route_id,
                route_color: route.route_color,
                route_type: route.route_type,
                agency_id: route.agency_id
            });
        }

        res.json(shapes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load nearby routes" });
    }
});

app.get("/api/stops-nearby", async (req, res) => {
    // using GTFS
    // get stops with bounds
    try {
        const bbox = req.query.bbox;
        if (!bbox) return;

        const [west, south, east, north] = bbox.split(",").map(Number);

        const rows = db.prepare(`
            SELECT
                stop_id,
                stop_name,
                stop_lat,
                stop_lon
            FROM stops
            WHERE stop_lat BETWEEN ? AND ?
                AND stop_lon BETWEEN ? AND ?
        `).all(south, north, west, east);

        res.json(
            rows.map(stop => ({
                stop_id: stop.stop_id.replace(/^(st_|kcm_)/, ""),
                name: stop.stop_name,
                lat: stop.stop_lat,
                lon: stop.stop_lon,
                agency: stop.stop_id.startsWith("st_") ? "40" : "1"
            }))
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load nearby stops" });
    }
});

app.get("/api/vehicles", async (req, res) => {
    // using OBA & GTFS
    // get live vehicles
    try {
        const agencies = [1, 40];

        const vehicleResponse = await Promise.all(
            agencies.map(async (agencyId) => {
                const response = await client.vehiclesForAgency.list(agencyId)

                return response.data.list.map(v => ({
                id: v.vehicleId,
                lat: v.location?.lat,
                lon: v.location?.lon,
                bearing: v.tripStatus?.orientation || 0,
                tripId: v.tripId,
                status: v.status,
                time: v.lastUpdateTime,
                agency: agencyId
                }));
            })
        );
        
        const vehicles = vehicleResponse.flat();

        const vehiclesWithType = await Promise.all(
          vehicles.map(async (vehicle) => {

                if (!vehicle.tripId) {
                    return { ...vehicle, type: null };
                }

                let newId = vehicle.tripId;

                if (vehicle.tripId.startsWith("1_")) {
                    newId = vehicle.tripId.replace("1_", "kcm_");
                } else if (vehicle.tripId.startsWith("40_")) {
                    newId = vehicle.tripId.replace("40_", "st_");
                }

                const trips = await getTrips({ trip_id: newId });

                if (!trips.length) {
                    return { ...vehicle, type: null };
                }

                const routeId = trips[0]?.route_id;
                if (!routeId) {
                    return { ...vehicle, type: null };
                }

                const routes = await getRoutes({ route_id: routeId });

                if (!routes.length) {
                    return { ...vehicle, type: null };
                }

                const routeType = routes[0]?.route_type ?? null;

                return {
                    ...vehicle,
                    type: routeType
                };
            })
        );

        res.json(vehiclesWithType);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch vehicles" });
    }
});

app.listen(PORT, () => {
    console.log("Server Online")
});