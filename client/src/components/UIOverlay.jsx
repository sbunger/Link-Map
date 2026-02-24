import React from "react";

function formatArrivals(arrivals = [], stopKey = "nostop") {
  const short = arrivals.slice(0, 9);

  return short.map((a, idx) => {
    const arrivalTime = a.predictedArrivalTime || a.scheduledArrivalTime;
    const minutes = Math.round((arrivalTime - Date.now()) / 60000);

    let title;
    if (minutes < 0) title = `${a.routeShortName} arrived ${minutes * -1} minutes ago`;
    else if (minutes > 0) title = `${a.routeShortName} arriving in ${minutes} minutes`;
    else title = `${a.routeShortName} arriving now`;

    const key = `${stopKey}-${a.routeShortName}-${arrivalTime}-${idx}`;

    return {
      key,
      title,
      headsign: a.tripHeadsign,
      scheduledOnly: arrivalTime === a.scheduledArrivalTime,
    };
  });
}

export default function UIOverlay({
  started,
  darkMode,
  setDarkMode,

  showOptions,
  setShowOptions,

  renderStops,
  setRenderStops,

  renderVehicles,
  setRenderVehicles,

  routeQuery,
  setRouteQuery,
  onSubmitRoute,

  selectedStop,
  arrivalsData,

  warningText,
  routesLoading,

  dataPanelOpen,
}) {
  const infoClass = `info ${darkMode ? "dark" : ""}`;

  const stopName = arrivalsData?.stopName;
  const direction = arrivalsData?.direction;
  const routes = arrivalsData?.routes ?? [];
  const arrivals = arrivalsData?.arrivals ?? [];

  const routesShortNames = routes
    .map((r) => r?.data?.entry?.shortName)
    .filter(Boolean);

  const stopKey = selectedStop
    ? `${selectedStop.agency}_${selectedStop.stop_id}`
    : "nostop";

  const arrivalRows = formatArrivals(arrivals, stopKey);

  // arrivals "loading" is when a stop is selected but we haven't received data yet
  const arrivalsLoading = Boolean(selectedStop && !arrivalsData);

  // show panel when either:
  // - stop selected, OR
  // - routes are loading
  const showDataPanel = Boolean(selectedStop || routesLoading);

  return (
    <div id="ui-overlay">
      <div className="row top">
        <div className={`ui left ${started ? "shown" : ""}`}>
          <div className={infoClass} id="highlight">
            <p><b>Highlight Route:</b></p>
            <input
              type="text"
              id="routeInput"
              placeholder="Try '45' or '67'"
              value={routeQuery}
              onChange={(e) => setRouteQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmitRoute();
              }}
            />
            <div
              id="searchRoutes"
              className={routeQuery.trim().length ? "okay" : ""}
              onClick={onSubmitRoute}
              role="button"
              tabIndex={0}
            >
              <img src="images/check.png" alt="search" />
            </div>
          </div>

          <div
            className={`${infoClass} circle`}
            id="modeSwap"
            onClick={() => setDarkMode(!darkMode)}
            role="button"
            tabIndex={0}
          >
            <img
              src={darkMode ? "images/sun.png" : "images/moon.png"}
              alt="toggle theme"
            />
          </div>

          <div
            className={`${infoClass} circle`}
            id="settingsButton"
            onClick={() => setShowOptions(!showOptions)}
            role="button"
            tabIndex={0}
          >
            <img
              src={darkMode ? "images/gear.png" : "images/gear-dark.png"}
              alt="settings"
            />
          </div>
        </div>

        <div className={`ui right ${started ? "shown" : ""}`}>
          <div className={infoClass} id="att">
            <p>
              <b>
                Data provided by{" "}
                <a href="https://kingcounty.gov/en/dept/metro">KCM</a> and{" "}
                <a href="https://pugetsound.onebusaway.org/">OneBusAway</a>
              </b>
            </p>
          </div>

          <div className={`${infoClass} ui ${dataPanelOpen ? "" : "hidden"}`} id="data">
            {routesLoading && (
              <>
                <h2>Loading route data...</h2>
                <hr id="solid" />
              </>
            )}

            {selectedStop && (
              <>
                <h2 id="stopName">
                  {stopName ? (
                    <>
                      {stopName}{" "}
                      {direction ? (
                        <span className="direction">({direction} bound)</span>
                      ) : null}
                    </>
                  ) : null}
                </h2>

                <hr id="solid" style={{ display: stopName ? "block" : "none" }} />

                <h3 id="routes">
                  {arrivalsLoading
                    ? "Retrieving data..."
                    : routesShortNames.length
                      ? `Serving ${routesShortNames.join(", ")}`
                      : ""}
                </h3>

                <ul id="arrivals" key={stopKey}>
                  {arrivalsLoading ? (
                    <></>
                  ) : arrivalRows.length === 0 ? (
                    <li>This route does not provide real-time data :(</li>
                  ) : (
                    arrivalRows.map((row) => (
                      <li
                        key={row.key}
                        className={row.scheduledOnly ? "" : "confirmedArrival"}
                      >
                        <b>{row.title}</b>
                        {row.headsign ? (
                          <>
                            <br />
                            {row.headsign}
                          </>
                        ) : null}{" "}
                        {row.scheduledOnly ? (
                          <span className="scheduledArrival">(scheduled)</span>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="row bottom">
        <div className={`ui left ${started ? "shown" : ""}`}>
          <div className={`${infoClass} ${showOptions ? "" : "hidden"}`} id="options">
            <h2>Options</h2>

            <div className="option">
              <p><span className="option-label">Render Stops</span></p>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={renderStops}
                  onChange={(e) => setRenderStops(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="option">
              <p><span className="option-label">Render Busses</span></p>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={renderVehicles}
                  onChange={(e) => setRenderVehicles(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="option">
              <h3 style={{ fontSize: 16 }}>
                Made by <a href="https://silasunger.me">Silas Unger</a> in WA :)
              </h3>
            </div>
          </div>
        </div>

        <div className={`ui right ${started ? "shown" : ""}`}>
          <div
            className={`${infoClass}`}
            id="warning"
            style={{ display: warningText ? "block" : "none" }}
          >
            <h3>{warningText}</h3>
          </div>
        </div>
      </div>
    </div>
  );
}