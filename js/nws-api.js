(function () {
  "use strict";

  const API_ROOT = window.WeatherConfig.apiRoot;
  const config = window.WeatherConfig;

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/geo+json, application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`NWS request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async function getLatestObservation(station) {
    const data = await fetchJson(`${API_ROOT}/stations/${station.nwsStation}/observations/latest`);
    const properties = data.properties || {};

    return {
      stationId: station.id,
      stationLabel: station.label,
      timestamp: properties.timestamp,
      textDescription: properties.textDescription || "Unavailable",
      temperatureF: celsiusToFahrenheit(properties.temperature && properties.temperature.value),
      windSpeedMph: metersPerSecondToMph(properties.windSpeed && properties.windSpeed.value),
      windDirection: degreesToCompass(properties.windDirection && properties.windDirection.value),
    };
  }

  async function getForecast(station) {
    const point = await fetchJson(
      `${API_ROOT}/points/${station.point.latitude.toFixed(4)},${station.point.longitude.toFixed(4)}`
    );
    const forecastUrl = point.properties && point.properties.forecast;

    if (!forecastUrl) {
      throw new Error(`No NWS forecast URL found for ${station.id}`);
    }

    const forecast = await fetchJson(forecastUrl);
    const periods = (forecast.properties && forecast.properties.periods) || [];

    return {
      stationId: station.id,
      stationLabel: station.label,
      periods,
      daily: buildDailyForecast(periods),
    };
  }

  async function getRecentDailyObservations(station) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - (config.recentObservationDays + 2));

    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
    });
    const features = await fetchObservationFeatures(
      `${API_ROOT}/stations/${station.nwsStation}/observations?${params.toString()}`
    );
    const targetDates = getRecentCompleteDateKeys(config.recentObservationDays);
    const targetDateSet = new Set(targetDates);
    const daily = new Map();

    targetDates.forEach((date) => {
      daily.set(date, {
        date,
        label: shortDayLabel(`${date}T12:00:00`),
        high: null,
        low: null,
        observations: 0,
      });
    });

    features.forEach((feature) => {
      const properties = feature.properties || {};
      const temperature = celsiusToFahrenheit(
        properties.temperature && properties.temperature.value
      );
      const date = localDateKey(properties.timestamp);

      if (!targetDateSet.has(date) || typeof temperature !== "number") return;

      const day = daily.get(date);
      day.high = day.high === null ? temperature : Math.max(day.high, temperature);
      day.low = day.low === null ? temperature : Math.min(day.low, temperature);
      day.observations += 1;
    });

    return {
      stationId: station.id,
      stationLabel: station.label,
      daily: targetDates.map((date) => daily.get(date)),
    };
  }

  async function fetchObservationFeatures(initialUrl) {
    const features = [];
    let nextUrl = initialUrl;
    let pageCount = 0;

    while (nextUrl && pageCount < 10) {
      const data = await fetchJson(nextUrl);
      features.push(...(data.features || []));
      nextUrl = data.pagination && data.pagination.next;
      pageCount += 1;
    }

    return features;
  }

  function buildDailyForecast(periods) {
    const days = new Map();

    periods.forEach((period) => {
      const dateKey = period.startTime.slice(0, 10);
      const existing = days.get(dateKey) || {
        date: dateKey,
        label: shortDayLabel(period.startTime),
        high: null,
        low: null,
        daySummary: "",
        nightSummary: "",
      };

      if (period.isDaytime) {
        existing.high = period.temperature;
        existing.daySummary = period.shortForecast || "";
      } else {
        existing.low = period.temperature;
        existing.nightSummary = period.shortForecast || "";
      }

      days.set(dateKey, existing);
    });

    return Array.from(days.values()).slice(0, 7);
  }

  function shortDayLabel(isoDate) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "numeric",
      day: "numeric",
    }).format(new Date(isoDate));
  }

  function localDateKey(isoDate) {
    if (!isoDate) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: config.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(isoDate));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function getRecentCompleteDateKeys(count) {
    const dates = [];
    const cursor = new Date();

    for (let offset = count; offset >= 1; offset -= 1) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() - offset);
      dates.push(localDateKey(date.toISOString()));
    }

    return dates;
  }

  function celsiusToFahrenheit(value) {
    if (typeof value !== "number") return null;
    return Math.round((value * 9) / 5 + 32);
  }

  function metersPerSecondToMph(value) {
    if (typeof value !== "number") return null;
    return Math.round(value * 2.23694);
  }

  function degreesToCompass(value) {
    if (typeof value !== "number") return "";
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return directions[Math.round(value / 45) % 8];
  }

  window.NwsApi = {
    STATIONS: window.WeatherConfig.stations,
    getLatestObservation,
    getForecast,
    getRecentDailyObservations,
  };
})();
