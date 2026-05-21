(function () {
  "use strict";

  const config = window.WeatherConfig;

  let temperatureChart;

  function renderTemperatureChart(canvas, forecast, recentDailyObservations) {
    const station = config.stations.find((item) => item.id === forecast.stationId);
    const forecastColor = station ? station.chartColor : config.stations[0].chartColor;
    const actualColor = station ? station.actualColor : config.stations[0].actualColor;
    const chartDays = buildTemperatureDays(forecast, recentDailyObservations);

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
            data: chartDays.map(() => null),
            backgroundColor: config.normalRangeColor,
            borderSkipped: false,
            borderRadius: 0,
            barPercentage: 0.46,
            categoryPercentage: 0.8,
            grouped: false,
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
          },
          {
            type: "line",
            label: "Record high",
            data: chartDays.map(() => null),
            backgroundColor: config.recordHighColor,
            pointRadius: 4,
            showLine: false,
          },
          {
            type: "line",
            label: "Record low",
            data: chartDays.map(() => null),
            backgroundColor: config.recordLowColor,
            pointRadius: 4,
            showLine: false,
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
                  const label =
                    context.dataset.label.indexOf("actual") === -1 ? "forecast" : "actual";
                  return `${forecast.stationId} ${label}: ${value[0]}°-${value[1]}°F`;
                }
                if (typeof value === "number") {
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

  function buildTemperatureDays(forecast, recentDailyObservations) {
    const observedDays = recentDailyObservations ? recentDailyObservations.daily : [];
    const forecastDays = forecast.daily.slice(0, 7);

    return [
      ...observedDays.map((day) => ({
        date: day.date,
        display: day.label,
        actualRange: buildRange(day),
        forecastRange: null,
      })),
      ...forecastDays.map((day, index) => ({
        date: day.date,
        display: index === 0 ? ["TODAY", day.label] : day.label,
        actualRange: null,
        forecastRange: buildRange(day),
      })),
    ];
  }

  function buildRange(day) {
    if (!day || typeof day.high !== "number" || typeof day.low !== "number") return null;
    return [Math.min(day.low, day.high), Math.max(day.low, day.high)];
  }

  function getScaleMinimum(days) {
    const lows = days
      .flatMap((day) => [day.actualRange, day.forecastRange])
      .filter(Array.isArray)
      .map((range) => range[0]);
    if (!lows.length) return 20;
    return Math.floor((Math.min(...lows) - 8) / 10) * 10;
  }

  function getScaleMaximum(days) {
    const highs = days
      .flatMap((day) => [day.actualRange, day.forecastRange])
      .filter(Array.isArray)
      .map((range) => range[1]);
    if (!highs.length) return 100;
    return Math.ceil((Math.max(...highs) + 8) / 10) * 10;
  }

  window.WeatherCharts = {
    renderTemperatureChart,
  };
})();
