const API_KEY = "98eea154d90a973c9308bc1ad870d145";
const CITY = "Beijing";

fetch(`https://api.openweathermap.org/data/2.5/weather?q=${CITY}&units=metric&appid=${API_KEY}`)
.then(response => response.json())
.then(data => {
    document.getElementById("temperature-beijing").textContent = data.main.temp;
    document.getElementById("description-beijing").textContent = data.weather[0].description;
})
.catch(error => {
    console.error("Error fetching weather data:", error);
});
