import { useEffect, useState } from "react";

function getIcon(code) {
    if (code === 0) return "/weather/sunny";
    if ([1, 2].includes(code)) return "/weather/partly-cloudy";
    if ([3, 45, 48].includes(code)) return "/weather/cloudy";
    if ([51, 53, 55, 56, 57, 66, 67, 80, 81, 82, 61, 63, 65].includes(code)) return "/weather/rainy";
    if ([85, 77, 86, 71, 73, 75].includes(code)) return "/weather/snow";
    if ([95, 96, 99].includes(code)) return "/weather/thunder";
    return "/weather/cloudy";
}

function bearingToDir(deg) {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(deg / 45) % 8;
    return directions[index];
}

export default function useSeattleWeather() {
    const [weather, setWeather] = useState(null);
    const [weatherLoading, setWeatherLoading] = useState(true);

    
    const fetchWeather = async () => {
        try {
            const res = await fetch(
                "https://api.open-meteo.com/v1/forecast?latitude=47.6062&longitude=-122.3321&current_weather=true"
            );

            const data = await res.json();
            const current = data.current_weather;

            setWeather({
                temp: Math.round((current.temperature * 9) / 5 + 32),
                wind: Math.round(current.windspeed),
                windDir: bearingToDir(current.winddirection),
                icon: getIcon(current.weathercode),
            });
        } catch (err) {
            console.error("Weather failed:", err);
            setWeather(null);
        } finally {
            setWeatherLoading(false);
        }
    };
    
    useEffect(() => {
        fetchWeather();
        const interval = setInterval(fetchWeather, 100000);
        return () => clearInterval(interval);
    }, []);

    return { weather, weatherLoading }
}