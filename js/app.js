(function () {
  "use strict";

  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const errorMessage = document.querySelector("#error-message");

    try {
      setLoadingState(true);

      const [observations, forecasts] = await Promise.all([
        Promise.all(window.NwsApi.STATIONS.map(window.NwsApi.getLatestObservation)),
        Promise.all(window.NwsApi.STATIONS.map(window.NwsApi.getForecast)),
      ]);

      renderObservations(observations);
      renderSummaries(forecasts.find((forecast) => forecast.stationId === "DCA") || forecasts[0]);
      window.WeatherCharts.renderTemperatureChart(
        document.querySelector("#temperature-chart"),
        forecasts
      );

      document.querySelector("#last-updated").textContent = `Updated ${formatter.format(new Date())}`;
      errorMessage.hidden = true;
    } catch (error) {
      console.error(error);
      errorMessage.textContent =
        "Live NOAA/NWS data could not be loaded. Try refreshing in a moment.";
      errorMessage.hidden = false;
      document.querySelector("#last-updated").textContent = "Data unavailable";
    } finally {
      setLoadingState(false);
    }
  }

  function renderObservations(observations) {
    observations.forEach((observation) => {
      const card = document.querySelector(`[data-station-card="${observation.stationId}"]`);
      if (!card) return;

      card.querySelector("[data-current-temp]").textContent = formatTemperature(
        observation.temperatureF
      );
      card.querySelector("[data-current-wind]").textContent = formatWind(observation);
      card.querySelector("[data-current-time]").textContent = observation.timestamp
        ? formatter.format(new Date(observation.timestamp))
        : "--";

      const condition = card.querySelector(".station-code");
      condition.textContent = `${observation.stationId} · ${observation.textDescription}`;
    });
  }

  function renderSummaries(forecast) {
    const today = forecast.daily[0];
    const tomorrow = forecast.daily[1];

    document.querySelector("#today-summary").textContent = formatDailySummary(today);
    document.querySelector("#tomorrow-summary").textContent = formatDailySummary(tomorrow);
  }

  function formatDailySummary(day) {
    if (!day) return "Forecast unavailable.";

    const high = day.high === null ? "--" : `${day.high}°`;
    const low = day.low === null ? "--" : `${day.low}°`;
    const summary = day.daySummary || day.nightSummary || "Forecast details unavailable";

    return `${summary}. High ${high}, low ${low}.`;
  }

  function formatTemperature(value) {
    return value === null ? "--" : `${value}°`;
  }

  function formatWind(observation) {
    if (observation.windSpeedMph === null) return "--";
    return `${observation.windDirection || ""} ${observation.windSpeedMph} mph`.trim();
  }

  function setLoadingState(isLoading) {
    document.body.classList.toggle("is-loading", isLoading);
  }
})();
