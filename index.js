// 动态点图可视化 - 骑行事故空间风险分析
class DynamicPointMap {
    constructor() {
        this.map = null;
        this.svg = null;
        this.projection = null;
        this.path = null;
        this.animationId = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.timeStep = 0;
        this.accidentData = [];
        this.bikeLanesData = this.generateBikeLanesData();
        
        // 加载GeoJSON数据
        this.loadGeoJsonData();
    }
    
    async loadGeoJsonData() {
        this.updateDebugStatus("正在加载GeoJSON数据...");
        
        try {
            const data = await d3.json('graph3.geojson');
            this.accidentData = this.parseGeoJson(data);
            this.updateDebugStatus(`成功加载 ${this.accidentData.length} 条事故数据`);
            this.init();
        } catch (error) {
            this.updateDebugStatus(`GeoJSON加载失败: ${error.message}`);
            console.error('加载GeoJSON失败:', error);
            // 如果加载失败，使用模拟数据
            this.accidentData = this.generateMockData();
            this.init();
        }
    }
    
    parseGeoJson(geojson) {
        this.updateDebugStatus("解析GeoJSON数据...");
        
        return geojson.features.map((feature, index) => ({
            id: feature.properties.id || index,
            longitude: feature.geometry.coordinates[0],
            latitude: feature.geometry.coordinates[1],
            type: feature.properties.type || 'property',
            street: feature.properties.street || '',
            date: feature.properties.date || '',
            severity: feature.properties.severity || '',
            description: feature.properties.description || '',
            time: this.dateToTimeIndex(feature.properties.date),
            onProtectedLane: feature.properties.onProtectedLane || false
        }));
    }
    
    dateToTimeIndex(dateStr) {
        if (!dateStr) return Math.floor(Math.random() * 100);
        
        try {
            const date = new Date(dateStr);
            const startDate = new Date('2020-01-01');
            const endDate = new Date('2023-12-31');
            
            const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
            const currentDays = (date - startDate) / (1000 * 60 * 60 * 24);
            
            return Math.max(0, Math.min(100, Math.round((currentDays / totalDays) * 100)));
        } catch (error) {
            return Math.floor(Math.random() * 100);
        }
    }
    
    init() {
        this.updateDebugStatus("开始初始化...");
        
        try {
            this.setupMap();
            this.setupControls();
            this.renderMap();
            this.updateStats();
            this.updateDebugStatus("初始化完成！");
        } catch (error) {
            this.updateDebugStatus(`初始化失败: ${error.message}`);
            console.error('初始化错误:', error);
        }
    }
    
    updateDebugStatus(message) {
        const debugStatus = document.getElementById("debug-status");
        if (debugStatus) {
            debugStatus.textContent = message;
        }
        console.log("调试信息:", message);
    }
    
    setupMap() {
        this.updateDebugStatus("设置地图投影...");
        
        // 检查地图容器是否存在
        const mapContainer = document.getElementById("map");
        if (!mapContainer) {
            throw new Error("地图容器 #map 不存在");
        }
        
        // 设置地图投影 - 纽约市区域
        this.projection = d3.geoMercator()
            .center([-74.006, 40.7128]) // 纽约市中心
            .scale(80000)
            .translate([400, 250]);
        
        this.path = d3.geoPath().projection(this.projection);
        
        this.updateDebugStatus("创建SVG容器...");
        
        // 创建SVG容器
        this.svg = d3.select("#map")
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", "0 0 800 500");
        
        // 添加背景
        this.svg.append("rect")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("fill", "#e8f4f8");
        
        // 添加网格线
        this.addGridLines();
        
        // 添加标题
        this.svg.append("text")
            .attr("x", 400)
            .attr("y", 30)
            .attr("text-anchor", "middle")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .attr("fill", "#004466")
            .text("纽约市骑行事故动态分布图 (基于graph3.geojson)");
            
        // 添加坐标轴标签
        this.svg.append("text")
            .attr("x", 400)
            .attr("y", 480)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("fill", "#666")
            .text("经度: -74.0° 到 -73.9° | 纬度: 40.65° 到 40.75°");
            
        this.updateDebugStatus("地图基础设置完成");
    }
    
    addGridLines() {
        // 添加简单的网格线来帮助定位
        const gridGroup = this.svg.append("g").attr("class", "grid");
        
        // 垂直线
        for (let i = 0; i <= 8; i++) {
            gridGroup.append("line")
                .attr("x1", i * 100)
                .attr("y1", 50)
                .attr("x2", i * 100)
                .attr("y2", 450)
                .attr("stroke", "#ddd")
                .attr("stroke-width", 1)
                .attr("opacity", 0.3);
        }
        
        // 水平线
        for (let i = 0; i <= 4; i++) {
            gridGroup.append("line")
                .attr("x1", 0)
                .attr("y1", 50 + i * 100)
                .attr("x2", 800)
                .attr("y2", 50 + i * 100)
                .attr("stroke", "#ddd")
                .attr("stroke-width", 1)
                .attr("opacity", 0.3);
        }
    }
    
    setupControls() {
        this.updateDebugStatus("设置控制面板...");
        
        const timeSlider = document.getElementById("timeSlider");
        const timeDisplay = document.getElementById("timeDisplay");
        const filterType = document.getElementById("filterType");
        const playButton = document.getElementById("playButton");
        const resetButton = document.getElementById("resetButton");
        
        // 检查控制元素是否存在
        if (!timeSlider || !timeDisplay || !filterType || !playButton || !resetButton) {
            this.updateDebugStatus("警告: 部分控制元素未找到");
        }
        
        // 时间滑块控制
        if (timeSlider) {
            timeSlider.addEventListener("input", (e) => {
                this.currentTime = parseInt(e.target.value);
                this.timeStep = this.currentTime;
                this.updateTimeDisplay();
                this.renderAccidents();
            });
        }
        
        // 事故类型筛选
        if (filterType) {
            filterType.addEventListener("change", (e) => {
                this.renderAccidents();
            });
        }
        
        // 播放/暂停按钮
        if (playButton) {
            playButton.addEventListener("click", () => {
                if (this.isPlaying) {
                    this.pauseAnimation();
                } else {
                    this.playAnimation();
                }
            });
        }
        
        // 重置按钮
        if (resetButton) {
            resetButton.addEventListener("click", () => {
                this.resetAnimation();
            });
        }
        
        this.updateTimeDisplay();
        this.updateDebugStatus("控制面板设置完成");
    }
    
    updateTimeDisplay() {
        const timeDisplay = document.getElementById("timeDisplay");
        if (timeDisplay) {
            const year = 2020 + Math.floor(this.currentTime / 25); // 2020-2023年
            const month = Math.floor((this.currentTime % 25) / 2) + 1;
            timeDisplay.textContent = `${year}年${month}月`;
        }
    }
    
    renderMap() {
        this.updateDebugStatus("渲染地图元素...");
        
        try {
            // 绘制自行车道
            this.renderBikeLanes();
            
            // 绘制事故点
            this.renderAccidents();
            
            this.updateDebugStatus("地图渲染完成");
        } catch (error) {
            this.updateDebugStatus(`渲染失败: ${error.message}`);
            console.error('渲染错误:', error);
        }
    }
    
    renderBikeLanes() {
        // 清除现有的自行车道
        this.svg.selectAll(".bike-lane").remove();
        
        // 绘制自行车道
        this.svg.selectAll(".bike-lane")
            .data(this.bikeLanesData)
            .enter()
            .append("path")
            .attr("class", "bike-lane")
            .attr("d", d => this.path(d.geometry))
            .attr("stroke", d => d.properties.protected ? "#4caf50" : "#2196f3")
            .attr("stroke-width", 3)
            .attr("fill", "none")
            .attr("opacity", 0.7);
    }
    
    renderAccidents() {
        const filterType = document.getElementById("filterType");
        const filterValue = filterType ? filterType.value : "all";
        
        // 清除现有的事故点
        this.svg.selectAll(".accident-point").remove();
        
        // 筛选数据
        let filteredData = this.accidentData.filter(d => {
            if (filterValue === "all") return true;
            return d.type === filterValue;
        });
        
        // 根据时间筛选
        filteredData = filteredData.filter(d => d.time <= this.currentTime);
        
        this.updateDebugStatus(`渲染 ${filteredData.length} 个事故点...`);
        
        // 绘制事故点
        const points = this.svg.selectAll(".accident-point")
            .data(filteredData)
            .enter()
            .append("circle")
            .attr("class", "accident-point")
            .attr("cx", d => this.projection([d.longitude, d.latitude])[0])
            .attr("cy", d => this.projection([d.longitude, d.latitude])[1])
            .attr("r", 0)
            .attr("fill", d => this.getAccidentColor(d.type))
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("opacity", 0.8);
        
        // 添加动画效果
        points.transition()
            .duration(500)
            .attr("r", d => this.getAccidentSize(d.type))
            .attr("opacity", 0.8);
        
        // 添加悬停效果
        points.on("mouseover", (event, d) => {
            this.showTooltip(event, d);
        })
        .on("mouseout", () => {
            this.hideTooltip();
        });
        
        this.updateStats();
    }
    
    getAccidentColor(type) {
        const colors = {
            "fatal": "#d32f2f",
            "injury": "#ff9800", 
            "property": "#2196f3"
        };
        return colors[type] || "#666";
    }
    
    getAccidentSize(type) {
        const sizes = {
            "fatal": 10,
            "injury": 7,
            "property": 5
        };
        return sizes[type] || 5;
    }
    
    showTooltip(event, data) {
        const tooltip = d3.select("body").selectAll(".tooltip").data([1]);
        
        tooltip.enter()
            .append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("background", "rgba(0,0,0,0.8)")
            .style("color", "white")
            .style("padding", "8px")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("z-index", "1000");
        
        tooltip.html(`
            <strong>事故类型:</strong> ${this.getAccidentTypeName(data.type)}<br>
            <strong>位置:</strong> ${data.street}<br>
            <strong>时间:</strong> ${data.date}<br>
            <strong>严重程度:</strong> ${data.severity}<br>
            <strong>描述:</strong> ${data.description}
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
    }
    
    hideTooltip() {
        d3.selectAll(".tooltip").remove();
    }
    
    getAccidentTypeName(type) {
        const names = {
            "fatal": "致命事故",
            "injury": "受伤事故", 
            "property": "财产损失"
        };
        return names[type] || "未知";
    }
    
    playAnimation() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        const playButton = document.getElementById("playButton");
        if (playButton) {
            playButton.innerHTML = '<i class="fa fa-pause"></i> 暂停';
        }
        
        const animate = () => {
            if (!this.isPlaying) return;
            
            this.currentTime += 1;
            if (this.currentTime > 100) {
                this.currentTime = 0;
            }
            
            const timeSlider = document.getElementById("timeSlider");
            if (timeSlider) {
                timeSlider.value = this.currentTime;
            }
            this.updateTimeDisplay();
            this.renderAccidents();
            
            this.animationId = setTimeout(animate, 200);
        };
        
        animate();
    }
    
    pauseAnimation() {
        this.isPlaying = false;
        const playButton = document.getElementById("playButton");
        if (playButton) {
            playButton.innerHTML = '<i class="fa fa-play"></i> 播放动画';
        }
        
        if (this.animationId) {
            clearTimeout(this.animationId);
        }
    }
    
    resetAnimation() {
        this.pauseAnimation();
        this.currentTime = 0;
        const timeSlider = document.getElementById("timeSlider");
        if (timeSlider) {
            timeSlider.value = 0;
        }
        this.updateTimeDisplay();
        this.renderAccidents();
    }
    
    updateStats() {
        const filterType = document.getElementById("filterType");
        const filterValue = filterType ? filterType.value : "all";
        
        let filteredData = this.accidentData.filter(d => {
            if (filterValue === "all") return true;
            return d.type === filterValue;
        });
        
        filteredData = filteredData.filter(d => d.time <= this.currentTime);
        
        // 计算统计数据
        const totalAccidents = filteredData.length;
        const highRiskAreas = this.calculateHighRiskAreas(filteredData);
        const protectedRate = this.calculateProtectedRate(filteredData);
        
        // 更新显示
        const totalElement = document.getElementById("totalAccidents");
        const areasElement = document.getElementById("highRiskAreas");
        const rateElement = document.getElementById("protectedRate");
        
        if (totalElement) totalElement.textContent = totalAccidents;
        if (areasElement) areasElement.textContent = highRiskAreas;
        if (rateElement) rateElement.textContent = protectedRate + "%";
    }
    
    calculateHighRiskAreas(data) {
        // 简化的高风险区域计算
        const areas = {};
        data.forEach(d => {
            const area = d.street.split(' ')[0]; // 简化：取街道名第一个词作为区域
            areas[area] = (areas[area] || 0) + 1;
        });
        
        return Object.values(areas).filter(count => count >= 3).length;
    }
    
    calculateProtectedRate(data) {
        if (data.length === 0) return 0;
        
        const protectedAccidents = data.filter(d => d.onProtectedLane).length;
        return Math.round((protectedAccidents / data.length) * 100);
    }
    
    // 生成模拟事故数据（备用）
    generateMockData() {
        this.updateDebugStatus("生成模拟事故数据...");
        
        const data = [];
        const streets = [
            "Broadway", "5th Avenue", "Park Avenue", "Madison Avenue", 
            "Lexington Avenue", "3rd Avenue", "2nd Avenue", "1st Avenue",
            "West Side Highway", "FDR Drive", "Queens Boulevard", "Atlantic Avenue"
        ];
        
        const accidentTypes = ["fatal", "injury", "property"];
        const severities = ["轻微", "中等", "严重"];
        
        for (let i = 0; i < 200; i++) {
            const time = Math.floor(Math.random() * 100);
            const type = accidentTypes[Math.floor(Math.random() * accidentTypes.length)];
            const street = streets[Math.floor(Math.random() * streets.length)];
            
            // 纽约市坐标范围 - 调整到更合理的范围
            const latitude = 40.7 + (Math.random() - 0.5) * 0.08;
            const longitude = -74.0 + (Math.random() - 0.5) * 0.08;
            
            data.push({
                id: i,
                time: time,
                type: type,
                street: street,
                latitude: latitude,
                longitude: longitude,
                date: `202${Math.floor(time/25)}-${Math.floor((time%25)/2)+1}-${Math.floor(Math.random()*28)+1}`,
                severity: severities[Math.floor(Math.random() * severities.length)],
                onProtectedLane: Math.random() > 0.6 // 60%在非受保护道上
            });
        }
        
        this.updateDebugStatus(`生成了 ${data.length} 条事故数据`);
        return data;
    }
    
    // 生成模拟自行车道数据
    generateBikeLanesData() {
        this.updateDebugStatus("生成模拟自行车道数据...");
        
        const lanes = [];
        const streets = [
            "Broadway", "5th Avenue", "Park Avenue", "Madison Avenue", 
            "Lexington Avenue", "3rd Avenue", "2nd Avenue", "1st Avenue"
        ];
        
        streets.forEach((street, index) => {
            const isProtected = Math.random() > 0.5;
            const startLon = -74.0 + (index * 0.008);
            const endLon = startLon + 0.015;
            const lat = 40.7 + (Math.random() - 0.5) * 0.04;
            
            lanes.push({
                type: "Feature",
                properties: {
                    name: street,
                    protected: isProtected
                },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [startLon, lat],
                        [endLon, lat]
                    ]
                }
            });
        });
        
        this.updateDebugStatus(`生成了 ${lanes.length} 条自行车道数据`);
        return lanes;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log("页面加载完成，开始初始化动态点图...");
    
    // 检查D3.js是否加载
    if (typeof d3 === 'undefined') {
        console.error("D3.js 未加载！");
        const debugStatus = document.getElementById("debug-status");
        if (debugStatus) {
            debugStatus.textContent = "错误：D3.js 未加载";
        }
        return;
    }
    
    try {
        new DynamicPointMap();
        console.log("动态点图初始化成功！");
    } catch (error) {
        console.error("初始化失败:", error);
        const debugStatus = document.getElementById("debug-status");
        if (debugStatus) {
            debugStatus.textContent = `错误：${error.message}`;
        }
    }
});
