(function () {
  "use strict";

  const config = window.WeatherConfig;

  async function getDailyTemperatureNormals(station) {
    const body = {
      sid: station.nwsStation,
      sdate: relativeLocalDateKey(-config.recentObservationDays),
      edate: relativeLocalDateKey(config.forecastDays - 1),
      elems: [
        { name: "maxt", normal: 1 },
        { name: "mint", normal: 1 },
      ],
    };
    const data = await postJson(`${config.acisApiRoot}/StnData`, body);

    return {
      stationId: station.id,
      stationLabel: station.label,
      daily: (data.data || []).map((row) => ({
        date: row[0],
        high: parseClimateNumber(row[1]),
        low: parseClimateNumber(row[2]),
      })),
    };
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Climate request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  function parseClimateNumber(value) {
    if (value === "M" || value === null || typeof value === "undefined") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function relativeLocalDateKey(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: config.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${values.year}-${values.month}-${values.day}`;
  }

  window.ClimateApi = {
    getDailyTemperatureNormals,
  };
})();
