import { Map, Overlay, View } from "ol";
import { Coordinate } from "ol/coordinate";
import Layer from "ol/layer/Layer";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import "./style.css";
import { TileWMS } from "ol/source";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON.js";
import { bbox as bboxStrategy } from "ol/loadingstrategy.js";
import { WMSCapabilities } from "ol/format";
import { GEOSERVER_URI, WORKSPACE } from "./constants";
import { Pixel } from "ol/pixel";
import Feature from "ol/Feature";

const map = new Map({
  target: "map",
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
  ],
  view: new View({
    center: [0, 0],
    zoom: 2,
  }),
});

// map.addLayer(createVectorLayer("traffic_data"));

function createVectorLayer(layer: string) {
  // const style = vectorLayerPredefinedStyles[layer.name];
  // console.log(`Styles ${style ? "found" : "missing"} for layer ${layer.name}`);

  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: (extent) => {
        return `${GEOSERVER_URI}/${WORKSPACE}/wfs?service=WFS&request=GetFeature&typename=${layer}&outputFormat=application/json&srsname=EPSG:3857&bbox=${extent.join(
          ","
        )},EPSG:3857`;
      },
      strategy: bboxStrategy,
    }),
  });
}
