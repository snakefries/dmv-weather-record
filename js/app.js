(function () {
  "use strict";

  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const config = window.WeatherConfig;
  const DEFAULT_STATION_ID = config.defaultStationId;

  const state = {
    forecasts: [],
    observations: [],
    recentDailyObservations: [],
    climateNormals: [],
    selectedStationId: DEFAULT_STATION_ID,
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const errorMessage = document.querySelector("#error-message");

    try {
      setLoadingState(true);
      bindTemperatureStationButtons();

      const [observationResults, forecastResults, climateNormalResults] = await Promise.all([
        settleStationRequests(window.NwsApi.getLatestObservation),
        settleStationRequests(window.NwsApi.getForecast),
        settleStationRequests(window.ClimateApi.getDailyTemperatureNormals),
      ]);

      state.observations = successfulValues(observationResults);
      state.forecasts = successfulValues(forecastResults);
      state.climateNormals = successfulValues(climateNormalResults);
      renderObservations(observationResults);
      updateForecastControls(forecastResults);
      renderSelectedStation();

      document.querySelector("#last-updated").textContent = `Updated ${formatter.format(new Date())}`;
      renderDataStatus(errorMessage, observationResults, forecastResults, climateNormalResults);
      loadRecentDailyObservations(errorMessage);
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

  function bindTemperatureStationButtons() {
    document.querySelectorAll("[data-chart-station]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedStationId = button.dataset.chartStation;
        renderSelectedStation();
      });
    });
  }

  function settleStationRequests(request) {
    return Promise.all(
      window.NwsApi.STATIONS.map((station) =>
        request(station)
          .then((value) => ({ status: "fulfilled", station, value }))
          .catch((error) => ({ status: "rejected", station, error }))
      )
    );
  }

  function successfulValues(results) {
    return results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
  }

  async function loadRecentDailyObservations(errorMessage) {
    const recentObservationResults = await settleStationRequests(
      window.NwsApi.getRecentDailyObservations
    );
    state.recentDailyObservations = successfulValues(recentObservationResults);
    document.body.classList.toggle(
      "has-recent-observations",
      state.recentDailyObservations.length > 0
    );
    renderSelectedStation();

    if (recentObservationResults.some((result) => result.status === "rejected")) {
      renderDataStatus(errorMessage, recentObservationResults);
    }
  }

  function renderSelectedStation() {
    const forecast =
      state.forecasts.find((item) => item.stationId === state.selectedStationId) ||
      state.forecasts.find((item) => item.stationId === DEFAULT_STATION_ID) ||
      state.forecasts[0];

    if (!forecast) return;

    const recentDaily =
      state.recentDailyObservations.find((item) => item.stationId === forecast.stationId) ||
      null;
    const climateNormals =
      state.climateNormals.find((item) => item.stationId === forecast.stationId) || null;

    renderSummaries(forecast);
    updateTemperatureStationControls(forecast);
    window.WeatherCharts.renderTemperatureChart(
      document.querySelector("#temperature-chart"),
      forecast,
      recentDaily,
      climateNormals
    );
  }

  function renderObservations(results) {
    results.forEach((result) => {
      if (result.status === "rejected") {
        renderStationUnavailable(result.station, "Observation unavailable");
        return;
      }

      const observation = result.value;
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
      card.querySelector("[data-station-status]").textContent = "Live observation";
      card.classList.remove("is-unavailable");
    });
  }

  function renderStationUnavailable(station, message) {
    const card = document.querySelector(`[data-station-card="${station.id}"]`);
    if (!card) return;

    card.classList.add("is-unavailable");
    card.querySelector(".station-code").textContent = station.id;
    card.querySelector("[data-current-temp]").textContent = "--";
    card.querySelector("[data-current-wind]").textContent = "--";
    card.querySelector("[data-current-time]").textContent = "--";
    card.querySelector("[data-station-status]").textContent = message;
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

  function updateTemperatureStationControls(forecast) {
    document.querySelectorAll("[data-chart-station]").forEach((button) => {
      const isActive = button.dataset.chartStation === forecast.stationId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    const station = config.stations.find((item) => item.id === forecast.stationId);
    document.documentElement.style.setProperty(
      "--forecast-color",
      station ? station.chartColor : config.stations[0].chartColor
    );
    document.querySelector("#temperature-station-label").textContent = forecast.stationLabel;
  }

  function updateForecastControls(results) {
    const availableStationIds = new Set(
      results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.station.id)
    );

    document.querySelectorAll("[data-chart-station]").forEach((button) => {
      const isAvailable = availableStationIds.has(button.dataset.chartStation);
      button.disabled = !isAvailable;
      button.title = isAvailable ? "" : "Forecast unavailable";
    });
  }

  function renderDataStatus(errorMessage, ...resultGroups) {
    const failures = resultGroups
      .flat()
      .filter((result) => result.status === "rejected");

    if (!state.forecasts.length) {
      errorMessage.textContent =
        "Forecast data could not be loaded for DCA, IAD, or BWI. Try refreshing in a moment.";
      errorMessage.hidden = false;
      return;
    }

    if (failures.length) {
      const stationIds = Array.from(new Set(failures.map((result) => result.station.id))).join(", ");
      errorMessage.textContent = `Some live NOAA/NWS data is unavailable right now: ${stationIds}.`;
      errorMessage.hidden = false;
      return;
    }

    errorMessage.hidden = true;
  }
})();
