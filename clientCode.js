//Include valid tokens for routers, if required.
//Also, adjust the callback
//Adjust all DoNotPush

var map,RoutingControl;
var rlPath,rawPath,guidepointPath;
var allPoints;
var currentWaypoints=[];
var doRemoval = false;
var doAdd = false;
var directionMarkers = [];
var homeMarker;
const { protocol, hostname, port } = window.location;
const urlParams = new URLSearchParams(window.location.search);
var accessToken = null;
var oauthToken = null;
var hasRouteLink = false;
var theConfiguration = {};

async function initMap()
{
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (urlParams.has("routeLink")) hasRouteLink = true;

    if (!hasRouteLink){
	//var announcementURL = `${protocol}//${hostname}:${port}/announcement.html`;
	//window.open(announcementURL,"A RouteLoops Announcement",`height=${height*0.95},width=${width*0.60},left=300,menubar=no,location=no,status=no,titlebar=no,top=100`);
	var url = `${protocol}//${hostname}:${port}/readFile?fileName=announcement.html`;
	var theResp = await fetch(url);
	var theJson = await theResp.json();    
	var theHTML = theJson.contents;
	document.getElementById("innerAnnounce").innerHTML = theHTML;
	document.getElementById("announceDiv").style.height = `${height*0.95}px`;
	document.getElementById("announceDiv").style.width = `${width*0.60}px`;
	document.getElementById("announceDiv").style.left = `${300}px`;
	document.getElementById("announceDiv").style.top = `${50}px`;
    }
    else{
	closeAnnounce();
    }
	
    map = L.map('map').setView([42.3, -71.3], 8);

    map.on('click', function(event) {
	//alert(event.latlng);
	var lat = event.latlng.lat;
	var lng = event.latlng.lng;
	if (doRemoval) doRemoveWaypoint(lat,lng);	
	if (doAdd) doAddWaypoint(lat,lng);
    });    
    
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 18,
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    var theMode       = document.getElementById("inputMode").value;
    const theRouter = "MapBox";
    var routerToUse = null;
    if (theRouter=="OSM") routerToUse = new L.Routing.OSRMv1({"profile": `${theMode}`});
    if (theRouter=="MapBox"){
	var theToken = 'A valid token';
	var theProfile = "cycling";
	if (theMode.indexOf("driving")>=0) theProfile = "driving";
	if (theMode.indexOf("cycling")>=0) theProfile = "cycling";
	if (theMode.indexOf("walking")>=0) theProfile = "walking";
	if (theMode.indexOf("foot")>=0) theProfile = "walking";
	//Change this to use the input from the query string
	if (urlParams.has("mode")) {
	    var mode = urlParams.get("mode");
	    if (mode.indexOf("driv")>=0) theProfile = "driving";
	    if (mode.indexOf("car")>=0)  theProfile = "driving";
	    if (mode.indexOf("cycl")>=0) theProfile = "cycling";
	    if (mode.indexOf("bik")>=0)  theProfile = "cycling";
	    if (mode.indexOf("walk")>=0) theProfile = "walking";
	    if (mode.indexOf("foot")>=0) theProfile = "walking";
	    if (theProfile=="driving") document.getElementById("inputMode").value="driving-car";
	    if (theProfile=="cycling") document.getElementById("inputMode").value="cycling-road";
	    if (theProfile=="walking") document.getElementById("inputMode").value="foot-walking";
	}
	routerToUse = new L.Routing.mapbox(theToken,{profile:`mapbox/${theProfile}`});
    }
    RoutingControl = L.Routing.control({
	waypoints:[],
	lineOptions: {styles: [{color: 'red', opacity: 1, weight: 3}]},
	/*
	createMarker: function(i, waypoint, n) {
	    const marker = L.marker(waypoint.latLng, {
		draggable: true,
		bounceOnAdd: false,
		bounceOnAddOptions: {
                    duration: 1000,
                    height: 800,
                    function() {
			(bindPopup(myPopup).openOn(map))
                    }
		},
		icon: L.icon({
		    iconUrl: './images/Home.png'	
		})
	    })
	    return marker;
	    },
	*/
	router: routerToUse
    }).addTo(map);
    
    RoutingControl.on("routesfound", async (response) => {
	var theResponse = response;
	allPoints = [];
	for (const point of theResponse.routes[0].coordinates) allPoints.push({lat:point.lat,lng:point.lng});
	for (const item of  theResponse.routes[0].instructions) allPoints[item.index].instructions = item.text;
	//Based on the drag action, find the current set of waypoints.
	var newWaypoints = [];
	for (var i=1;i<theResponse.waypoints.length-1;i++){
	    var thisWaypoint = theResponse.waypoints[i];
	    newWaypoints.push({lat:thisWaypoint.latLng.lat, lng:thisWaypoint.latLng.lng});
	}
	currentWaypoints.length=0;
	for (const waypoint of newWaypoints) currentWaypoints.push(waypoint);
	var ApiHeaders =  {'Accept': 'application/json','Content-Type': 'application/json'};	    
	var data = {allPoints:allPoints};
	var url = `${protocol}//${hostname}:${port}/modifyDirections`;
	var theResp = await fetch(url,{method:'POST',body:JSON.stringify(data),headers:ApiHeaders});
	var theJson = await theResp.json();
	distDisplay = theJson.totalDistanceKm;
	allPoints.length = 0;
	for (const point of theJson.modifiedAllPoints) allPoints.push(point);
	var units = document.getElementById("inputUnits").value;
	if (units=="imperial") distDisplay = distDisplay*1000*100/2.54/12/5280;
	document.getElementById("outDist").innerHTML = distDisplay.toFixed(1);
	try{map.removeLayer(rlPath);}catch(err){}
	//Set markers at the locations where you have directions.
	for (const marker of directionMarkers) marker.map = null;
	directionMarkers.length=0;
	var countInstructions = 0;
	for (const point of allPoints){
	    if (point.hasOwnProperty("instructions")){
		countInstructions += 1;
		point.count = countInstructions;
		var useInstruction = `${countInstructions}: ${point.instructions}`;
		var marker = new L.Marker([point.lat, point.lng],{title:useInstruction});
		marker.addTo(map);
		directionMarkers.push(marker);
	    }
	}
	showDirectionMarkers();	
    });

    if (hasRouteLink){
	useRouteLink();
    }

    return;
}
//--------------------------------------
function changeMode(){
    var theMode = document.getElementById('inputMode').value;
    const currentUrl = window.location.href;
    var split = currentUrl.split("?");
    var url = split[0];
    url += `?mode=${theMode}`;
    window.open(url,"_self")
    return;
}
//--------------------------------------
function displayMarker(index){
    if (index<directionMarkers.length){
	var marker = directionMarkers[index];
	marker.addTo(map);
	index+=1;
	if (index<directionMarkers.length) setTimeout( ()=> {displayMarker(index)},200);
    }
    return;
}
//.......................................
function showDirectionMarkers(){
    if (document.getElementById("directionMarkers").checked){
	//for (const marker of directionMarkers) marker.addTo(map);
	displayMarker(0);
    }
    else{
	for (const marker of directionMarkers) map.removeLayer(marker);
    }
    return;
}

//.......................................
function lockRoute(){
    if (document.getElementById("lockRoute").checked){
	RoutingControl["_line"].options.addWaypoints = false;
	RoutingControl["_line"].options.extendToWaypoints = false;
    }
    else{
	RoutingControl["_line"].options.addWaypoints = true;
	RoutingControl["_line"].options.extendToWaypoints = true;
    }
    return;
}
//.........................................
async function setAsHome()
{
    try{homeMarker.remove();}catch(err){}
    
    //Find the starting point of the RouteLoop
    var theLocation = document.getElementById("inputLocation").value;
    var areCoords = false;
    try{
	var items = theLocation.split(",");
	if (items[0].toLowerCase().indexOf("s")>=0) items[0] = ("-" + items[0]).replaceAll(" ","");
	if (items[1].toLowerCase().indexOf("w")>=0) items[1] = ("-" + items[1]).replaceAll(" ","");
	var lat = parseFloat(items[0]);
	var lng = parseFloat(items[1]);
	if (items.length==2 && !isNaN(items[0]) && !isNaN(items[1])) areCoords = true
	var theLatLng = {lat:lat,lng:lng};
    }
    catch(err){}

    if (!areCoords){
	var encoded = encodeURI(theLocation);

	//Geocode this starting location in to a Lat/Lng pair.
	var url = `${protocol}//${hostname}:${port}/geocode?location=${encoded}`;
	var theResp = await fetch(url);
	var theJson = await theResp.json();    
	var theLatLng = {lat:theJson.features[0].geometry.coordinates[1],lng:theJson.features[0].geometry.coordinates[0]};
    }

    //Center the map on this location.
    if (typeof waypointsIn == "undefined")
	map.setView(new L.LatLng(theLatLng.lat,theLatLng.lng),18);

    //Put a house marker at the start/end point.
    var homeIcon = L.icon({
	iconUrl: './images/Home.png'	
    });

    homeMarker = L.marker([theLatLng.lat, theLatLng.lng], {icon: homeIcon,draggable:true,title:theLocation}).addTo(map);
    homeMarker.on("dragend", function(e) {
	var position = homeMarker.getLatLng();
	document.getElementById("inputLocation").value = `${position.lat},${position.lng}`;
	map.setView(position,18);
    });
    return {theLocation,theLatLng};
}
//........................................................................................
async function doRL(waypointsIn)
{

    //Clear any paths on the map if there are any.
    try{map.removeLayer(rlPath);}catch(err){}
    try{map.removeLayer(rawPath);}catch(err){}
    try{map.removeLayer(guidepointPath);}catch(err){}
    try{homeMarker.remove();}catch(err){}

    var {theLocation,theLatLng} = await setAsHome();
    /*
    //Find the starting point of the RouteLoop
    var theLocation = document.getElementById("inputLocation").value;
    var encoded = encodeURI(theLocation);

    //Geocode this starting location in to a Lat/Lng pair.
    var url = `${protocol}//${hostname}:${port}/geocode?location=${encoded}`;
    var theResp = await fetch(url);
    var theJson = await theResp.json();    
    var theLatLng = {lat:theJson.features[0].geometry.coordinates[1],lng:theJson.features[0].geometry.coordinates[0]};

    //Center the map on this location.
    if (typeof waypointsIn == "undefined")
	map.setView(new L.LatLng(theLatLng.lat,theLatLng.lng),18);

    //Put a house marker at the start/end point.
    var homeIcon = L.icon({
	iconUrl: './images/Home.png'	
	});

    homeMarker = L.marker([theLatLng.lat, theLatLng.lng], {icon: homeIcon,draggable:true,title:theLocation}).addTo(map);    
    */

    var initialWaypoints = [];
    if (typeof waypointsIn == "undefined"){    
	//Generate points for the route.  These are the guide points generated by some method.
	var theDistance = document.getElementById("inputDist").value;
	var theUnits    = document.getElementById("inputUnits").value;
	var theRotation  = document.getElementById("inputRotation").value;
	var theDirection= document.getElementById("inputDirection").value;    
	var url = `${protocol}//${hostname}:${port}/getRLpoints?lat=${theLatLng.lat}&lng=${theLatLng.lng}`;
	url += `&dist=${theDistance}&units=${theUnits}&rotation=${theRotation}&direction=${theDirection}`;
	var theMethod= document.getElementById("method").value;    
	url += `&method=${theMethod}`;
	var theResp = await fetch(url);
	var theJson = await theResp.json();
	var initialWaypoints = JSON.parse(JSON.stringify(theJson));    
    }
    else{
	initialWaypoints = waypointsIn; 
    }
    //Add the starting location as both the first, and the last, guide point.
    var guidePoints = [];
    guidePoints.push(new L.LatLng(theLatLng.lat,theLatLng.lng));
    for (const waypoint of initialWaypoints) guidePoints.push(new L.LatLng(waypoint.lat,waypoint.lng));
    guidePoints.push(new L.LatLng(theLatLng.lat,theLatLng.lng));
    
    //Draw these guide points on the map.

    guidepointPath = new L.Polyline(guidePoints, {color:'blue',weight:2,opacity: 1.0,smoothFactor: 1});
    guidepointPath.addTo(map);    

    //Get a bounding box used to zoom the map to a more reasonable size.
    const RLBounds = guidepointPath.getBounds();
    if (typeof waypointsIn == "undefined")
	map.fitBounds(RLBounds);

    //Call the directions service using the guide point as waypoints.
    var theMode       = document.getElementById("inputMode").value;
    var inputHighways = document.getElementById("inputHighways").value;    
    var inputFerries  = document.getElementById("inputFerries").value;    
    var fitnessLevel  = document.getElementById("fitnessLevel").value;    
    var greenFactor   = document.getElementById("greenFactor").value;    
    var quietFactor   = document.getElementById("quietFactor").value;    
    var url = `${protocol}//${hostname}:${port}/directions?lat=${theLatLng.lat}&lng=${theLatLng.lng}`;
    url += `&mode=${theMode}&highways=${inputHighways}&ferries=${inputFerries}`;
    url += `&fitnessLevel=${fitnessLevel}&greenFactor=${greenFactor}&quietFactor=${quietFactor}`;    
    var waypointText= "";
    for (const waypoint of initialWaypoints) waypointText += `${waypoint.lat},${waypoint.lng}|`;
    waypointText = waypointText.slice(0,-1);
    url += `&waypoints=${waypointText}`;
    var theResp = await fetch(url);
    var theJson = await theResp.json();

    if (theJson.hasOwnProperty("error")){
	alert(`The routing server has returned an error.  Try again with a slightly shorter route.  The error returned was "${theJson.error}"`);
	try{map.removeLayer(rlPath);}catch(err){}
	try{map.removeLayer(rawPath);}catch(err){}
	try{map.removeLayer(guidepointPath);}catch(err){}
	try{homeMarker.remove();}catch(err){}
	for (const marker of directionMarkers) map.removeLayer(marker);
	return;
    }
    else{
	allPoints = theJson.features[0].allPoints;
	
	//Draw the raw result on the map.  This has not yet been cleaned up by RouteLoops.
	var rawPoints = [];
	for (const point of allPoints) rawPoints.push(new L.LatLng(point.lat,point.lng));
	rawPath = new L.Polyline(rawPoints,{color:'green',weight:2,opacity:1.0,smoothFactor:1});
	rawPath.addTo(map);
	
	var cleanTailsJson = {cleanedUp:0,distKm:allPoints[allPoints.length-1].cumulativeDistanceKm,newPath:allPoints};

	//Call a cleaning function until the result stabilizes
	var ApiHeaders =  {'Accept': 'application/json','Content-Type': 'application/json'};
	var keepGoing = true;
	if (hasRouteLink) {
	    keepGoing = false;
	    hasRouteLink = false; //Reset this so that from now on it will perform the route cleaning
	}
	var countCalcs = 0;
	var waypoints = [];
	for (const waypoint of initialWaypoints) waypoints.push(waypoint);
	lastCounts = {cleaned:-1,total:-1};
	while (keepGoing){
	    countCalcs += 1;

	    //Take allPoints and clean up the path.
	    var data = {LLs:allPoints};
	    var url = `${protocol}//${hostname}:${port}/cleanTails`;
	    var theResp = await fetch(url,{method:'POST',body:JSON.stringify(data),headers:ApiHeaders});
	    var cleanTailsJson = await theResp.json();

	    if (cleanTailsJson.cleanedUp > 0){ //You modified the path, so redo the whole thing with this modified path.
		//Generate the new set of allPoints.
		allPoints.length = 0;
		for (const point of cleanTailsJson.newPath) allPoints.push(point);

		//Based on the new allPoints, find the current set of waypoints.  Choose the closest points to the previous waypoints.
		newWaypoints = [];
		for (const waypoint of waypoints){
		    var closest = null;
		    for (const point of allPoints){
			var separation = Math.pow((waypoint.lat-point.lat),2) + Math.pow((waypoint.lng-point.lng),2)
			if (closest==null) closest = {point:point,separation:separation};
			if (separation < closest.separation) closest = {point:point,separation:separation};
		    }
		    newWaypoints.push(closest.point);
		}
		waypoints.length=0;
		for (const waypoint of newWaypoints) waypoints.push(waypoint);

		//Generate a new path based on this new set of waypoints.
		var url = `${protocol}//${hostname}:${port}/directions?lat=${theLatLng.lat}&lng=${theLatLng.lng}`;
		url += `&mode=${theMode}&highways=${inputHighways}&ferries=${inputFerries}`;
		url += `&fitnessLevel=${fitnessLevel}&greenFactor=${greenFactor}&quietFactor=${quietFactor}`;
		var waypointText= "";
		for (const waypoint of waypoints) waypointText += `${waypoint.lat},${waypoint.lng}|`;
		waypointText = waypointText.slice(0,-1);
		url += `&waypoints=${waypointText}`;
		var theResp = await fetch(url);
		var directionsJson = await theResp.json();
		allPoints = directionsJson.features[0].allPoints;	    
	    }
	    
	    else{ //No change, so that's it.
		keepGoing = false;
	    }
	    
	    if (cleanTailsJson.cleanedUp==lastCounts.cleaned && allPoints.length==lastCounts.total){ //The modifications are not changing, so stop
		keepGoing = false;
	    }
	    else{
		lastCounts = {cleaned:cleanTailsJson.cleanedUp,total:allPoints.length};
	    }

	}

	
	var distDisplay = cleanTailsJson.distKm;
	var units = document.getElementById("inputUnits").value;
	if (units=="imperial") distDisplay = distDisplay*1000*100/2.54/12/5280;
	document.getElementById("outDist").innerHTML = distDisplay.toFixed(1);
	document.getElementById('calcs').innerHTML = countCalcs;    

        
	//Draw the cleaned result on the map.
	var rlPoints = [];
	for (const point of allPoints) rlPoints.push(new L.LatLng(point.lat,point.lng));
	rlPath = new L.Polyline(rlPoints,{color:'red',weight:3,opacity:1.0,smoothFactor:1});
	rlPath.addTo(map);

	//Remove the other lines if that's desired.
	//var yes = confirm("Remove other lines?");
	var yes = true;
	if (yes){
	    map.removeLayer(rawPath);
	    map.removeLayer(guidepointPath);
	}

	currentWaypoints = JSON.parse(JSON.stringify(waypoints));    

	//This is a special section for OSM, to enable draggable routes.
	var wpts = [];
	wpts.push(new L.LatLng(theLatLng.lat,theLatLng.lng))    
	for (const waypoint of waypoints)wpts.push(new L.LatLng(waypoint.lat,waypoint.lng))    
	wpts.push(new L.LatLng(theLatLng.lat,theLatLng.lng))    
	RoutingControl.setWaypoints(wpts);
        
	return;
    }
}

//......................................................................................................
async function generateOutput()
{
    var theType = document.getElementById("createOutput").value;
    if (theType=="none") return;

    var routeName = document.getElementById("routeName").value.trim();
    var units = document.getElementById("inputUnits").value;
    var mode = document.getElementById("inputMode").value;
    var advanceUnits = "meters";
    var pace = "kph";
    var paceDefault = 25;
    if (mode=="walking") {
	pace = "minutes-per-kilometer";
	paceDefault = 6;  //min per km
    }
    if (units=="imperial"){
	advanceUnits = "feet";
	pace = "mph"
	paceDefault = 16;
	if (mode=="walking"){
	    pace = "minutes-per-mile";
	    packetDefault = 10; //min per mile
	}
    }

    var doPrint = false;
    var doShow = false;
    
    if (theType=="directions"){
	var speed = prompt(`Your average ${mode} speed in ${pace}.`,paceDefault)
	if (pace.indexOf("minutes-per")>=0) speed = 60/speed;
	var ApiHeaders =  {'Accept': 'application/json','Content-Type': 'application/json'};	    
	var data = {allPoints:allPoints,units:units,speed:speed};
	var url = `${protocol}//${hostname}:${port}/showDirections`;
	var theResp = await fetch(url,{method:'POST',body:JSON.stringify(data),headers:ApiHeaders});
	var theJson = await theResp.json();	
	doPrint = confirm("Print it?");
	doShow = true;
    }

    if (theType=="sparseGPX"){
	var ApiHeaders =  {'Accept': 'application/json','Content-Type': 'application/json'};	    
	var data = {allPoints:allPoints};
	var url = `${protocol}//${hostname}:${port}/makeSparseGPX`;
	var theResp = await fetch(url,{method:'POST',body:JSON.stringify(data),headers:ApiHeaders});
	var theJson = await theResp.json();
	doPrint = true;
    }
    
    if (theType=="denseGPX"){
	var ApiHeaders =  {'Accept': 'application/json','Content-Type': 'application/json'};	    
	var speed = prompt(`Your average ${mode} speed in ${pace}.`,paceDefault)
	if (pace.indexOf("minutes-per")>=0) speed = 60/speed;
	var data = {allPoints:allPoints,units:units,speed:speed};
	var url = `${protocol}//${hostname}:${port}/makeDenseGPX`;
	var theResp = await fetch(url,{method:'POST',body:JSON.stringify(data),headers:ApiHeaders});
	var theJson = await theResp.json();
	doPrint = true;
    }
    
    if (theType=="tcx"){
	var ApiHeaders =  {'Accept': 'application/json','Content-Type': 'application/json'};	    
	var speed = prompt(`Your average ${mode} speed in ${pace}.`,paceDefault)
	if (pace.indexOf("minutes-per")>=0) speed = 60/speed;
	var advance = prompt(`Set turn warnings this many ${advanceUnits} in advance.`,300);
	var data = {allPoints:allPoints,units:units,speed:speed,advance:advance,name:routeName};
	var url = `${protocol}//${hostname}:${port}/makeTCX`;
	var theResp = await fetch(url,{method:'POST',body:JSON.stringify(data),headers:ApiHeaders});
	var theJson = await theResp.json();
	doPrint = true;
    }

    if (theType=="google"){
	doPrint = false;
	var start = `${allPoints[0].lat},${allPoints[0].lng}`;
	var destination = `${allPoints[0].lat},${allPoints[0].lng}`;
	var waypoints = "";
	for (const waypoint of currentWaypoints) waypoints += `${waypoint.lat},${waypoint.lng}|`;
	waypoints = waypoints.slice(0,-1);
	var inputMode = document.getElementById("inputMode").value;
	var travelmode = "bicycling";
	if (inputMode.indexOf("driving")>=0) travelmode = "driving";
	if (inputMode.indexOf("foot")>=0) travelmode = "walking";
	const url = `https://www.google.com/maps/dir/?api=1&origin=${start}&destination=${destination}&waypoints=${waypoints}&dir_action=navigate&travelmode=${travelmode}`;
	alert(`This will open a new window with the "anchor" points displayed on Google Maps.  Google will do its own routing, which is very likely NOT going to be the same as the RouteLoops routing.`);
	window.open(url,'_blank');
	var theJson = {status:"google"};
    }
	
    if (theType=="link"){
	saveConfiguration();
	doPrint = false;
	var theJson = {status:"link"};
    }
    

    if (theJson.status=="OK"){

	var theInfo = "";
	var theType = "";
	if (theJson.hasOwnProperty("html")){
	    theInfo = theJson.html;
	    theType = "html";
	}
	if (theJson.hasOwnProperty("gpx")){
	    theInfo = theJson.gpx;
	    theType = "gpx";
	}
	if (theJson.hasOwnProperty("tcx")){
	    theInfo = theJson.tcx;
	    theType = "tcx";
	}
	
	if (doShow){
	    const winUrl = URL.createObjectURL(
		new Blob([theInfo], { type: "text/html" })
	    );

	    const win = window.open(
		winUrl,
		"win",
		`width=800,height=400,screenX=200,screenY=200`
	    );
	}

	if (doPrint){
	    var useName = theJson.name;
	    if (routeName.length>0) useName = routeName;
	    var blob = new Blob([theInfo], {type: "text/html"});
	    saveAs(blob, `${useName}.${theType}`);
	}
    }


    document.getElementById("createOutput").value = "none";
    return;
}

//..................................................................
function reverseRoute(){
    if (currentWaypoints.length==0) return;
    else{
	currentWaypoints.reverse();
	if (document.getElementById("inputRotation").value == "clockwise") document.getElementById("inputRotation").value = "counterclockwise"
	else                                                               document.getElementById("inputRotation").value = "clockwise"
	doRL(currentWaypoints);
	return;
    }
}
//..................................................................
function removeWaypoint(){
    if (currentWaypoints.length==0) return;
    else{
	doRemoval = true;
	alert('Click on the route on, or near, the waypoint you want to remove.');
	return;
    }
}
//................................................................
async function doRemoveWaypoint(lat,lng){
    
    var ApiHeaders =  {'Accept': 'application/json','Content-Type': 'application/json'};
    var data = {lat:lat,lng:lng,waypoints:currentWaypoints};
    var url = `${protocol}//${hostname}:${port}/removeWaypoint`;
    var theResp = await fetch(url,{method:'POST',body:JSON.stringify(data),headers:ApiHeaders});
    var theJson = await theResp.json();
    doRemoval = false;

    currentWaypoints = JSON.parse(JSON.stringify(theJson.modifiedWaypoints));
    doRL(currentWaypoints);

    return;
}

//..................................................................
function addWaypoint(){
    if (allPoints.length==0) return;
    else{
	doAdd = true;
	alert('Click on the route on, or near, the location where you want a new waypoint.');
	return;
    }
}
//................................................................
async function doAddWaypoint(lat,lng){
    
    var ApiHeaders =  {'Accept': 'application/json','Content-Type': 'application/json'};
    var data = {lat:lat,lng:lng,waypoints:currentWaypoints,allPoints:allPoints};
    var url = `${protocol}//${hostname}:${port}/addWaypoint`;
    var theResp = await fetch(url,{method:'POST',body:JSON.stringify(data),headers:ApiHeaders});
    var theJson = await theResp.json();
    doAdd = false;

    currentWaypoints = JSON.parse(JSON.stringify(theJson.modifiedWaypoints));
    doRL(currentWaypoints);

    return;
}

//............................................................
function saveConfiguration(){

    theConfiguration = {};
    theConfiguration.inputLocation = document.getElementById("inputLocation").value;
    theConfiguration.inputDist = document.getElementById("inputDist").value;
    theConfiguration.inputUnits = document.getElementById("inputUnits").value;
    theConfiguration.inputMode = document.getElementById("inputMode").value;
    theConfiguration.fitnessLevel = document.getElementById("fitnessLevel").value;
    theConfiguration.greenFactor = document.getElementById("greenFactor").value;
    theConfiguration.quietFactor = document.getElementById("quietFactor").value;
    theConfiguration.inputRotation = document.getElementById("inputRotation").value;
    theConfiguration.inputDirection = document.getElementById("inputDirection").value;
    theConfiguration.method = document.getElementById("method").value;
    theConfiguration.inputHighways = document.getElementById("inputHighways").value;
    theConfiguration.inputFerries = document.getElementById("inputFerries").value;
    theConfiguration.currentWaypoints = currentWaypoints;

    var theLink = "";
    theLink = `${protocol}//${hostname}:${port}/index.html`;
    theLink += "?routeLink=true";
    for (const item in theConfiguration){
	if (item != "currentWaypoints") theLink += `&${item}=${theConfiguration[item]}`;
    }
    if (currentWaypoints.length>0){
	var text = "";
	for (const waypoint of currentWaypoints) text += `${waypoint.lat},${waypoint.lng}|`;
	text = text.slice(0,-1);
	theLink += `&waypoints=${text}`;
    }

    console.log(theLink);
   
    const newWindow = window.open('', '_blank', 'width=800,height=200');
    if (newWindow) {
	newWindow.document.open();
	newWindow.document.write(theLink);
	//newWindow.document.close();
    } else {
	alert('Popup blocked! Please allow popups for this site.');
    }
    
    return;
}

//..................................................................
function useRouteLink(){

    if (urlParams.has("inputLocation")) document.getElementById("inputLocation").value = urlParams.get("inputLocation");
    if (urlParams.has("inputDist"))     document.getElementById("inputDist").value = urlParams.get("inputDist");
    if (urlParams.has("inputUnits"))    document.getElementById("inputUnits").value = urlParams.get("inputUnits");
    if (urlParams.has("inputMode")){
	var useMode = "cycling-road";
	if (urlParams.get("inputMode").toLowerCase().indexOf("driv")>=0) useMode = "driving-car";
	if (urlParams.get("inputMode").toLowerCase().indexOf("walk")>=0) useMode = "foot-walking";
	if (urlParams.get("inputMode").toLowerCase().indexOf("hik")>=0) useMode = "foot-hiking";
	document.getElementById("inputMode").value = useMode;
    }
    if (urlParams.has("fitnessLevel")) document.getElementById("fitnessLevel").value = urlParams.get("fitnessLevel");
    if (urlParams.has("greenFactor"))  document.getElementById("greenFactor").value = urlParams.get("greenFactor");
    if (urlParams.has("quietFactor"))  document.getElementById("quietFactor").value = urlParams.get("quietFactor");
    if (urlParams.has("inputRotation")) document.getElementById("inputRotation").value = urlParams.get("inputRotation");
    if (urlParams.has("inputDirection")) document.getElementById("inputDirection").value = urlParams.get("inputDirection");
    if (urlParams.has("method"))       document.getElementById("method").value = urlParams.get("method");
    if (urlParams.has("inputHighways")) document.getElementById("inputHighways").value = urlParams.get("inputHighways");
    if (urlParams.has("inputFerries"))  document.getElementById("inputFerries").value = urlParams.get("inputFerries");
    var waypoints = [];
    var pts = [];
    if (urlParams.has("waypoints")){
	pts = urlParams.get("waypoints");
	pts = pts.split("|");
	for (item of pts){
	    var pair = item.split(",");
	    waypoints.push({lat:pair[0],lng:pair[1]});
	}
    }

    doRL(waypoints);

    return;
}
