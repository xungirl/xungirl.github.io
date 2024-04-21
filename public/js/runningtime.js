// 设置网站的开始运行日期，确保使用你网站的实际上线日期
const startDate = new Date('2023-07-20T00:00:00Z'); // 使用ISO格式

function updateRunningTime() {
    // 获取当前时间
    const now = new Date();
    // 计算当前时间与开始时间的差值，单位为毫秒
    const duration = now.getTime() - startDate.getTime();

    // 将毫秒转换为秒
    let seconds = Math.floor(duration / 1000);
    // 将秒转换为分钟
    let minutes = Math.floor(seconds / 60);
    // 将分钟转换为小时
    let hours = Math.floor(minutes / 60);
    // 将小时转换为天
    const days = Math.floor(hours / 24);

    // 计算剩余的小时数
    hours = hours % 24;
    // 计算剩余的分钟数
    minutes = minutes % 60;
    // 计算剩余的秒数
    seconds = seconds % 60;

    // 更新网页中显示运行时间的元素
    document.getElementById('time').textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// 首次调用函数以初始化显示
updateRunningTime();
// 设置定时器，每秒调用updateRunningTime函数更新显示
setInterval(updateRunningTime, 1000);
