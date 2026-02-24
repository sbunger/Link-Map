import React from "react";

export default function Splash({ darkMode, hidden, onClick }) {
  return (
    <div id="splash" onClick={onClick} className={hidden ? "hidden" : ""}>
      <div className={`info ${darkMode ? "dark" : ""}`} id="splashtext">
        <div id="welcome">
          <h2 style={{ textDecoration: "underline wavy 1px" }}>Welcome to Link Map!</h2>
          <img src="images/busmoji.png" alt="bus" />
        </div>
        <p>
          This is a node web app I created using King County Metro and SoundTransit GTFS data and
          OneBusAway for Seattle, Washington. It features vehicle rendering, colored lines, and stop data.
        </p>
        <h3>How to Use</h3>
        <p>
          Zoom in to view stops. Click on a stop to view real-time data and directions + routes.
          In the options menu, vehicle and stop rendering can be enabled or disabled. Highlight a route
          by inputting a route number into the box and pressing enter. <b>Deselect a stop or route by clicking the map.</b>
        </p>
      </div>

      <div className={`info ${darkMode ? "dark" : ""}`} id="begin">
        <p><b>Click anywhere to begin!</b></p>
      </div>
    </div>
  );
}