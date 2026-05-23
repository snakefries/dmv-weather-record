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
    rollingPrecipitation: [],
    climateNormals: [],
    temperatureRecords: [],
    monthlyPrecipitation: [],
    selectedStationId: DEFAULT_STATION_ID,
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const errorMessage = document.querySelector("#error-message");

    try {
      setLoadingState(true);
      bindTemperatureStationButtons();
      loadRecentDailyObservations(errorMessage).catch((error) => {
        console.error(error);
      });

      const [
        observationResults,
        forecastResults,
        climateNormalResults,
        recordResults,
        precipitationResults,
        rollingPrecipitationResults,
      ] = await Promise.all([
        settleStationRequests(window.NwsApi.getLatestObservation),
        settleStationRequests(window.NwsApi.getForecast),
        settleStationRequests(window.ClimateApi.getDailyTemperatureNormals),
        settleStationRequests(window.ClimateApi.getDailyTemperatureRecords),
        settleStationRequests(window.ClimateApi.getMonthlyPrecipitation),
        settleStationRequests(window.NwsApi.getRollingPrecipitation),
      ]);

      state.observations = successfulValues(observationResults);
      state.forecasts = successfulValues(forecastResults);
      state.climateNormals = successfulValues(climateNormalResults);
      state.temperatureRecords = successfulValues(recordResults);
      state.monthlyPrecipitation = successfulValues(precipitationResults);
      state.rollingPrecipitation = successfulValues(rollingPrecipitationResults);
      renderObservations(observationResults);
      updateForecastControls(forecastResults);
      renderSelectedStation();
      renderOfficialRecordTable();
      renderPrecipitationTable();

      document.querySelector("#last-updated").textContent = `Updated ${formatter.format(new Date())}`;
      renderDataStatus(
        errorMessage,
        observationResults,
        forecastResults,
        climateNormalResults,
        recordResults,
        precipitationResults,
        rollingPrecipitationResults
      );
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
    renderOfficialRecordTable();

    if (
      state.forecasts.length &&
      recentObservationResults.some((result) => result.status === "rejected")
    ) {
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
    const temperatureRecords =
      state.temperatureRecords.find((item) => item.stationId === forecast.stationId) || null;

    renderSummaries(forecast);
    updateTemperatureStationControls(forecast);
    window.WeatherCharts.renderTemperatureChart(
      document.querySelector("#temperature-chart"),
      forecast,
      recentDaily,
      climateNormals,
      temperatureRecords
    );
    renderSelectedPrecipitation();
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

  function renderOfficialRecordTable() {
    config.stations.forEach((station) => {
      const latestActual = getLatestCompleteClimateActual(station.id);
      const targetDate = latestActual ? latestActual.date : getTodayDateKey();
      const normal = findDailyValue(state.climateNormals, station.id, targetDate);
      const record = findDailyValue(state.temperatureRecords, station.id, targetDate);

      setRecordCell(
        station.id,
        "high",
        formatTemperature(latestActual && latestActual.actualHigh)
      );
      setRecordCell(station.id, "low", formatTemperature(latestActual && latestActual.actualLow));
      setRecordCell(station.id, "normal", formatPair(normal && normal.high, normal && normal.low));
      setRecordCell(
        station.id,
        "recordHigh",
        formatRecord(record && record.recordHigh, record && record.recordHighYear)
      );
      setRecordCell(
        station.id,
        "recordLow",
        formatRecord(record && record.recordLow, record && record.recordLowYear)
      );
    });
  }

  function getLatestCompleteClimateActual(stationId) {
    const series = state.climateNormals.find((item) => item.stationId === stationId);
    if (!series) return null;

    const today = getTodayDateKey();
    return series.daily
      .slice()
      .reverse()
      .find(
        (day) =>
          day.date < today &&
          typeof day.actualHigh === "number" &&
          typeof day.actualLow === "number"
      );
  }

  function renderSelectedPrecipitation() {
    const precipitation =
      state.monthlyPrecipitation.find((item) => item.stationId === state.selectedStationId) ||
      state.monthlyPrecipitation.find((item) => item.stationId === DEFAULT_STATION_ID) ||
      state.monthlyPrecipitation[0];

    if (!precipitation) return;

    window.WeatherCharts.renderPrecipitationChart(
      document.querySelector("#precipitation-chart"),
      precipitation
    );
  }

  function renderPrecipitationTable() {
    config.stations.forEach((station) => {
      const precipitation = state.monthlyPrecipitation.find(
        (item) => item.stationId === station.id
      );

      if (!precipitation) return;

      const currentMonth =
        precipitation.current.find((month) => month.month === getCurrentMonthKey()) ||
        precipitation.current[precipitation.current.length - 1];
      const currentMonthIndex = precipitation.current.findIndex(
        (month) => month.month === currentMonth.month
      );
      const monthsToDate = precipitation.current.slice(0, currentMonthIndex + 1);
      const summary = precipitation.summary || {
        latestDaily: currentMonth && currentMonth.latestDaily,
        monthTotal: currentMonth && currentMonth.total,
        monthNormal: currentMonth && currentMonth.normal,
        yearTotal: sumPrecip(monthsToDate.map((month) => month.total)),
        yearNormal: sumPrecip(monthsToDate.map((month) => month.normal)),
      };
      const rollingPrecipitation = state.rollingPrecipitation.find(
        (item) => item.stationId === station.id
      );

      setPrecipCell(
        station.id,
        "latestDay",
        formatInches(rollingPrecipitation ? rollingPrecipitation.total : summary.latestDaily)
      );
      setPrecipCell(station.id, "monthTotal", formatInches(summary.monthTotal));
      setPrecipCell(station.id, "monthNormal", formatInches(summary.monthNormal));
      setPrecipCell(station.id, "yearTotal", formatInches(summary.yearTotal));
      setPrecipCell(station.id, "yearNormal", formatInches(summary.yearNormal));
    });
  }

  function findDailyValue(collection, stationId, date) {
    const series = collection.find((item) => item.stationId === stationId);
    if (!series) return null;
    return series.daily.find((day) => day.date === date) || null;
  }

  function setRecordCell(stationId, key, value) {
    const cell = document.querySelector(`[data-record-cell="${stationId}.${key}"]`);
    if (cell) cell.textContent = value;
  }

  function setPrecipCell(stationId, key, value) {
    const cell = document.querySelector(`[data-precip-cell="${stationId}.${key}"]`);
    if (cell) cell.textContent = value;
  }

  function formatPair(high, low) {
    if (typeof high !== "number" || typeof low !== "number") return "--";
    return `${high}°/${low}°`;
  }

  function formatRecord(value, year) {
    if (typeof value !== "number") return "--";
    return year ? `${value}° ${year}` : `${value}°`;
  }

  function getTodayDateKey() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: config.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${values.year}-${values.month}-${values.day}`;
  }

  function getCurrentMonthKey() {
    return getTodayDateKey().slice(0, 7);
  }

  function sumPrecip(values) {
    const numeric = values.filter((value) => typeof value === "number");
    if (!numeric.length) return null;

    return Math.round(numeric.reduce((sum, value) => sum + value, 0) * 100) / 100;
  }

  function formatInches(value) {
    if (typeof value !== "number") return "--";
    if (value === 0) return "Trace";
    return `${value.toFixed(2)}"`;
  }
})();
