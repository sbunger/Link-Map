import express from "express";
import OnebusawaySDK from 'onebusaway-sdk';
import dotenv from "dotenv";
import { FetchError } from "node-fetch";
dotenv.config();

const app = express();
const PORT = 3000;

const STOP_ID = "40_1121";
const ROUTE_ID = "40_100479"

const KEY = process.env.OBA_API_KEY;
if (!KEY) {
    console.error("No API key!");
    process.exit(1);
}

const client = new OnebusawaySDK({
    apiKey: KEY,
});

app.use(express.static("public"));

app.get("/api/arrivals", async (req, res) => {
    try {
        const route = await client.tripsForRoute.list(ROUTE_ID);
                
        const stop = await client.stop.retrieve(STOP_ID);
        const arrivalsList = await client.arrivalAndDeparture.list(STOP_ID, 
            {
                minutesBefore: 10,
                minutesAfter: 60,
                maxArrivals: 10
            }
        );

        const stopName = stop.data.entry.name;
        const arrivals = arrivalsList.data.entry.arrivalsAndDepartures;

        res.json({ stopName, arrivals });
    } catch (err) {
        console.error("API fetch failed:", err);
        res.status(500).json({ error: "Failed to fetch arrivals" });
    }
});

app.get("/api/routes-nearby", async (req, res) => {
    try {
        const agencies = [1, 40]

        const routes = [];

        for (const agency of agencies) {
            const results = await client.routesForAgency.list(agency);

            results.data.list.forEach(route => {
                routes.push(route);
            });
        }

        const shapes = [];

        for (const route of routes) {
            const trips = await client.tripsForRoute.list(route.id);
            const tripsArray = Object.values(trips.data.references.trips);

            // Find the first trip that has a valid shapeId
            const tripWithShape = tripsArray.find(t => t.shapeId);

            
            console.log(tripWithShape);
            if (!tripWithShape) continue;

            const shape = await client.shape.retrieve(tripWithShape.shapeId);

            shapes.push({
                routeId: route.id,
                name: route.shortName,
                shape: shape
            })
        }

        res.json(shapes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load nearby routes" });
    }
    
});

app.get("api/nearby-stops", async (req, res) => {
    try {
        const { lat, lon } = req.query;

        const results = await client.stopsForLocation.list({
            lat,
            lon,
            radius: 2500
        });

        
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load nearby stops" });
    }
});

app.listen(PORT, () => {
    console.log("Server Online")
});