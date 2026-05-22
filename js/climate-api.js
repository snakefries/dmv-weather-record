(function () {
  "use strict";

  const config = window.WeatherConfig;

  async function getDailyTemperatureNormals(station) {
    const body = {
      sid: station.climateStation || station.nwsStation,
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

  async function getMonthlyPrecipitation(station) {
    const currentYear = Number(relativeLocalDateKey(0).slice(0, 4));
    const [current, previous, previousComparison, summary] = await Promise.all([
      getMonthlyPrecipitationSeries(station, currentYear, true),
      getMonthlyPrecipitationSeries(station, currentYear - 1, false),
      getMonthlyPrecipitationSeries(station, currentYear - 2, false),
      getPrecipitationSummary(station, currentYear),
    ]);

    return {
      stationId: station.id,
      stationLabel: station.label,
      currentYear,
      previousYear: currentYear - 1,
      previousComparisonYear: currentYear - 2,
      current,
      previous,
      previousComparison,
      summary,
    };
  }

  async function getPrecipitationSummary(station, year) {
    const startDate = `${year}-01-01`;
    const endDate = relativeLocalDateKey(-1);
    if (endDate < startDate) {
      return {
        latestDaily: null,
        monthTotal: 0,
        monthNormal: 0,
        yearTotal: 0,
        yearNormal: 0,
      };
    }

    const body = {
      sid: station.climateStation || station.nwsStation,
      sdate: startDate,
      edate: endDate,
      elems: [{ name: "pcpn" }, { name: "pcpn", normal: 1 }],
    };
    const data = await postJson(`${config.acisApiRoot}/StnData`, body);
    const rows = data.data || [];
    const monthKey = endDate.slice(0, 7);
    const monthRows = rows.filter((row) => row[0].startsWith(monthKey));

    return {
      latestDaily: latestDailyPrecip(rows.map((row) => row[1])),
      monthTotal: sumDailyPrecip(monthRows.map((row) => row[1])),
      monthNormal: sumDailyPrecip(monthRows.map((row) => row[2])),
      yearTotal: sumDailyPrecip(rows.map((row) => row[1])),
      yearNormal: sumDailyPrecip(rows.map((row) => row[2])),
    };
  }

  async function getMonthlyPrecipitationSeries(station, year, includeNormals) {
    const body = {
      sid: station.climateStation || station.nwsStation,
      sdate: `${year}-01`,
      edate: `${year}-12`,
      elems: includeNormals
        ? [
            { name: "pcpn", interval: "mly", duration: "mly" },
            { name: "pcpn", interval: "mly", duration: "mly", normal: 1 },
          ]
        : [{ name: "pcpn", interval: "mly", duration: "mly" }],
    };
    const data = await postJson(`${config.acisApiRoot}/StnData`, body);

    return (data.data || []).map((row) => ({
      month: row[0],
      label: shortMonthLabel(row[0]),
      total: sumDailyPrecip(row[1]),
      normal: includeNormals ? parseClimateNumber(row[2]) : null,
      latestDaily: latestDailyPrecip(row[1]),
    }));
  }

  async function getRecordSeries(station, elementName, reduce) {
    const body = {
      sid: station.climateStation || station.nwsStation,
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

  function parsePrecipNumber(value) {
    if (value === "T") return 0;
    return parseClimateNumber(value);
  }

  function sumDailyPrecip(values) {
    if (!Array.isArray(values)) return null;

    const parsed = values.map(parsePrecipNumber).filter((value) => typeof value === "number");
    if (!parsed.length) return null;

    return roundPrecip(parsed.reduce((sum, value) => sum + value, 0));
  }

  function latestDailyPrecip(values) {
    if (!Array.isArray(values)) return null;

    for (let index = values.length - 1; index >= 0; index -= 1) {
      const value = parsePrecipNumber(values[index]);
      if (typeof value === "number") return roundPrecip(value);
    }

    return null;
  }

  function roundPrecip(value) {
    return Math.round(value * 100) / 100;
  }

  function shortMonthLabel(monthKey) {
    const date = new Date(`${monthKey}-01T12:00:00`);
    return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
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
    getMonthlyPrecipitation,
  };
})();
