---
title: "Travel | NanKing"
date: "2023-10-10"
tags: ["life"]

---



<!--more-->

<!-- 天气显示区域 -->
<div id="weather-info">
    <p>南京天气: <span id="temperature"></span>°C, <span id="description"></span>（实时监测）</p>
</div>

<script>
    const API_KEY = "13014273332be0f221173b22cb4db50d"; // 替换为你的 API 密钥
    const CITY = "Nanjing";

    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${CITY}&units=metric&appid=${API_KEY}`)
    .then(response => response.json())
    .then(data => {
        document.getElementById("temperature").textContent = data.main.temp;
        document.getElementById("description").textContent = data.weather[0].description;
    })
    .catch(error => {
        console.error("Error fetching weather data:", error);
    });
</script>



#  Meal

- 海底捞

- 肉大爷中式烤肉（江宁百家湖，经济实惠）

- Oasis西餐（总统府旁，晚上有微醺的氛围感，略贵）

- 1432德国花园餐厅（江宁砂之船奥莱，略贵）

- 火匠烤串（江宁百家湖）

- 南京大牌档（江宁百家湖，1912，老门东，经济实惠必去）

- 否堂日式烤肉（新街口）

- 火山taco（新街口，一家卖墨西哥taco的店我喜欢吃）

- 安家桂花汤圆与鸡鸣汤包

- 李记清真馆（1号线张府园，卖牛肉锅贴的据说NJ最好吃）

- 發發椰（新街口，椰汁好喝）

- 陆氏梅花糕（老门东景区内）

- 老鼓楼汤包（鸭血粉丝汤好喝）


#  Playground

- 宜家家居（3号线卡子门站，适合上午）

- 玄武湖和先锋书店（1号线玄武门站，适合下午picnic）

- 老门东（3号线武定门站，适合晚上）

- 灵谷寺（2号线孝陵卫3号口转bus202,桂花香且适合i人）

- 颐和路（4号线云南路4号口，适合citywalk)

- 南京博物院（2号线明故宫1号口，可去可不去）

- 百家湖

- 金陵style（4号线岗子村站3口，玄武湖旁，适合晚上）

- 鱼嘴湿地公园（2号线鱼嘴站8口，略远）

![](https://tuchuang-1312256370.cos.ap-shanghai.myqcloud.com/201901071546843938345812.svg)





