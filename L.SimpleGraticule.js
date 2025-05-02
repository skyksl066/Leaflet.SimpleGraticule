/**
 *  File: L.SimpleGraticule.js
 *  Desc: A graticule for Leaflet maps in the L.CRS.Simple coordinate system.
 *  Auth: Andrew Blakey (ablakey@gmail.com)
 */
L.SimpleGraticule = L.LayerGroup.extend({
    options: {
        interval: 20,
        showOriginLabel: true,
        showLabel: true,
        redraw: 'move',
        hidden: false,
        zoomIntervals: [],
        angle: 0
    },

    lineStyle: {
        stroke: true,
        color: '#111',
        opacity: 0.6,
        weight: 1,
        interactive: false,
        clickable: false //legacy support
    },

    // 新增一個屬性來儲存初始中心點
    _initialCenter: null,

    initialize: function (options) {
        L.LayerGroup.prototype.initialize.call(this);
        L.Util.setOptions(this, options);
    },

    onAdd: function (map) {
        this._map = map;
        // 儲存初始中心點
        this._initialCenter = map.getCenter();

        var graticule = this.redraw();
        this._map.on('viewreset ' + this.options.redraw, graticule.redraw, graticule);

        this.eachLayer(map.addLayer, map);
    },

    onRemove: function (map) {
        map.off('viewreset ' + this.options.redraw, this.redraw, this);
        this.eachLayer(this.removeLayer, this);
    },

    hide: function () {
        this.options.hidden = true;
        this.redraw();
    },

    show: function () {
        this.options.hidden = false;
        this.redraw();
    },

    redraw: function () {
        // 根據縮放層級動態計算 bufferRatio
        let currentZoom = this._map.getZoom();
        let bufferRatio;
    
        if (this.options.angle === 0) {
            bufferRatio = 0.5; // 沒有旋轉時保持原有的 buffer
        } else {
            // 根據縮放層級計算 buffer
            // 縮放層級越小，buffer 越大
            let baseBuffer = 5;  // 基礎 buffer 值
            let zoomFactor = Math.max(1, (20 - currentZoom) / 2); // 縮放因子，zoom 越小，因子越大
            bufferRatio = baseBuffer * zoomFactor;
        }

        this._bounds = this._map.getBounds().pad(bufferRatio);

        this.clearLayers();

        if (!this.options.hidden) {
            for (var i = 0; i < this.options.zoomIntervals.length; i++) {
                if (currentZoom >= this.options.zoomIntervals[i].start && currentZoom <= this.options.zoomIntervals[i].end) {
                    this.options.interval = this.options.zoomIntervals[i].interval;
                    break;
                }
            }

            this.constructLines(this.getMins(), this.getLineCounts());

            if (this.options.showOriginLabel) {
                this.addLayer(this.addOriginLabel());
            }
        }

        return this;
    },

    getLineCounts: function () {
        return {
            x: Math.ceil((this._bounds.getEast() - this._bounds.getWest()) /
                this.options.interval),
            y: Math.ceil((this._bounds.getNorth() - this._bounds.getSouth()) /
                this.options.interval)
        };
    },

    getMins: function () {
        //rounds up to nearest multiple of x
        var s = this.options.interval;
        return {
            x: Math.floor(this._bounds.getWest() / s) * s,
            y: Math.floor(this._bounds.getSouth() / s) * s
        };
    },

    constructLines: function (mins, counts) {
        var lines = new Array(counts.x + counts.y);
        var labels = new Array(counts.x + counts.y);

        //for horizontal lines
        for (var i = 0; i <= counts.x; i++) {
            var x = mins.x + i * this.options.interval;
            lines[i] = this.buildXLine(x);

            // 如果角度為 0，才生成標籤
            if (this.options.showLabel && this.options.angle === 0) {
                labels[i] = this.buildLabel('gridlabel-horiz', x);
            }
        }

        //for vertical lines
        for (var j = 0; j <= counts.y; j++) {
            var y = mins.y + j * this.options.interval;
            lines[j + i] = this.buildYLine(y);
            
            // 如果角度為 0，才生成標籤
            if (this.options.showLabel && this.options.angle === 0) {
                labels[j + i] = this.buildLabel('gridlabel-vert', y);
            }
        }

        lines.forEach(function(line) {
            if (line) this.addLayer(line);
        }, this);

        if (this.options.showLabel && this.options.angle === 0) {
            labels.forEach(function(label) {
                if (label) this.addLayer(label);
            }, this);
        }
    },

    buildXLine: function (x) {
        var bottomLL = new L.LatLng(this._bounds.getSouth(), x);
        var topLL = new L.LatLng(this._bounds.getNorth(), x);

        // 如果有角度，進行旋轉，使用初始中心點
        if (this.options.angle !== 0) {
            // 使用初始中心點而不是當前中心點
            bottomLL = this.rotatePoint(bottomLL, this._initialCenter, this.options.angle);
            topLL = this.rotatePoint(topLL, this._initialCenter, this.options.angle);
        }

        return new L.Polyline([bottomLL, topLL], this.lineStyle);
    },

    buildYLine: function (y) {
        var leftLL = new L.LatLng(y, this._bounds.getWest());
        var rightLL = new L.LatLng(y, this._bounds.getEast());

        // 如果有角度，進行旋轉，使用初始中心點
        if (this.options.angle !== 0) {
            // 使用初始中心點而不是當前中心點
            leftLL = this.rotatePoint(leftLL, this._initialCenter, this.options.angle);
            rightLL = this.rotatePoint(rightLL, this._initialCenter, this.options.angle);
        }

        return new L.Polyline([leftLL, rightLL], this.lineStyle);
    },

    // 新增旋轉點的輔助函數
    rotatePoint: function (point, center, angle) {
        // 將角度轉換為弧度
        var rad = angle * Math.PI / 180;

        // 計算相對於中心點的座標
        var dx = point.lng - center.lng;
        var dy = point.lat - center.lat;

        // 進行旋轉計算
        var cos = Math.cos(rad);
        var sin = Math.sin(rad);
        var newX = dx * cos - dy * sin + center.lng;
        var newY = dx * sin + dy * cos + center.lat;

        return new L.LatLng(newY, newX);
    },

    buildLabel: function (axis, val) {
        var bounds = this._map.getBounds().pad(-0.003);
        var latLng;
        if (axis == 'gridlabel-horiz') {
            latLng = new L.LatLng(bounds.getNorth(), val);
        } else {
            latLng = new L.LatLng(val, bounds.getWest());
        }

        return L.marker(latLng, {
            interactive: false,
            clickable: false, //legacy support
            icon: L.divIcon({
                iconSize: [0, 0],
                className: 'leaflet-grid-label',
                html: '<div class="' + axis + '">' + val + '</div>'
            })
        });
    },

    addOriginLabel: function () {
        return L.marker([0, 0], {
            interactive: false,
            clickable: false, //legacy support
            icon: L.divIcon({
                iconSize: [0, 0],
                className: 'leaflet-grid-label',
                html: '<div class="gridlabel-horiz">(0,0)</div>'
            })
        });
    }
});

L.simpleGraticule = function (options) {
    return new L.SimpleGraticule(options);
};