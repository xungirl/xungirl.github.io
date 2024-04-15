const API_KEY_BeiJing = "13014273332be0f221173b22cb4db50d";
const CITY_Beijing = "Beijing";

fetch(`https://api.openweathermap.org/data/2.5/weather?q=${CITY_Beijing}&units=metric&appid=${API_KEY_BeiJing}`)
.then(response => response.json())
.then(data => {
    document.getElementById("temperature-beijing").textContent = data.main.temp;
    document.getElementById("description-beijing").textContent = data.weather[0].description;
})
.catch(error => {
    console.error("Error fetching weather data:", error);
});
