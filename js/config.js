(function () {
  "use strict";

  const STATIONS = [
    {
      id: "DCA",
      nwsStation: "KDCA",
      climateStation: "DCAthr",
      label: "National",
      point: { latitude: 38.8512, longitude: -77.0402 },
      chartColor: "#00749b",
      actualColor: "#111111",
    },
    {
      id: "IAD",
      nwsStation: "KIAD",
      climateStation: "IADthr",
      label: "Dulles",
      point: { latitude: 38.9531, longitude: -77.4565 },
      chartColor: "#138a36",
      actualColor: "#111111",
    },
    {
      id: "BWI",
      nwsStation: "KBWI",
      climateStation: "BWIthr",
      label: "BWI",
      point: { latitude: 39.1754, longitude: -76.6683 },
      chartColor: "#c23b22",
      actualColor: "#111111",
    },
  ];

  window.WeatherConfig = {
    defaultStationId: "DCA",
    apiRoot: "https://api.weather.gov",
    acisApiRoot: "https://data.rcc-acis.org",
    timeZone: "America/New_York",
    recentObservationDays: 5,
    forecastDays: 7,
    temperatureScaleMin: 30,
    temperatureScaleMax: 100,
    stations: STATIONS,
    recordHighColor: "#e22b2f",
    recordLowColor: "#19a7d8",
    normalRangeColor: "#cfcfcf",
  };
})();
