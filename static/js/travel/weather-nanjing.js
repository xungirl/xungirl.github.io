const API_KEY_NanJing = "13014273332be0f221173b22cb4db50d";
const CITY = "Nanjing";

fetch(`https://api.openweathermap.org/data/2.5/weather?q=${CITY}&units=metric&appid=${API_KEY_NanJing}`)
.then(response => response.json())
.then(data => {
    document.getElementById("temperature-nanjing").textContent = data.main.temp;
    document.getElementById("description-nanjing").textContent = data.weather[0].description;
})
.catch(error => {
    console.error("Error fetching weather data:", error);
});
