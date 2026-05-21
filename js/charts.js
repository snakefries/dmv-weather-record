(function () {
  "use strict";

  const STATION_COLORS = {
    DCA: { high: "#121212", low: "#696969" },
    IAD: { high: "#00749b", low: "#70aeca" },
    BWI: { high: "#c23b22", low: "#e19a8c" },
  };

  let temperatureChart;

  function renderTemperatureChart(canvas, forecasts) {
    const labels = buildLabels(forecasts);
    const datasets = forecasts.flatMap((forecast) => {
      const colors = STATION_COLORS[forecast.stationId];

      return [
        {
          label: `${forecast.stationId} high`,
          data: labels.map((label) => findTemperature(forecast.daily, label.date, "high")),
          borderColor: colors.high,
          backgroundColor: colors.high,
          borderWidth: 3,
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: `${forecast.stationId} low`,
          data: labels.map((label) => findTemperature(forecast.daily, label.date, "low")),
          borderColor: colors.low,
          backgroundColor: colors.low,
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ];
    });

    if (temperatureChart) {
      temperatureChart.destroy();
    }

    temperatureChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels.map((label) => label.display),
        datasets,
      },
      options: {
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "index",
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxHeight: 8,
              boxWidth: 20,
              color: "#262626",
              font: { size: 12, weight: "600" },
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.parsed.y}°F`,
            },
          },
        },
        scales: {
          x: {
            grid: {
              color: "#d5d0c6",
              lineWidth: 1.2,
            },
            ticks: {
              color: "#252525",
              maxRotation: 0,
              font: { size: 12, weight: "600" },
            },
          },
          y: {
            suggestedMin: 20,
            suggestedMax: 100,
            ticks: {
              color: "#252525",
              callback: (value) => `${value}°`,
            },
            grid: {
              color: "#88847b",
              lineWidth: 1.1,
            },
          },
        },
      },
    });
  }

  function buildLabels(forecasts) {
    const dateMap = new Map();

    forecasts.forEach((forecast) => {
      forecast.daily.forEach((day) => {
        if (!dateMap.has(day.date)) {
          dateMap.set(day.date, { date: day.date, display: day.label });
        }
      });
    });

    return Array.from(dateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7);
  }

  function findTemperature(days, date, key) {
    const day = days.find((item) => item.date === date);
    return day ? day[key] : null;
  }

  window.WeatherCharts = {
    renderTemperatureChart,
  };
})();
