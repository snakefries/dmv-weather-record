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

  async function getDailyTemperatureRecords(station) {
    const [recordHighs, recordLows] = await Promise.all([
      getRecordSeries(station, "maxt", "max"),
      getRecordSeries(station, "mint", "min"),
    ]);

    return {
      stationId: station.id,
      stationLabel: station.label,
      daily: getChartDateKeys().map((date) => {
        const dayIndex = calendarDayIndex(date);
        const recordHigh = parseRecordEntry(recordHighs[dayIndex]);
        const recordLow = parseRecordEntry(recordLows[dayIndex]);

        return {
          date,
          recordHigh: recordHigh.value,
          recordHighYear: recordHigh.year,
          recordLow: recordLow.value,
          recordLowYear: recordLow.year,
        };
      }),
    };
  }

  async function getRecordSeries(station, elementName, reduce) {
    const body = {
      sid: station.nwsStation,
      sdate: "por",
      edate: "por",
      elems: [
        {
          name: elementName,
          interval: "dly",
          duration: "dly",
          smry: { reduce, add: "date" },
          smry_only: 1,
          groupby: "year",
        },
      ],
    };
    const data = await postJson(`${config.acisApiRoot}/StnData`, body);

    return (data.smry && data.smry[0]) || [];
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

  function getChartDateKeys() {
    const dates = [];

    for (let offset = -config.recentObservationDays; offset < config.forecastDays; offset += 1) {
      dates.push(relativeLocalDateKey(offset));
    }

    return dates;
  }

  function calendarDayIndex(dateKey) {
    const month = Number(dateKey.slice(5, 7));
    const day = Number(dateKey.slice(8, 10));
    const date = new Date(Date.UTC(2024, month - 1, day));
    const yearStart = new Date(Date.UTC(2024, 0, 1));

    return Math.round((date - yearStart) / 86400000);
  }

  function parseRecordEntry(entry) {
    if (!entry) return { value: null, year: null };

    const value = parseClimateNumber(entry[0]);
    const year = typeof entry[1] === "string" ? entry[1].slice(0, 4) : null;

    return { value, year };
  }

  window.ClimateApi = {
    getDailyTemperatureNormals,
    getDailyTemperatureRecords,
  };
})();
