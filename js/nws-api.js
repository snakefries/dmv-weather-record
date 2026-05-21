(function () {
  "use strict";

  const API_ROOT = "https://api.weather.gov";

  const STATIONS = [
    {
      id: "DCA",
      nwsStation: "KDCA",
      label: "National",
      point: { latitude: 38.8512, longitude: -77.0402 },
    },
    {
      id: "IAD",
      nwsStation: "KIAD",
      label: "Dulles",
      point: { latitude: 38.9531, longitude: -77.4565 },
    },
    {
      id: "BWI",
      nwsStation: "KBWI",
      label: "BWI",
      point: { latitude: 39.1754, longitude: -76.6683 },
    },
  ];

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
    STATIONS,
    getLatestObservation,
    getForecast,
  };
})();
