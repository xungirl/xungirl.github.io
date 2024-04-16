// radarChart.js
document.addEventListener('DOMContentLoaded', function () {
    var ctx = document.getElementById('myChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['前端', '数据库', '算法', '硬件', '底层', '人工智能'],
            datasets: [{
                label: '技能评分',
                data: [30, 10, 20, 0, 20, 40],
                fill: true,
                backgroundColor: 'rgba(118, 238, 198, 0.2)',
                borderColor: 'rgb(84 255 159)',
                pointBackgroundColor: 'rgb(255, 99, 132)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(255, 99, 132)'
            }]
        },
        options: {
            elements: {
                line: {
                    borderWidth: 1
                }
            }
        }
    });
});
