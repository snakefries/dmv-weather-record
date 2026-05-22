(function () {
  "use strict";

  const config = window.WeatherConfig;

  let temperatureChart;
  let precipitationChart;

  function renderTemperatureChart(
    canvas,
    forecast,
    recentDailyObservations,
    climateNormals,
    temperatureRecords
  ) {
    const station = config.stations.find((item) => item.id === forecast.stationId);
    const forecastColor = station ? station.chartColor : config.stations[0].chartColor;
    const actualColor = station ? station.actualColor : config.stations[0].actualColor;
    const chartDays = buildTemperatureDays(
      forecast,
      recentDailyObservations,
      climateNormals,
      temperatureRecords
    );

    if (temperatureChart) {
      temperatureChart.destroy();
    }

    temperatureChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: chartDays.map((day) => day.display),
        datasets: [
          {
            label: "Historical average",
            data: chartDays.map((day) => day.normalRange),
            backgroundColor: config.normalRangeColor,
            borderSkipped: false,
            borderRadius: 0,
            barPercentage: 0.46,
            categoryPercentage: 0.8,
            grouped: false,
            order: 3,
          },
          {
            label: `${forecast.stationId} actual range`,
            data: chartDays.map((day) => day.actualRange),
            backgroundColor: actualColor,
            borderColor: actualColor,
            borderSkipped: false,
            borderRadius: 999,
            barPercentage: 0.22,
            categoryPercentage: 0.8,
            grouped: false,
            order: 1,
          },
          {
            label: `${forecast.stationId} forecast range`,
            data: chartDays.map((day) => day.forecastRange),
            backgroundColor: forecastColor,
            borderColor: forecastColor,
            borderSkipped: false,
            borderRadius: 999,
            barPercentage: 0.22,
            categoryPercentage: 0.8,
            grouped: false,
            order: 1,
          },
          {
            type: "line",
            label: "Record high",
            data: chartDays.map((day) => day.recordHigh),
            backgroundColor: config.recordHighColor,
            borderColor: config.recordHighColor,
            pointRadius: 4.5,
            pointHoverRadius: 6,
            showLine: false,
            order: 0,
          },
          {
            type: "line",
            label: "Record low",
            data: chartDays.map((day) => day.recordLow),
            backgroundColor: config.recordLowColor,
            borderColor: config.recordLowColor,
            pointRadius: 4.5,
            pointHoverRadius: 6,
            showLine: false,
            order: 0,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "index",
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            filter: (context) => context.raw !== null,
            callbacks: {
              title: (items) => {
                const label = chartDays[items[0].dataIndex].display;
                return Array.isArray(label) ? label.join(" ") : label;
              },
              label: (context) => {
                const value = context.raw;
                if (Array.isArray(value)) {
                  const datasetLabel = context.dataset.label.toLowerCase();
                  const label = datasetLabel.includes("actual")
                    ? "actual"
                    : datasetLabel.includes("historical")
                      ? "historical average"
                      : "forecast";
                  return `${forecast.stationId} ${label}: ${value[0]}°-${value[1]}°F`;
                }
                if (typeof value === "number") {
                  const day = chartDays[context.dataIndex];
                  if (context.dataset.label === "Record high") {
                    return `Record high: ${value}°F (${day.recordHighYear || "year unavailable"})`;
                  }
                  if (context.dataset.label === "Record low") {
                    return `Record low: ${value}°F (${day.recordLowYear || "year unavailable"})`;
                  }
                  return `${context.dataset.label}: ${value}°F`;
                }
                return "";
              },
            },
          },
        },
        scales: {
          x: {
            offset: true,
            grid: {
              color: "#5e5b55",
              drawTicks: true,
              lineWidth: 1,
            },
            ticks: {
              color: "#1f1f1f",
              maxRotation: 0,
              font: (context) => ({
                family: "Arial, Helvetica, sans-serif",
                size: context.index === 0 ? 11 : 12,
                weight: "700",
              }),
            },
          },
          y: {
            bounds: "ticks",
            beginAtZero: false,
            min: getScaleMinimum(chartDays),
            max: getScaleMaximum(chartDays),
            ticks: {
              color: "#1f1f1f",
              stepSize: 10,
              callback: (value) => `${value}°`,
              font: {
                family: "Arial, Helvetica, sans-serif",
                size: 12,
              },
            },
            grid: {
              color: "#5e5b55",
              lineWidth: 1,
            },
          },
        },
      },
    });
  }

  function buildTemperatureDays(
    forecast,
    recentDailyObservations,
    climateNormals,
    temperatureRecords
  ) {
    const observedDays = recentDailyObservations ? recentDailyObservations.daily : [];
    const forecastDays = forecast.daily.slice(0, 7);
    const normalByDate = new Map(
      (climateNormals ? climateNormals.daily : []).map((day) => [day.date, buildRange(day)])
    );
    const recordByDate = new Map(
      (temperatureRecords ? temperatureRecords.daily : []).map((day) => [day.date, day])
    );

    return [
      ...observedDays.map((day) => ({
        date: day.date,
        display: day.label,
        actualRange: buildRange(day),
        forecastRange: null,
        normalRange: normalByDate.get(day.date) || null,
        ...getRecordValues(recordByDate.get(day.date)),
      })),
      ...forecastDays.map((day, index) => ({
        date: day.date,
        display: index === 0 ? ["TODAY", day.label] : day.label,
        actualRange: null,
        forecastRange: buildRange(day),
        normalRange: normalByDate.get(day.date) || null,
        ...getRecordValues(recordByDate.get(day.date)),
      })),
    ];
  }

  function getRecordValues(record) {
    return {
      recordHigh: record ? record.recordHigh : null,
      recordHighYear: record ? record.recordHighYear : null,
      recordLow: record ? record.recordLow : null,
      recordLowYear: record ? record.recordLowYear : null,
    };
  }

  function buildRange(day) {
    if (!day || typeof day.high !== "number" || typeof day.low !== "number") return null;
    return [Math.min(day.low, day.high), Math.max(day.low, day.high)];
  }

  function getScaleMinimum(days) {
    const lows = days
      .flatMap((day) => [day.actualRange, day.forecastRange])
      .concat(days.map((day) => day.normalRange))
      .concat(days.map((day) => [day.recordLow, day.recordLow]))
      .filter(Array.isArray)
      .filter((range) => typeof range[0] === "number")
      .map((range) => range[0]);
    if (!lows.length) return config.temperatureScaleMin;
    const minimum = Math.min(...lows);
    return minimum < config.temperatureScaleMin
      ? Math.floor((minimum - 2) / 10) * 10
      : config.temperatureScaleMin;
  }

  function getScaleMaximum(days) {
    const highs = days
      .flatMap((day) => [day.actualRange, day.forecastRange])
      .concat(days.map((day) => day.normalRange))
      .concat(days.map((day) => [day.recordHigh, day.recordHigh]))
      .filter(Array.isArray)
      .filter((range) => typeof range[1] === "number")
      .map((range) => range[1]);
    if (!highs.length) return config.temperatureScaleMax;
    const maximum = Math.max(...highs);
    return maximum > config.temperatureScaleMax
      ? Math.ceil((maximum + 2) / 10) * 10
      : config.temperatureScaleMax;
  }

  function renderPrecipitationChart(canvas, precipitation) {
    const station = config.stations.find((item) => item.id === precipitation.stationId);
    const displayMonths = getRollingPrecipitationMonths();
    const labels = displayMonths.map(({ month, year }) => [shortMonthLabel(month), String(year)]);
    const latestTotals = displayMonths.map(({ month, year }) =>
      getPrecipitationMonth(year === precipitation.currentYear ? precipitation.current : precipitation.previous, month)
        ?.total
    );
    const previousTotals = displayMonths.map(({ month, year }) =>
      getPrecipitationMonth(
        year === precipitation.currentYear ? precipitation.previous : precipitation.previousComparison || [],
        month
      )?.total
    );
    const normalTotals = displayMonths.map(({ month }) =>
      getPrecipitationMonth(precipitation.current, month)?.normal
    );

    if (precipitationChart) {
      precipitationChart.destroy();
    }

    precipitationChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Previous year",
            data: previousTotals,
            backgroundColor: "#a8d9e8",
            borderSkipped: false,
            categoryPercentage: 0.72,
            barPercentage: 0.9,
          },
          {
            label: "Historical average",
            data: normalTotals,
            backgroundColor: config.normalRangeColor,
            borderSkipped: false,
            categoryPercentage: 0.72,
            barPercentage: 0.9,
          },
          {
            label: "Latest",
            data: latestTotals,
            backgroundColor: station ? station.chartColor : config.stations[0].chartColor,
            borderSkipped: false,
            categoryPercentage: 0.72,
            barPercentage: 0.9,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "index",
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${formatInches(context.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: "#1f1f1f",
              maxRotation: 0,
              font: {
                family: "Arial, Helvetica, sans-serif",
                size: 12,
                weight: "700",
              },
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: getPrecipScaleMax([...previousTotals, ...latestTotals, ...normalTotals]),
            ticks: {
              color: "#1f1f1f",
              callback: (value) => `${value}"`,
              font: {
                family: "Arial, Helvetica, sans-serif",
                size: 12,
              },
            },
            grid: {
              color: "#5e5b55",
              lineWidth: 1,
            },
          },
        },
      },
    });
  }

  function getRollingPrecipitationMonths() {
    const currentMonth = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: config.timeZone,
        month: "numeric",
      }).format(new Date())
    );

    const currentYear = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: config.timeZone,
        year: "numeric",
      }).format(new Date())
    );

    return Array.from({ length: 12 }, (_, index) => {
      const month = ((currentMonth + index - 1) % 12) + 1;
      return {
        month,
        year: month < currentMonth ? currentYear : currentYear - 1,
      };
    });
  }

  function getPrecipitationMonth(months, month) {
    const monthSuffix = `-${String(month).padStart(2, "0")}`;
    return months.find((item) => item.month.endsWith(monthSuffix));
  }

  function shortMonthLabel(month) {
    const date = new Date(2024, month - 1, 1, 12);
    return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
  }

  function getPrecipScaleMax(values) {
    const max = Math.max(...values.filter((value) => typeof value === "number"), 1);
    return Math.ceil(max + 1);
  }

  function formatInches(value) {
    if (typeof value !== "number") return "--";
    return `${value.toFixed(2)}"`;
  }

  window.WeatherCharts = {
    renderTemperatureChart,
    renderPrecipitationChart,
  };
})();
