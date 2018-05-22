/**
 * @fileoverview MarkerClusterer标记聚合器用来解决加载大量点要素到地图上产生覆盖现象的问题，并提高性能。
 * 主入口类是<a href="symbols/BMapLib.MarkerClusterer.html">MarkerClusterer</a>，
 * 基于Baidu Map API 1.2。
 *
 * @author Baidu Map Api Group 
 * @version 1.2
 */
 

/** 
 * @namespace BMap的所有library类均放在BMapLib命名空间下
 */
var BMapLib = window.BMapLib = BMapLib || {};
(function(){
    
    /**
     * 获取一个扩展的视图范围，把上下左右都扩大一样的像素值。
     * @param {Map} map BMap.Map的实例化对象
     * @param {BMap.Bounds} bounds BMap.Bounds的实例化对象
     * @param {Number} gridSize 要扩大的像素值
     *
     * @return {BMap.Bounds} 返回扩大后的视图范围。
     */
    var getExtendedBounds = function(map, bounds, gridSize){
        bounds = cutBoundsInRange(bounds);
        var pixelNE = map.pointToPixel(bounds.getNorthEast());
        var pixelSW = map.pointToPixel(bounds.getSouthWest());
        pixelNE.x += gridSize*2;
        pixelNE.y -= gridSize;
        pixelSW.x -= gridSize*2;
        pixelSW.y += gridSize;
        var newNE = map.pixelToPoint(pixelNE);
        var newSW = map.pixelToPoint(pixelSW);
        return new BMap.Bounds(newSW, newNE);
    };

    /**
     * 按照百度地图支持的世界范围对bounds进行边界处理
     * @param {BMap.Bounds} bounds BMap.Bounds的实例化对象
     *
     * @return {BMap.Bounds} 返回不越界的视图范围
     */
    var cutBoundsInRange = function (bounds) {
        var maxX = getRange(bounds.getNorthEast().lng, -180, 180);
        var minX = getRange(bounds.getSouthWest().lng, -180, 180);
        var maxY = getRange(bounds.getNorthEast().lat, -74, 74);
        var minY = getRange(bounds.getSouthWest().lat, -74, 74);
        return new BMap.Bounds(new BMap.Point(minX, minY), new BMap.Point(maxX, maxY));
    }; 

    /**
     * 对单个值进行边界处理。
     * @param {Number} i 要处理的数值
     * @param {Number} min 下边界值
     * @param {Number} max 上边界值
     * 
     * @return {Number} 返回不越界的数值
     */
    var getRange = function (i, mix, max) {
        mix && (i = Math.max(i, mix));
        max && (i = Math.min(i, max));
        return i;
    };

    /**
     * 判断给定的对象是否为数组
     * @param {Object} source 要测试的对象
     *
     * @return {Boolean} 如果是数组返回true，否则返回false
     */
    var isArray = function (source) {
        return '[object Array]' === Object.prototype.toString.call(source);
    };

    /**
     * 返回item在source中的索引位置
     * @param {Object} item 要测试的对象
     * @param {Array} source 数组
     *
     * @return {Number} 如果在数组内，返回索引，否则返回-1
     */
    var indexOf = function(item, source){
        var index = -1;
        if(isArray(source)){
            if (source.indexOf) {
                index = source.indexOf(item);
            } else {
                for (var i = 0, m; m = source[i]; i++) {
                    if (m === item) {
                        index = i;
                        break;
                    }
                }
            }
        }        
        return index;
    };

    /**
     *@exports MarkerClusterer as BMapLib.MarkerClusterer
     */
    var MarkerClusterer =  
        /**
         * MarkerClusterer
         * @class 用来解决加载大量点要素到地图上产生覆盖现象的问题，并提高性能
         * @constructor
         * @param {Map} map 地图的一个实例。
         * @param {Json Object} options 可选参数，可选项包括：<br />
         *    markers {Array<Marker>} 要聚合的标记数组<br />
         *    girdSize {Number} 聚合计算时网格的像素大小，默认60<br />
         *    maxZoom {Number} 最大的聚合级别，大于该级别就不进行相应的聚合<br />
         *    minClusterSize {Number} 最小的聚合数量，小于该数量的不能成为一个聚合，默认为2<br />
         *    isAverangeCenter {Boolean} 聚合点的落脚位置是否是所有聚合在内点的平均值，默认为否，落脚在聚合内的第一个点<br />
         *    styles {Array<IconStyle>} 自定义聚合后的图标风格，请参考TextIconOverlay类<br />
         */
        BMapLib.MarkerClusterer = function(map, options, mymap){
            if (!map){
                return;
            }
            this._map = map;
            this._markers = [];
            this._clusters = [];
            this._mymap = mymap

            var opts = options || {};
            this._gridSize = opts["gridSize"] || -50;
            this._maxZoom = opts["maxZoom"] || 18;
            this._minClusterSize = opts["minClusterSize"] || 1;           
            this._isAverageCenter = true;
            if (opts['isAverageCenter'] != undefined) {
                this._isAverageCenter = opts['isAverageCenter'];
            }    
            this._styles = opts["styles"] || [];
        
            var that = this;
            this._map.addEventListener("zoomend",function(e){
                that._redraw();     
            });
            this._map.addEventListener("moveend",function(e){
                 if(that._map.getZoom() > 13) {
                     that._redraw();
                 }else{
                     if(that._mymap.statistics.length == 0){
                         that._redraw();
                     }else {
                         that._mymap.hideloading()
                     }
                 }
            });

            var mkrs = opts["markers"];
            isArray(mkrs) && this.addMarkers(mkrs);
        };

    /**
     * 添加要聚合的标记数组。
     * @param {Array<Marker>} markers 要聚合的标记数组
     *
     * @return 无返回值。
     */
    MarkerClusterer.prototype.addMarkers = function(markers){
        // for(var i = 0, len = markers.length; i <len ; i++){
        //     this._pushMarkerTo(markers[i]);
        // }
        this._markers = markers
        this._createClusters();   
        /*边界事件*/
        var _tempcluster = document.querySelectorAll('.clustererContent')
        var thatcluster = [].slice.call(_tempcluster)

        thatcluster.forEach(function(item){
            item.addEventListener("mouseover",mymap.getBoundary)
            item.addEventListener("mouseout",mymap.clearBoundary)
        })
    };

    /**
     * 把一个标记添加到要聚合的标记数组中
     * @param {BMap.Marker} marker 要添加的标记
     *
     * @return 无返回值。
     */
    MarkerClusterer.prototype._pushMarkerTo = function(marker){
        var index = indexOf(marker, this._markers);
        if(index === -1){
            marker.isInCluster = false;
            this._markers.push(marker);//Marker拖放后enableDragging不做变化，忽略
        }
    };

    /**
     * 添加一个聚合的标记。
     * @param {BMap.Marker} marker 要聚合的单个标记。
     * @return 无返回值。
     */
    MarkerClusterer.prototype.addMarker = function(marker) {
        this._pushMarkerTo(marker);
        this._createClusters();
    };

    /**
     * 根据所给定的标记，创建聚合点
     * @return 无返回值
     */
    MarkerClusterer.prototype._createClusters = function(){
        var mapBounds = this._map.getBounds();
        var extendedBounds = getExtendedBounds(this._map, mapBounds, this._gridSize);

        if (this._mymap.statistics.length>0&&this._map.getZoom()<=13){
            this._addStatisticsCluster(this._mymap.statistics);
            return;
        }

        for(var i = 0, marker; marker = this._markers[i]; i++){
            if(!marker.isInCluster && extendedBounds.containsPoint(marker.getPosition()) && marker.city){
                this._addToClosestCluster(marker);
            }
        }   
    };

    /**
    * 根据数据，创建聚合点
    *  @return 无返回值
    */
    MarkerClusterer.prototype._addStatisticsCluster = function(statis){
        //this.clearMarkers();
        var _zoom = this._map.getZoom();
        var that = this

        for(var i = 0;i<statis.length;i++){
            if(_zoom <=7){
                var cluster = new Cluster(that);
                // cluster._clusterMarker.initialize(that._map);

                that._map.addOverlay(cluster._clusterMarker);

                cluster._clusterMarker.setText(cluster._renderText(statis[i].num,statis[i].province));

                (function (_i,_cluster) {
                    that._mymap.getPoint(statis[_i].province,function (cen) {
                        _cluster._clusterMarker.setPosition(cen);

                    })
                })(i,cluster)

                cluster._clusterMarker.onclick = that._mymap.getBoundary;
                that._clusters.push(cluster);

            }else if(_zoom>7&&_zoom<=10){
                for(var j = 0;j<statis[i].cityList.length;j++){

                    var cluster = new Cluster(that);
                    //cluster._clusterMarker.initialize(that._map);

                    that._map.addOverlay(cluster._clusterMarker);

                    cluster._clusterMarker.setText(cluster._renderText(statis[i].cityList[j].num,statis[i].cityList[j].city));

                    (function (_i,_j,_cluster) {
                        that._mymap.getPoint(statis[_i].province+statis[_i].cityList[_j].city,function (cen) {
                            _cluster._clusterMarker.setPosition(cen);

                        })
                    })(i,j,cluster)

                    cluster._clusterMarker.onclick = that._mymap.getBoundary
                    that._clusters.push(cluster);

                }

            }else if(_zoom>10&&_zoom<=13){
                for(var j = 0;j<statis[i].cityList.length;j++){

                    for(var k =0;k<statis[i].cityList[j].countyList.length;k++){
                        var cluster = new Cluster(that);
                        //cluster._clusterMarker.initialize(that._map);

                        that._map.addOverlay(cluster._clusterMarker);

                        cluster._clusterMarker.setText(cluster._renderText(statis[i].cityList[j].countyList[k].num,statis[i].cityList[j].countyList[k].county||statis[i].cityList[j].city+"片区"));

                        (function (_i,_j,_k,_cluster) {
                            that._mymap.getPoint(statis[_i].province+statis[_i].cityList[_j].city+(statis[_i].cityList[_j].countyList[_k].county?statis[_i].cityList[_j].countyList[_k].county:""),function (cen) {
                                _cluster._clusterMarker.setPosition(cen);

                            })
                        })(i,j,k,cluster)

                        cluster._clusterMarker.onclick = that._mymap.getBoundary
                        that._clusters.push(cluster);

                    }

                }
            }
        }
    }

    /**
     * 根据标记的位置，把它添加到最近的聚合中
     * @param {BMap.Marker} marker 要进行聚合的单个标记
     *
     * @return 无返回值。
     */
    MarkerClusterer.prototype._addToClosestCluster = function (marker){
        var distance = 100000;
        var clusterToAddTo = null;
        var position = marker.getPosition();
        var _zoom = this._map.getZoom();
        if (_zoom<=13){
            for(var i = 0, cluster; cluster = this._clusters[i]; i++){
                var center = cluster.getCenter();
                if(center){
                    var d = this._map.getDistance(center, marker.getPosition());
                    if(_zoom<=7){
                        if (d>500000){
                            continue
                        }
                    }else if(_zoom>10&&_zoom<=13){
                        if (d>30000){
                            continue
                        }
                    }else {
                        if (d>distance){
                            continue
                        }
                    }

                    var clusterType = marker.province;
                    if(_zoom>7&&_zoom<=10){
                        clusterType = marker.city;
                    }else if(_zoom>10&&_zoom<=13){
                        if (!marker.area){
                            marker.area = marker.city +"片区"
                        }
                        clusterType = marker.area;
                    }
                    if(clusterType == cluster.areatype){
                        clusterToAddTo = cluster;
                    }else {
                        // if(d < distance || _zoom <= 7){
                        //     distance = d;
                        //     clusterToAddTo = cluster;
                        // }
                    }
                }

            }
        }
    
        if (clusterToAddTo && clusterToAddTo.isMarkerInClusterBounds(marker)){
            clusterToAddTo.addMarker(marker);
        } else {
            var cluster = new Cluster(this);
            cluster.addMarker(marker);
            this._clusters.push(cluster);
        }    
    };

    /**
     * 清除上一次的聚合的结果
     * @return 无返回值。
     */
    MarkerClusterer.prototype._clearLastClusters = function(){
        for(var i = 0, cluster; cluster = this._clusters[i]; i++){            
            cluster.remove();
        }
        this._clusters = [];//置空Cluster数组
        this._removeMarkersFromCluster();//把Marker的cluster标记设为false
    };

    /**
     * 清除某个聚合中的所有标记
     * @return 无返回值
     */
    MarkerClusterer.prototype._removeMarkersFromCluster = function(){
        for(var i = 0, marker; marker = this._markers[i]; i++){
            marker.isInCluster = false;
        }
    };
   
    /**
     * 把所有的标记从地图上清除
     * @return 无返回值
     */
    MarkerClusterer.prototype._removeMarkersFromMap = function(){
        for(var i = 0, marker; marker = this._markers[i]; i++){
            marker.isInCluster = false;
            this._map.removeOverlay(marker);       
        }
    };

    /**
     * 删除单个标记
     * @param {BMap.Marker} marker 需要被删除的marker
     *
     * @return {Boolean} 删除成功返回true，否则返回false
     */
    MarkerClusterer.prototype._removeMarker = function(marker) {
        var index = indexOf(marker, this._markers);
        if (index === -1) {
            return false;
        }
        this._map.removeOverlay(marker);
        this._markers.splice(index, 1);
        return true;
    };

    /**
     * 删除单个标记
     * @param {BMap.Marker} marker 需要被删除的marker
     *
     * @return {Boolean} 删除成功返回true，否则返回false
     */
    MarkerClusterer.prototype.removeMarker = function(marker) {
        var success = this._removeMarker(marker);
        if (success) {
            this._clearLastClusters();
            this._createClusters();
        }
        return success;
    };
    
    /**
     * 删除一组标记
     * @param {Array<BMap.Marker>} markers 需要被删除的marker数组
     *
     * @return {Boolean} 删除成功返回true，否则返回false
     */
    MarkerClusterer.prototype.removeMarkers = function(markers) {
        var success = false;
        for (var i = 0; i < markers.length; i++) {
            var r = this._removeMarker(markers[i]);
            success = success || r; 
        }

        if (success) {
            this._clearLastClusters();
            this._createClusters();
        }
        return success;
    };

    /**
     * 从地图上彻底清除所有的标记
     * @return 无返回值
     */
    MarkerClusterer.prototype.clearMarkers = function() {
        this._clearLastClusters();
        this._removeMarkersFromMap();
        this._markers = [];
    };

    /**
     * 重新生成，比如改变了属性等
     * @return 无返回值
     */
    MarkerClusterer.prototype._redraw = function () {
        this._clearLastClusters();
        this._createClusters();
        /*边界事件*/
        var _tempcluster = document.querySelectorAll('.clustererContent')
        var thatcluster = [].slice.call(_tempcluster)
  
        thatcluster.forEach(function(item){
            item.addEventListener("mouseover",mymap.getBoundary)
            item.addEventListener("mouseout",mymap.clearBoundary)
        })

        /**/
        this._mymap.hideloading()
        this._mymap.inMaps()
    };

    /**
     * 获取网格大小
     * @return {Number} 网格大小
     */
    MarkerClusterer.prototype.getGridSize = function() {
        return this._gridSize;
    };

    /**
     * 设置网格大小
     * @param {Number} size 网格大小
     * @return 无返回值
     */
    MarkerClusterer.prototype.setGridSize = function(size) {
        this._gridSize = size;
        this._redraw();
    };

    /**
     * 获取聚合的最大缩放级别。
     * @return {Number} 聚合的最大缩放级别。
     */
    MarkerClusterer.prototype.getMaxZoom = function() {
        return this._maxZoom;       
    };

    /**
     * 设置聚合的最大缩放级别
     * @param {Number} maxZoom 聚合的最大缩放级别
     * @return 无返回值
     */
    MarkerClusterer.prototype.setMaxZoom = function(maxZoom) {
        this._maxZoom = maxZoom;
        this._redraw();
    };

    /**
     * 获取聚合的样式风格集合
     * @return {Array<IconStyle>} 聚合的样式风格集合
     */
    MarkerClusterer.prototype.getStyles = function() {
        return this._styles;
    };

    /**
     * 设置聚合的样式风格集合
     * @param {Array<IconStyle>} styles 样式风格数组
     * @return 无返回值
     */
    MarkerClusterer.prototype.setStyles = function(styles) {
        this._styles = styles;
        this._redraw();
    };

    /**
     * 获取单个聚合的最小数量。
     * @return {Number} 单个聚合的最小数量。
     */
    MarkerClusterer.prototype.getMinClusterSize = function() {
        return this._minClusterSize;
    };

    /**
     * 设置单个聚合的最小数量。
     * @param {Number} size 单个聚合的最小数量。
     * @return 无返回值。
     */
    MarkerClusterer.prototype.setMinClusterSize = function(size) {
        this._minClusterSize = size;
        this._redraw();
    };

    /**
     * 获取单个聚合的落脚点是否是聚合内所有标记的平均中心。
     * @return {Boolean} true或false。
     */
    MarkerClusterer.prototype.isAverageCenter = function() {
        return this._isAverageCenter;
    };

    /**
     * 获取聚合的Map实例。
     * @return {Map} Map的示例。
     */
    MarkerClusterer.prototype.getMap = function() {
      return this._map;
    };

    /**
     * 获取所有的标记数组。
     * @return {Array<Marker>} 标记数组。
     */
    MarkerClusterer.prototype.getMarkers = function() {
        return this._markers;
    };

    /**
     * 获取聚合的总数量。
     * @return {Number} 聚合的总数量。
     */
    MarkerClusterer.prototype.getClustersCount = function() {
        var count = 0;
		for(var i = 0, cluster; cluster = this._clusters[i]; i++){
            cluster.isReal() && count++;     
        }
		return count;
    };

    /**
     * @ignore
     * Cluster
     * @class 表示一个聚合对象，该聚合，包含有N个标记，这N个标记组成的范围，并有予以显示在Map上的TextIconOverlay等。
     * @constructor
     * @param {MarkerClusterer} markerClusterer 一个标记聚合器示例。
     */
    function Cluster(markerClusterer){
        this._markerClusterer = markerClusterer;
        this._map = markerClusterer.getMap();
        this._minClusterSize = markerClusterer.getMinClusterSize();
        this._isAverageCenter = markerClusterer.isAverageCenter();
        this._center = null;//落脚位置
        this._markers = [];//这个Cluster中所包含的markers
        /*更改样式*/
        this._styles = markerClusterer.getStyles();
        this._labels = [];
        this._gridBounds = null;//以中心点为准，向四边扩大gridSize个像素的范围，也即网格范围
		this._isReal = false; //真的是个聚合

        this._clusterMarker = new BMapLib.TextIconOverlay(this._center, this._markers.length, {"styles":this._markerClusterer.getStyles()},this._markers);
        //this._map.addOverlay(this._clusterMarker);
        
        
    }
   
    /**
     * 向该聚合添加一个标记。
     * @param {Marker} marker 要添加的标记。
     * @return 无返回值。
     */
    Cluster.prototype.addMarker = function(marker){
        if(this.isMarkerInCluster(marker)){
            return false;
        }//也可用marker.isInCluster判断,外面判断OK，这里基本不会命中
    
        if (!this._center){
            this._center = marker.getPosition();
            this.updateGridBounds();//
        } else {
            if(this._isAverageCenter){
                var l = this._markers.length + 1;
                var lat = (this._center.lat * (l - 1) + marker.getPosition().lat) / l;
                var lng = (this._center.lng * (l - 1) + marker.getPosition().lng) / l;
                this._center = new BMap.Point(lng, lat);
                this.updateGridBounds();
            }//计算新的Center
        }
    
        marker.isInCluster = true;
        this._markers.push(marker);
    
        var len = this._markers.length;
        if(len < this._minClusterSize ){     
            this._map.addOverlay(marker);
			//this.updateClusterMarker();
            return true;
        } else if (len === this._minClusterSize) {
            for (var i = 0; i < len; i++) {
                this._markers[i].getMap() && this._map.removeOverlay(this._markers[i]);
            }
			
        } 
        this._map.addOverlay(this._clusterMarker);
		this._isReal = true;
        this.updateClusterMarker();
        return true;
    };

    /**
     * 判断一个标记是否在该聚合中。
     * @param {Marker} marker 要判断的标记。
     * @return {Boolean} true或false。
     */
    Cluster.prototype.isMarkerInCluster= function(marker){
        if (this._markers.indexOf) {
            return this._markers.indexOf(marker) != -1;
        } else {
            for (var i = 0, m; m = this._markers[i]; i++) {
                if (m === marker) {
                    return true;
                }
            }
        }
        return false;
    };

    /**
     * 判断一个标记是否在该聚合网格范围中。
     * @param {Marker} marker 要判断的标记。
     * @return {Boolean} true或false。
     */
    Cluster.prototype.isMarkerInClusterBounds = function(marker) {
        return this._gridBounds.containsPoint(marker.getPosition());
    };
	
	Cluster.prototype.isReal = function(marker) {
        return this._isReal;
    };

    /**
     * 更新该聚合的网格范围。
     * @return 无返回值。
     */
    Cluster.prototype.updateGridBounds = function() {
        //var bounds = new BMap.Bounds(this._center, this._center);
        var bounds = this._map.getBounds();
        this._gridBounds = getExtendedBounds(this._map, bounds, this._markerClusterer.getGridSize());
    };

    /**
     * 对于单个点添加label
     */
    Cluster.prototype.addLabel = function (marker) {
        //获取marker的坐标
        var position = marker.getPosition();
        //创建label
        var label = new BMap.Label({position : position});
        label.setStyle({
            height : '25px',
            lineHeight : '25px',
            color : "#fff",
            border : '1px solid #2f72bc',
            borderRadius : "0px",
            opacity: '0.8',
            fontWeight : 'normal',
        });
        var _icons = "other";
        switch(this._markerClusterer._mymap.currentType)
        {
            case 'KJRC':
                _icons = "person"
                break;
            case 'KJCG':
                _icons = "KJCG"
                break;
            case 'FWJG':
                _icons = "FWJG"
                break;
            case 'YQSB':
                _icons = "YQSB"
                break;
            case 'KJQY':
                _icons = "KJQY"
                break;
            case 'KYYS':
                _icons = "KYYS"
                break;
            case 'CYDS':
                _icons = "CYDS"
                break;
            case 'CXPT':
                _icons = "CXPT"
                break;
            case 'dzyx':
                _icons = "DZYX"
                break;

        }
        var content = '<span id="label-'+marker.id+'" labelid="'+marker.id+'" class="labelicon '+_icons+'"></span>'+'<span class="labelname">'+marker.person+'</span>';
        label.setContent(content)
        label.setPosition(position);
        label.itype = "single"
        label.iid = marker.id
        this._labels.push(label);
        this._map.addOverlay(label);
    }

    /**
     * 更新该聚合的显示样式，也即TextIconOverlay。
     * @return 无返回值。
     */
    Cluster.prototype.updateClusterMarker = function () {
        if (this._map.getZoom() > this._markerClusterer.getMaxZoom()) {
            this._clusterMarker && this._map.removeOverlay(this._clusterMarker);
            for (var i = 0, marker; marker = this._markers[i]; i++) {
                 //this._map.addOverlay(marker);
                this.addLabel(marker);
            }
            return;
        }

        if (this._markers.length < this._minClusterSize) {
            this._clusterMarker.hide();
            return;
        }

        this._clusterMarker.setPosition(this._center);
        
        /*计算当前显示所属*/
        var zoom = this._map.getZoom()
        var _belongText = ""
        if (zoom<=7) {
            _belongText = this._markers[0].province
        }else if(zoom>7&&zoom<=10){
            _belongText = this._markers[0].city    
        }else if (zoom>10&&zoom<=13) {
            for (var i=0;i<this._markers.length;i++){
                if(this._markers[i].area) {
                    _belongText = this._markers[i].area
                    break;
                }
            }
            if (!_belongText){
                _belongText = this._markers[0].city +"片区"
            }
        }
        this.areatype =_belongText
        this._clusterMarker.boundaryText = _belongText
        this._clusterMarker.setText(this._renderText(this._markers,_belongText));

        var thatMap = this._map;
        var thatBounds = this.getBounds();
        var center = this._center;

        //this._clusterMarker.addEventListener("click", mymap.getBoundary);
        this._clusterMarker.onclick = mymap.getBoundary
        //this._clusterMarker.addEventListener("mouseover",getBoundary)

    };

    /*自定义聚合文字显示*/
    Cluster.prototype._renderText = function(text,_belongtexts) {
        text = (typeof text == "number")?text:text.length
        var _text = "人才"
        switch(this._markerClusterer._mymap.currentType)
        {
            case 'KJRC':
                _text = "人才"
                break;
            case 'KJCG':
                _text = "成果"
                break;
            case 'FWJG':
                _text = "机构"
                break;
            case 'YQSB':
                _text = "设备"
                break;
            case 'KJQY':
                _text = "企业"
                break;
            case 'KYYS':
                _text = "机构"
                break;
            case 'CYDS':
                _text = "导师"
                break;
            case 'CXPT':
                _text = "平台"
                break;
            case 'dzyx':
                _text = "高校"
                break;

        }
        return '<p>'+_belongtexts+'</p><p>'+text+'个'+_text+'</p>'
    }

    /**
     * 删除该聚合。
     * @return 无返回值。
     */
    Cluster.prototype.remove = function(){
        for (var i = 0, m; m = this._labels[i]; i++) {
             this._map.removeOverlay(this._labels[i]);
        }//清除散的标记点
        this._map.removeOverlay(this._clusterMarker);
        this._markers.length = 0;
        delete this._markers;
    }

    /**
     * 获取该聚合所包含的所有标记的最小外接矩形的范围。
     * @return {BMap.Bounds} 计算出的范围。
     */
    Cluster.prototype.getBounds = function() {
        var bounds = new BMap.Bounds(this._center,this._center);
        for (var i = 0, marker; marker = this._markers[i]; i++) {
            bounds.extend(marker.getPosition());
        }
        return bounds;
    };

    /**
     * 获取该聚合的落脚点。
     * @return {BMap.Point} 该聚合的落脚点。
     */
    Cluster.prototype.getCenter = function() {
        return this._center;
    };

})();
