    var myMap = function(addrlist){
        this.map = new BMap.Map("allmap");
        this.markerClusterer = {}
        /*设置默认显示河南9级*/
        this.map.centerAndZoom(new BMap.Point(113.670847,34.78713), 7);
        this.map.enableScrollWheelZoom();

        this.map.setMinZoom(6)
        /*地址解析*/
        this.myGeo = new BMap.Geocoder();

        this.currentType = "KJRC"

        this.markers = []  // 地图标
        this.statistics = [] // 2.0版 数据返回包含统计

        /*工具栏全局变量*/
        this.pt = null
        this.addrs = addrlist
        this.load = document.querySelector("#mapLoading")
    }

    myMap.prototype.init = function(){
        var that = this
        that.makeMaker()
        //最简单的用法，生成一个marker数组，然后调用markerClusterer类即可。
        that.markerClusterer = new BMapLib.MarkerClusterer(that.map, {markers:that.markers,maxZoom:13,girdSize : 200,
            styles : [{
                size: new BMap.Size(92, 92),
                backgroundColor : '#2d89f0',
                textColor:'#FFFFFF'
            }]},that);

    }

    myMap.prototype.makeMaker = function(){
        var that = this
        var i = 0;
        if(that.addrs.length == 0){
            return;
        }
        for (; i < that.addrs.length; i++) {
            pt = new BMap.Point( that.addrs[i].lng, that.addrs[i].lat);

            var marker = new BMap.Marker(pt)

            marker.province = that.addrs[i].mapProvince
            marker.city = that.addrs[i].mapCity
            marker.area = that.addrs[i].mapDistrict
            marker.id = that.addrs[i].id

            marker.person = that.addrs[i].userName || that.addrs[i].projectName || that.addrs[i].resourceName || that.addrs[i].innovateName || that.addrs[i].name

            that.markers.push(marker);

        }
    }


    myMap.prototype.rerender = function(addr,sta){
        this.markerClusterer.removeMarkers(this.markerClusterer._markers.concat())
        this.markerClusterer._clearLastClusters()

        this.addrs = addr
        this.markers = []
        this.makeMaker()
        this.statistics = sta || []
        this.markerClusterer.addMarkers(this.markers)
        //this.map.reset()
        this.hideloading()
        this.inMaps()
    }

    /*以地址换取坐标*/
    myMap.prototype.getPoint = function(addr,back){
        this.myGeo.getPoint(addr, function(point){
            if (point) {
                back(point)
            }else{
                console.log("您选择地址没有解析到结果!");
            }
        }, "河南省");
    }

    /*边界与点击事件*/
    myMap.prototype.getBoundary = function(e){
        var that = this;
        if (e.type=="onclick") {
            mymap.map.clearOverlays();
            var zoom = mymap.map.getZoom()
            if (zoom<9){
                mymap.map.setZoom(9)
            }else if (zoom>=9&&zoom < 13) {
                mymap.map.setZoom(13)
            }else if(zoom>=13&&zoom<14){
                mymap.map.setZoom(15)
            }
            //e.point.lat = e.point.lat-0.05
            mymap.map.setCenter(e.currentTarget._position);
            /*展示搜索框*/
            //mymap.isloading()
        }else{
            var bdary = new BMap.Boundary();
            var text;
            if (e.target.children.length>0) {
                text = e.target.children[0].innerText;
            }else{
                text = e.target.innerText;
                if (/人才/g.test(text)) {
                    return
                }
            }
            mymap.renderBoundary(bdary,text)
        }
    }

    myMap.prototype.renderBoundary = function(bdary,boundaryText){
        var that = this;
        bdary.get(boundaryText, function(rs){       //获取行政区域
            // 清除边界
            //that.map.clearOverlays();
            that.clearBoundary()
            var count = rs.boundaries.length; //行政区域的点有多少个
            if (count === 0) {
                console.log('未能获取当前输入行政区域');
                //that.markerClusterer._redraw()
                return ;
            }
            var pointArray = [];
            for (var i = 0; i < count; i++) {
                var ply = new BMap.Polygon(rs.boundaries[i], {strokeWeight: 2,fillColor:"#2d89f0", strokeColor: "#4783E7",fillOpacity: 0.2}); //建立多边形覆盖物
                that.map.addOverlay(ply);  //添加覆盖物
                pointArray = pointArray.concat(ply.getPath());
            }
            //that.markerClusterer._redraw()
            //that.map.setViewport(pointArray);    //调整视野
        });
    }

    myMap.prototype.clearBoundary = function(){
        var svgs = document.querySelector("svg")
        if (svgs) {
            svgs.innerHTML = ""
        }
        // that.map.clearOverlays();
        //this.markerClusterer._redraw()
    }

    myMap.prototype.setAreaZoom = function(area,level,pt){
        var that = this
        var _zoom = 8
        if (level==1){
            _zoom = 10
        }else if(level==2){
            _zoom = 13
        }else if(level==0){
            _zoom = 9
        }else if(level == 3){
            _zoom = 14
        }
        if(pt){
            //that.map.setMinZoom(_zoom-2);
            that.map.setZoom(_zoom);
            that.map.setCenter(pt);
            return;
        }else {
            that.myGeo.getPoint(area, function (point) {
                that.map.setMinZoom(_zoom - 2)
                that.map.setZoom(_zoom)
                if (point) {
                    that.map.setCenter(point)
                } else {
                    console.log("您选择地址没有解析到结果!");
                }
            }, "河南省");
        }
    }

    myMap.prototype.inMaps = function () {
        var _overlays = this.map.getOverlays();
        var inmaps = []
        
        for(var i = 0;i<_overlays.length;i++){
            if (_overlays[i]._markers){
                for (var j = 0;j<_overlays[i]._markers.length;j++){
                    inmaps.push(_overlays[i]._markers[j].id)
                }
            }
            if (_overlays[i].itype == "single"){
                if (inmaps.indexOf(_overlays[i].iid) == -1) {
                    inmaps.push(_overlays[i].iid)
                }
            }
        }
        /*抛出当前地图显示id*/
        console.log(inmaps)

    }


    myMap.prototype.hideloading = function () {
        this.clearBoundary()
    }





