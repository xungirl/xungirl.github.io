// chart-setup.js
document.addEventListener('DOMContentLoaded', function() {
    const ctx = document.getElementById('myChart').getContext('2d');
    const myChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Front-end', 'Fundamentals', 'Hardware', 'Back-end', 'Mathematik', 'AI'],
            datasets: [{
                label: 'AI algorithm engineer',
                data: [40, 85, 75, 70, 95, 100],
                fill: true,
                backgroundColor: 'rgba(135, 206, 235, 0.2)', // 天蓝色背景
                borderColor: 'rgb(135, 206, 235)', // 天蓝色边框
                pointBackgroundColor: 'rgb(135, 206, 235)',
                pointBorderColor: '#fff',
                pointRadius: 2 ,// 设置点的大小
                borderWidth: 1
            }, {
                label: 'Software development engineer',
                data: [70, 90, 60, 85, 60, 50],
                fill: true,
                backgroundColor: 'rgba(147, 197, 114, 0.2)', // 开心果绿背景
                borderColor: 'rgb(147, 197, 114)', // 开心果绿边框
                pointBackgroundColor: 'rgb(147, 197, 114)',
                pointBorderColor: '#fff',
                pointRadius: 2 ,// 设置点的大小
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000, // 设置动画持续时间为1秒
                easing: 'easeInOutQuart' // 使用缓动函数使动画更加自然
            },
            scale: {
                ticks: {
                    beginAtZero: true,
                    display: false
                },
                gridLines: {
                    color: 'rgba(0,0,0,0)' // 使网格线透明
                },
                angleLines: {
                    color: 'rgba(0,0,0,0)' // 使角度线透明
                },
                backgroundColor: 'rgba(255, 165, 0, 0.2)', // 设置雷达图六边形内部背景为浅橙色
                pointLabels: {
                    fontSize: 20
                },
            },
            plugins:{
                legend: {
                    display: false 
                }
            }
        }
    });
});
